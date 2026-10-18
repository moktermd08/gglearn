import { createCipheriv, createDecipheriv, createHash, createHmac, createPublicKey, randomBytes, scryptSync, timingSafeEqual, verify as cryptoVerify } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { eq } from "drizzle-orm";
import { companies, companySso, db, userScopes, users } from "@/lib/db";
import { provision } from "@/lib/people";

/**
 * Single sign-on with OpenID Connect, one provider per company (Okta, Microsoft Entra ID, Google Workspace, Auth0, Keycloak... anything that speaks OIDC).
 * The authorization-code flow with PKCE, a state and a nonce; the ID token's signature, issuer, audience, expiry and nonce are all checked.
 * Who gets in is narrow on purpose:
 *  - the verified email must be in a domain the company has claimed (a domain can belong to only one company, and public webmail domains cannot be claimed);
 *  - an existing account is let in only if it belongs to this company alone (so an account made through open sign-up with the same address, or one in two
 *    companies, is never taken over), and the platform owner can never come in this way;
 *  - an address with no account gets one only if the company switched on "create accounts on first sign-in": a learner in this company, set up like any joiner.
 * The company can then require SSO for its learners and managers (admins keep their password, so a wrong setting can be undone), but only after a first
 * successful SSO sign-in has proved the setup works. Fetches the company's provider makes from here are limited to public https addresses.
 */
export const WEBMAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com"]);
const nowSec = () => Math.floor(Date.now() / 1000);
const BOX_TTL_SEC = 10 * 60, MAX_BODY = 200_000, FETCH_MS = 6000;
export type Row = typeof companySso.$inferSelect;

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};

// ---- the client secret, encrypted at rest ----
const key = () => scryptSync(secret(), "gglearn-sso-client-secret", 32);
export function sealSecret(plain: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv), ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}
export function openSecret(stored: string): string | null {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try { const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url")); d.setAuthTag(Buffer.from(tag, "base64url")); return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8"); } catch { return null; } // the secret key changed: the admin enters the secret again
}

// ---- keeping fetches to the public internet ----
const allowLocal = () => process.env.SSO_ALLOW_LOCAL === "1"; // for tests only
export function privateAddress(ip: string): boolean {
  if (ip.includes(":")) { const x = ip.toLowerCase(); return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:") && privateAddress(x.slice(7)); }
  const p = ip.split(".").map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}
/** Is this a URL we are willing to fetch from the server? https, a real host, and every address it resolves to public. */
export async function safeUrl(raw: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.username || u.password) return false;
  if (allowLocal() && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u.protocol === "http:" || u.protocol === "https:";
  if (u.protocol !== "https:") return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost") || !host.includes(".") && !isIP(host)) return false;
  try { const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }); return addrs.length > 0 && addrs.every((a) => !privateAddress(a.address)); } catch { return false; }
}
async function getText(url: string, init?: RequestInit): Promise<{ status: number; text: string } | null> {
  if (!(await safeUrl(url))) return null;
  try {
    const r = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(FETCH_MS), cache: "no-store" });
    const text = await r.text();
    return text.length > MAX_BODY ? null : { status: r.status, text };
  } catch { return null; }
}
const jsonOf = (t: string | undefined): Record<string, unknown> | null => { try { const v = JSON.parse(t ?? ""); return v && typeof v === "object" ? v : null; } catch { return null; } };

// ---- discovery and keys ----
export type Meta = { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string };
const metaCache = new Map<string, { at: number; meta: Meta }>();
const norm = (s: string) => s.replace(/\/+$/, "");

