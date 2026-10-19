import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, oauthIdentities, users } from "@/lib/db";
import { b64url, companyForEmail, discover, getText, jsonOf, openBox, sealBox, ssoRequired, verifyIdToken, type Box, type Claims, type Meta } from "@/lib/sso";
import { claimPendingInvites, enrol } from "@/lib/contests";
import { referrerOf } from "@/lib/referrals";
import { trialTrack } from "@/lib/trial";

/**
 * Sign in with a personal Google or Microsoft account. It is OpenID Connect like company single sign-on (lib/sso.ts: PKCE, state, nonce, signed ID token),
 * but for individuals, with one set of credentials the platform owner registers once. Nothing appears until they are set in the environment:
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET.
 * Who is who is decided by the provider's own stable id, and an email is only believed when the provider vouches for it:
 *  - Google: `email_verified` must be true.
 *  - Microsoft: a personal Microsoft account (its email is verified by Microsoft), or a work account whose email domain Microsoft marks as verified (`xms_edov`).
 *    A work account's plain `email` claim can be set by that organisation's admin to anything, so on its own it is never trusted.
 * What happens on a sign-in:
 *  1. A known identity signs in to its account (unless the account is switched off, or its company requires its own single sign-on).
 *  2. An email on a domain a company has claimed for single sign-on is sent to that company's sign-in: personal sign-in is no way around a company's rules.
 *  3. An email that already has an account is NOT linked automatically. Anyone could have made that account with a password before the real owner arrived, so the
 *     owner signs in the usual way and connects the provider from their profile (a signed-in person proves both sides).
 *  4. Otherwise a new account is made, exactly as open sign-up makes one (a learner in the open arena, nothing company-specific, emails off), carrying the referral
 *     and "tried it" topic from the link they came through.
 * Connected accounts can be removed, but never the last way in: someone with no password and one connection is told to set a password first.
 */
export type Provider = "google" | "microsoft";
export const PROVIDERS: Provider[] = ["google", "microsoft"];
export const LABEL: Record<Provider, string> = { google: "Google", microsoft: "Microsoft" };
const CONSUMERS_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";
const nowSec = () => Math.floor(Date.now() / 1000);

type Config = { key: Provider; issuer: string; loose: boolean; clientId: string; clientSecret: string; issuerOk?: (iss: string, c: Claims) => boolean };

/** The provider's credentials from the environment, or null when the platform owner has not set them. The issuer can only be overridden for tests. */
export function configFor(key: Provider): Config | null {
  const up = key.toUpperCase(), clientId = process.env[`${up}_CLIENT_ID`], clientSecret = process.env[`${up}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  const test = process.env.SSO_ALLOW_LOCAL === "1" ? process.env[`SOCIAL_TEST_ISSUER_${up}`] : undefined;
  if (test) return { key, issuer: test, loose: false, clientId, clientSecret };
  if (key === "google") return { key, issuer: "https://accounts.google.com", loose: false, clientId, clientSecret, issuerOk: (iss) => iss === "https://accounts.google.com" || iss === "accounts.google.com" };
  // "common" signs in work and personal accounts alike; each token is issued by the person's own tenant, so the issuer is checked as a pattern plus the tenant claim
  return { key, issuer: "https://login.microsoftonline.com/common/v2.0", loose: true, clientId, clientSecret, issuerOk: (iss, c) => typeof c.tid === "string" && iss === `https://login.microsoftonline.com/${c.tid}/v2.0` && /^[0-9a-f-]{36}$/i.test(c.tid) };
}
export const available = (): Provider[] => PROVIDERS.filter((p) => !!configFor(p));
export const isProvider = (s: string): s is Provider => (PROVIDERS as string[]).includes(s);

/** Does the provider vouch for this email? */
export function trustedEmail(key: Provider, c: Claims): string | null {
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@") || email.length > 120) return null;
  if (key === "google") return c.email_verified === true || c.email_verified === "true" ? email : null;
  const edov = c.xms_edov === true || c.xms_edov === "true" || c.xms_edov === 1 || c.xms_edov === "1";
  return c.tid === CONSUMERS_TENANT || edov ? email : null;
}

// ---- starting and finishing ----
export type Options = { next: string; ref?: string; tried?: string; link?: number };
export async function begin(key: Provider, redirectUri: string, o: Options): Promise<{ url: string; box: string } | { error: string }> {
  const cfg = configFor(key);
  if (!cfg) return { error: "off" };
  const meta = await discover(cfg.issuer, cfg.loose);
  if (!meta) return { error: "provider" };
  const box: Box = { c: 0, p: key, s: b64url(randomBytes(18)), n: b64url(randomBytes(18)), v: b64url(randomBytes(32)), next: o.next, ref: o.ref, try: o.tried, link: o.link, exp: nowSec() + 600 };
  const q = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: redirectUri, scope: "openid email profile", state: box.s, nonce: box.n, code_challenge: b64url(createHash("sha256").update(box.v).digest()), code_challenge_method: "S256" });
  if (key === "google") q.set("prompt", "select_account");
  return { url: `${meta.authorization_endpoint}${meta.authorization_endpoint.includes("?") ? "&" : "?"}${q}`, box: sealBox(box) };
}