export async function discover(issuer: string): Promise<Meta | null> {
  const hit = metaCache.get(issuer);
  if (hit && nowSec() - hit.at < 600) return hit.meta;
  const r = await getText(`${norm(issuer)}/.well-known/openid-configuration`);
  const j = r?.status === 200 ? jsonOf(r.text) : null;
  if (!j || typeof j.issuer !== "string" || norm(j.issuer) !== norm(issuer)) return null;
  const meta = { issuer: j.issuer, authorization_endpoint: String(j.authorization_endpoint ?? ""), token_endpoint: String(j.token_endpoint ?? ""), jwks_uri: String(j.jwks_uri ?? "") };
  for (const u of [meta.authorization_endpoint, meta.token_endpoint, meta.jwks_uri]) if (!(await safeUrl(u))) return null;
  metaCache.set(issuer, { at: nowSec(), meta });
  return meta;
}
export const forgetProvider = (issuer: string) => { metaCache.delete(issuer); jwksCache.delete(issuer); };

type Jwk = { kid?: string; kty: string; alg?: string; use?: string; [k: string]: unknown };
const jwksCache = new Map<string, { at: number; keys: Jwk[] }>();
async function keysFor(meta: Meta, fresh: boolean): Promise<Jwk[]> {
  const hit = jwksCache.get(meta.issuer);
  if (hit && !fresh && nowSec() - hit.at < 600) return hit.keys;
  const r = await getText(meta.jwks_uri), j = r?.status === 200 ? jsonOf(r.text) : null;
  const keys = Array.isArray(j?.keys) ? (j!.keys as Jwk[]) : [];
  if (keys.length) jwksCache.set(meta.issuer, { at: nowSec(), keys });
  return keys;
}

const b64 = (s: string) => Buffer.from(s, "base64url");
export type Claims = { iss?: string; aud?: string | string[]; azp?: string; exp?: number; iat?: number; nonce?: string; sub?: string; email?: string; email_verified?: boolean | string; name?: string; given_name?: string; family_name?: string };

/** Checks an ID token's signature and standard claims. Returns the claims, or why not. */
export async function verifyIdToken(token: string, meta: Meta, clientId: string, nonce: string, at = nowSec()): Promise<Claims | { error: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) return { error: "token" };
  const header = jsonOf(b64(parts[0]).toString()), alg = header?.alg;
  if (alg !== "RS256" && alg !== "ES256") return { error: "algorithm" }; // never "none", never a shared secret
  const find = async (fresh: boolean) => (await keysFor(meta, fresh)).find((k) => (!header?.kid || k.kid === header.kid) && (!k.use || k.use === "sig") && (alg === "RS256" ? k.kty === "RSA" : k.kty === "EC"));
  const jwk = await find(false) ?? await find(true);
  if (!jwk) return { error: "key" };
  let ok = false;
  try {
    const pub = createPublicKey({ key: jwk as never, format: "jwk" });
    ok = cryptoVerify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), alg === "ES256" ? { key: pub, dsaEncoding: "ieee-p1363" } : pub, b64(parts[2]));
  } catch { ok = false; }
  if (!ok) return { error: "signature" };
  const c = jsonOf(b64(parts[1]).toString()) as Claims | null;
  if (!c) return { error: "token" };
  const aud = Array.isArray(c.aud) ? c.aud : typeof c.aud === "string" ? [c.aud] : [];
  if (typeof c.iss !== "string" || norm(c.iss) !== norm(meta.issuer)) return { error: "issuer" };
  if (!aud.includes(clientId) || (aud.length > 1 && c.azp !== clientId)) return { error: "audience" };
  if (typeof c.exp !== "number" || c.exp < at - 60) return { error: "expired" };
  if (typeof c.iat === "number" && c.iat > at + 300) return { error: "token" };
  if (typeof c.nonce !== "string" || c.nonce !== nonce) return { error: "nonce" };
  if (typeof c.sub !== "string" || !c.sub) return { error: "token" };
  return c;
}

// ---- the sign-in "box": state, nonce and PKCE verifier, kept in a short-lived signed cookie ----
export type Box = { c: number; s: string; n: string; v: string; next: string; exp: number };
const sign = (v: string) => createHmac("sha256", secret()).update(`sso-box:${v}`).digest("base64url");
export const sealBox = (b: Box) => { const body = Buffer.from(JSON.stringify(b)).toString("base64url"); return `${body}.${sign(body)}`; };
export function openBox(raw: string | undefined, at = nowSec()): Box | null {
  const [body, mac] = (raw ?? "").split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const b = jsonOf(Buffer.from(body, "base64url").toString()) as Box | null;
  return b && typeof b.c === "number" && b.exp > at ? b : null;
}

// ---- configuration ----
export const configOf = (companyId: number): Row | undefined => db.select().from(companySso).where(eq(companySso.companyId, companyId)).get();
export const normDomain = (d: string) => d.trim().toLowerCase().replace(/^@/, "");
export const domainsOf = (r: Pick<Row, "domains">) => r.domains.split(",").map(normDomain).filter(Boolean);
export const validDomain = (d: string) => /^(?=.{3,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d);

/** The company whose single sign-on covers this email address's domain, if any. */
export function companyForEmail(email: string): { id: number; slug: string; name: string } | null {
  const domain = normDomain(email.split("@")[1] ?? "");
  if (!domain) return null;
  for (const r of db.select().from(companySso).where(eq(companySso.enabled, "yes")).all()) {
    if (domainsOf(r).includes(domain)) { const c = db.select().from(companies).where(eq(companies.id, r.companyId)).get(); if (c) return { id: c.id, slug: c.slug, name: c.name }; }
  }
  return null;
}

/** Does this person belong to the company, and to no other? */
export function soleMember(userId: number, companyId: number): boolean {
  const scopes = db.select().from(userScopes).where(eq(userScopes.userId, userId)).all();
  return scopes.length > 0 && scopes.every((s) => s.kind === "company" && s.refId === companyId);
}

/** If this person must use single sign-on, the sentence to show instead of a password form; otherwise null. Admins are never held to it. */
export function ssoRequired(email: string): string | null {
  const u = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
  if (!u || u.role === "admin") return null;
  const scopes = db.select().from(userScopes).where(eq(userScopes.userId, u.id)).all();
  const companyId = scopes.length && scopes.every((s) => s.kind === "company" && s.refId === scopes[0].refId) ? scopes[0].refId : null;
  const cfg = companyId ? configOf(companyId) : undefined;
  return cfg && cfg.enabled === "yes" && cfg.enforce === "yes" && cfg.verifiedAt ? "Your company uses single sign-on. Choose \"Sign in with your company\" instead." : null;
}

/** Does the company that owns this email domain require single sign-on (and has it been proved to work)? Says nothing about any account. */
export function enforcedForDomain(email: string): boolean {
  const c = companyForEmail(email), cfg = c ? configOf(c.id) : undefined;
  return !!cfg && cfg.enforce === "yes" && !!cfg.verifiedAt;
}

// ---- the flow ----
const b64url = (b: Buffer) => b.toString("base64url");
export async function begin(companyId: number, redirectUri: string, next: string): Promise<{ url: string; box: string } | { error: string }> {
  const cfg = configOf(companyId);
  if (!cfg || cfg.enabled !== "yes" || !cfg.issuer || !cfg.clientId) return { error: "off" };
  const meta = await discover(cfg.issuer);
  if (!meta) return { error: "provider" };
  const box: Box = { c: companyId, s: b64url(randomBytes(18)), n: b64url(randomBytes(18)), v: b64url(randomBytes(32)), next, exp: nowSec() + BOX_TTL_SEC };
  const q = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: redirectUri, scope: "openid email profile", state: box.s, nonce: box.n, code_challenge: b64url(createHash("sha256").update(box.v).digest()), code_challenge_method: "S256" });
  return { url: `${meta.authorization_endpoint}${meta.authorization_endpoint.includes("?") ? "&" : "?"}${q}`, box: sealBox(box) };
}