export type Outcome = { userId: number; next: string; created: boolean; linked: boolean } | { error: string };
/** The provider sent the person back. `signedIn` is who is signed in now (needed only when they are connecting an account). */
export async function complete(key: Provider, rawBox: string | undefined, query: { code?: string | null; state?: string | null; error?: string | null }, redirectUri: string, signedIn: number | null): Promise<Outcome> {
  const box = openBox(rawBox);
  if (!box || box.p !== key) return { error: "expired" };
  if (query.error) return { error: "denied" };
  if (!query.code || !query.state || query.state !== box.s) return { error: "state" };
  const cfg = configFor(key);
  if (!cfg) return { error: "off" };
  const meta: Meta | null = await discover(cfg.issuer, cfg.loose);
  if (!meta) return { error: "provider" };
  const r = await getText(meta.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code: query.code, redirect_uri: redirectUri, code_verifier: box.v, client_id: cfg.clientId }) });
  const tok = r?.status === 200 ? jsonOf(r.text) : null;
  if (!tok || typeof tok.id_token !== "string") return { error: "token" };
  const claims = await verifyIdToken(tok.id_token, meta, cfg.clientId, box.n, nowSec(), cfg.issuerOk);
  if ("error" in claims) return { error: claims.error };
  if (box.link) return connect(key, claims, box.link, signedIn, box.next);
  return resolve(key, claims, box);
}

// ---- who it is ----
const identity = (key: Provider, sub: string) => db.select().from(oauthIdentities).where(and(eq(oauthIdentities.provider, key), eq(oauthIdentities.subject, sub))).get();
export const identitiesOf = (userId: number) => db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, userId)).all();

/** Connecting from a profile: the person is already signed in, which proves one side; the provider proves the other. */
function connect(key: Provider, c: Claims, userId: number, signedIn: number | null, next: string): Outcome {
  if (signedIn !== userId) return { error: "expired" };
  const sub = c.sub!, have = identity(key, sub);
  if (have && have.userId !== userId) return { error: "taken" };
  if (!have) db.insert(oauthIdentities).values({ provider: key, subject: sub, userId, email: typeof c.email === "string" ? c.email.slice(0, 120) : "" }).onConflictDoNothing().run();
  return { userId, next, created: false, linked: true };
}

export function resolve(key: Provider, c: Claims, box: Pick<Box, "next" | "ref" | "try">): Outcome {
  const sub = c.sub!, known = identity(key, sub);
  if (known) {
    const u = db.select().from(users).where(eq(users.id, known.userId)).get();
    if (!u || u.status !== "active") return { error: "inactive" };
    if (ssoRequired(u.email)) return { error: "company" };
    return { userId: u.id, next: box.next, created: false, linked: false };
  }
  const email = trustedEmail(key, c);
  if (!email) return { error: "email" };
  if (companyForEmail(email)) return { error: "company" };
  if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) return { error: "exists" };
  const name = ((typeof c.name === "string" && c.name.trim()) || [c.given_name, c.family_name].filter((x) => typeof x === "string" && x).join(" ") || email.split("@")[0]).replace(/\s+/g, " ").slice(0, 80);
  const id = db.transaction((tx) => {
    const u = tx.insert(users).values({ name, email, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "", referredBy: referrerOf(box.ref ?? ""), emailNudges: "off" }).returning().get();
    claimPendingInvites(tx, u.id, u.email); // races this address was already invited to
    const tried = trialTrack(box.try ?? "");
    if (tried) enrol(tx, u.id, tried.id, "Tried it first");
    tx.insert(oauthIdentities).values({ provider: key, subject: sub, userId: u.id, email }).run();
    return u.id;
  });
  return { userId: id, next: box.next, created: true, linked: false };
}

/** Removes a connected account, but never the last way in. */
export function disconnect(userId: number, provider: Provider): { ok: true } | { error: string } {
  const u = db.select().from(users).where(eq(users.id, userId)).get(), ids = identitiesOf(userId);
  if (!u || !ids.some((i) => i.provider === provider)) return { ok: true };
  if (!u.passwordHash && ids.length < 2) return { error: "Set a password first (use \"Forgot your password?\" on the sign-in page), then you can remove this, so you cannot lock yourself out." };
  db.delete(oauthIdentities).where(and(eq(oauthIdentities.userId, userId), eq(oauthIdentities.provider, provider))).run();
  return { ok: true };
}

export const REASONS: Record<string, string> = {
  expired: "That sign-in took too long or was already used. Please start again.", state: "That sign-in could not be checked. Please start again.", denied: "The sign-in was cancelled.",
  off: "That sign-in is not available.", provider: "We could not reach the sign-in service. Please try again.", token: "The sign-in service sent something we could not accept.",
  algorithm: "The sign-in service sent something we could not accept.", key: "The sign-in service sent something we could not accept.", signature: "The sign-in service sent something we could not accept.",
  issuer: "The sign-in service sent something we could not accept.", audience: "The sign-in service sent something we could not accept.", nonce: "That sign-in could not be checked. Please start again.",
  email: "That account did not give us a verified email address, so we cannot make an account from it. Sign up with an email and password instead.",
  inactive: "This account has been switched off.", company: "That email belongs to a company that has its own sign-in. Use \"Sign in with your company\".",
  exists: "There is already an account with that email. Sign in with your password (or \"Forgot your password?\"), then connect your Google or Microsoft account from your profile.",
  taken: "That Google or Microsoft account is already connected to a different account here.",
};