export type Who = { userId: number; next: string };
/** The provider sent the person back with a code. Returns who they are in gglearn, or a short reason code. */
export async function complete(rawBox: string | undefined, query: { code?: string | null; state?: string | null; error?: string | null }, redirectUri: string): Promise<Who | { error: string }> {
  const box = openBox(rawBox);
  if (!box) return { error: "expired" };
  if (query.error) return { error: "denied" };
  if (!query.code || !query.state || query.state !== box.s) return { error: "state" };
  const cfg = configOf(box.c);
  if (!cfg || cfg.enabled !== "yes") return { error: "off" };
  const meta = await discover(cfg.issuer), clientSecret = openSecret(cfg.clientSecret);
  if (!meta || !clientSecret) return { error: "provider" };
  const r = await getText(meta.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code: query.code, redirect_uri: redirectUri, code_verifier: box.v, client_id: cfg.clientId }) });
  const tok = r?.status === 200 ? jsonOf(r.text) : null;
  if (!tok || typeof tok.id_token !== "string") return { error: "token" };
  const claims = await verifyIdToken(tok.id_token, meta, cfg.clientId, box.n);
  if ("error" in claims) return { error: claims.error };
  const who = resolve(box.c, cfg, claims);
  if ("error" in who) return who;
  if (!cfg.verifiedAt) db.update(companySso).set({ verifiedAt: nowSec() }).where(eq(companySso.companyId, box.c)).run();
  return { userId: who.userId, next: box.next };
}

/** Which gglearn account a verified identity is. Pure of the network: this is where the rules above are applied. */
export function resolve(companyId: number, cfg: Pick<Row, "domains" | "jit">, c: Claims): { userId: number } | { error: string } {
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  if (!email || c.email_verified === false || c.email_verified === "false") return { error: "email" };
  if (!domainsOf(cfg).includes(normDomain(email.split("@")[1] ?? ""))) return { error: "domain" };
  const have = db.select().from(users).where(eq(users.email, email)).get();
  if (have) {
    if (have.status !== "active") return { error: "inactive" };
    if (!soleMember(have.id, companyId)) return { error: "elsewhere" };
    return { userId: have.id };
  }
  if (cfg.jit !== "yes") return { error: "unknown" };
  const name = (typeof c.name === "string" && c.name.trim()) || [c.given_name, c.family_name].filter((x) => typeof x === "string" && x).join(" ") || email.split("@")[0];
  const id = db.transaction((tx) => {
    const u = tx.insert(users).values({ name: name.replace(/\s+/g, " ").slice(0, 80), email, jobRole: "general", audience: "staff", role: "learner", passwordHash: "" }).returning().get();
    provision(tx, u.id, u.email, "general", "staff", [{ kind: "company", id: companyId }]);
    return u.id;
  });
  return { userId: id };
}

export const REASONS: Record<string, string> = {
  expired: "That sign-in took too long or was already used. Please start again.", state: "That sign-in could not be checked. Please start again.", denied: "Your company’s sign-in said no. Ask your admin if you should have access.",
  off: "Single sign-on is not switched on for this company.", provider: "We could not reach your company’s sign-in. Try again, or ask your admin to check the setup.",
  token: "Your company’s sign-in sent something we could not accept.", algorithm: "Your company’s sign-in sent something we could not accept.", key: "Your company’s sign-in sent something we could not accept.",
  signature: "Your company’s sign-in sent something we could not accept.", issuer: "Your company’s sign-in sent something we could not accept.", audience: "Your company’s sign-in sent something we could not accept.", nonce: "That sign-in could not be checked. Please start again.",
  email: "Your company’s sign-in did not confirm an email address.", domain: "That email address does not belong to this company’s sign-in.", inactive: "This account has been switched off. Ask your admin.",
  elsewhere: "This email already has an account that is not only in this company. Sign in with your password, or ask your admin.", unknown: "You do not have an account here yet. Ask your admin to add you.",
};
