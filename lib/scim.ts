import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { companies, db, directoryTokens, directoryUsers, userScopes, users } from "@/lib/db";
import { hashToken, newToken } from "@/lib/invites";
import { offboardUser, provision, reinstateUser } from "@/lib/people";
import { allowed, hit, MINUTE } from "@/lib/rate-limit";
import { arenaOfUser } from "@/lib/arena";

/**
 * Directory sync, as SCIM 2.0 (the standard Okta, Microsoft Entra ID, Google Workspace and others speak). A company makes a token; its directory calls
 * /api/scim/v2/Users with it to create people, rename them, and switch them off when they leave. What a directory can do is deliberately narrow:
 *  - it only ever sees and changes people it manages for that company (`directory_users`), never anyone else;
 *  - it only creates learners, set up exactly as an invited joiner is (lib/people.ts `provision`), in that company and no other;
 *  - removing someone switches them off (their progress is kept, they are signed out everywhere, the offboarding checklist starts), never deletes them;
 *  - it cannot make or change an admin or manager, change anyone's password, or take over an address that belongs to someone outside the company.
 * People it creates have no password: they sign in with single sign-on, a sign-in link, or by choosing a password through "forgot password".
 * An existing active learner who belongs to this company alone (and has the same email) is adopted rather than refused, so switching sync on does not
 * need anyone to be recreated.
 */
export const MAX_TOKENS = 3, PAGE_MAX = 100;
const nowSec = () => Math.floor(Date.now() / 1000);

// ---- tokens ----
/** Makes a token for a company. The token is returned once: only its hash is kept. */
export function makeToken(companyId: number, label: string): { token: string } | { error: string } {
  const live = Number(db.select({ n: sql<number>`count(*)` }).from(directoryTokens).where(and(eq(directoryTokens.companyId, companyId), isNull(directoryTokens.revokedAt))).get()?.n ?? 0);
  if (live >= MAX_TOKENS) return { error: `A company can have ${MAX_TOKENS} live tokens. Revoke one first.` };
  const token = `scim_${newToken()}`;
  db.insert(directoryTokens).values({ companyId, label: label.trim().slice(0, 60), tokenHash: hashToken(token) }).run();
  return { token };
}
export function revokeToken(companyId: number, id: number) {
  db.update(directoryTokens).set({ revokedAt: nowSec() }).where(and(eq(directoryTokens.id, id), eq(directoryTokens.companyId, companyId), isNull(directoryTokens.revokedAt))).run();
}
export const tokensOf = (companyId: number) => db.select({ id: directoryTokens.id, label: directoryTokens.label, createdAt: directoryTokens.createdAt, lastUsedAt: directoryTokens.lastUsedAt })
  .from(directoryTokens).where(and(eq(directoryTokens.companyId, companyId), isNull(directoryTokens.revokedAt))).orderBy(asc(directoryTokens.id)).all();

/** The company a bearer token belongs to, if it is live. */
export function companyForToken(authorization: string | null): number | null {
  const m = /^Bearer (scim_[A-Za-z0-9_-]{20,80})$/.exec(authorization ?? "");
  if (!m) return null;
  const row = db.select().from(directoryTokens).where(eq(directoryTokens.tokenHash, hashToken(m[1]))).get();
  if (!row || row.revokedAt) return null;
  if (!allowed(`scim:${row.id}`, 600)) return null; // 600 calls a minute is far more than a directory needs
  hit(`scim:${row.id}`, MINUTE);
  if (!row.lastUsedAt || nowSec() - row.lastUsedAt > 60) db.update(directoryTokens).set({ lastUsedAt: nowSec() }).where(eq(directoryTokens.id, row.id)).run();
  return row.companyId;
}

// ---- the resource ----
type User = typeof users.$inferSelect;
const SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCHEMA_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error", SCHEMA_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse", SCHEMA_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp";

export function resource(u: User, externalId: string, base: string) {
  return {
    schemas: [SCHEMA_USER], id: String(u.id), ...(externalId ? { externalId } : {}), userName: u.email, name: { formatted: u.name }, displayName: u.name,
    emails: [{ value: u.email, primary: true, type: "work" }], active: u.status === "active",
    meta: { resourceType: "User", created: new Date(u.createdAt * 1000).toISOString(), location: `${base}/api/scim/v2/Users/${u.id}` },
  };
}
export type ScimError = { status: number; detail: string; scimType?: string };
export const scimError = (e: ScimError) => ({ schemas: [SCHEMA_ERROR], status: String(e.status), detail: e.detail, ...(e.scimType ? { scimType: e.scimType } : {}) });

/** Only learners who belong to this company alone can be managed: nobody with a wider role, or a place in another company. */
function soleCompany(userId: number, companyId: number): boolean {
  const scopes = db.select().from(userScopes).where(eq(userScopes.userId, userId)).all();
  return scopes.length > 0 && scopes.every((s) => s.kind === "company" && s.refId === companyId) && arenaOfUser(userId) === `c${companyId}`;
}
const linkOf = (companyId: number, userId: number) => db.select().from(directoryUsers).where(and(eq(directoryUsers.companyId, companyId), eq(directoryUsers.userId, userId))).get();

/** The managed user with this id for this company, or null (the same answer for "no such person" and "not yours", so ids cannot be probed). */
export function managed(companyId: number, id: string): { user: User; externalId: string } | null {
  if (!/^\d{1,9}$/.test(id)) return null;
  const link = linkOf(companyId, Number(id));
  const user = link ? db.select().from(users).where(eq(users.id, Number(id))).get() : undefined;
  return link && user && user.role === "learner" ? { user, externalId: link.externalId } : null;
}

// ---- reading what a directory sends ----
const asBool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : typeof v === "string" && /^(true|false)$/i.test(v) ? v.toLowerCase() === "true" : null);
export type Attrs = { userName?: string; name?: string; externalId?: string; active?: boolean };

const nameFrom = (o: Record<string, unknown>): string | undefined => {
  const n = (o.name ?? {}) as Record<string, unknown>;
  const parts = [n.givenName, n.familyName].filter((x): x is string => typeof x === "string" && !!x.trim());
  const s = (typeof n.formatted === "string" && n.formatted.trim()) || (parts.length ? parts.join(" ") : "") || (typeof o.displayName === "string" && o.displayName.trim()) || "";
  return s ? s.replace(/\s+/g, " ").trim().slice(0, 80) : undefined;
};
const emailFrom = (o: Record<string, unknown>): string | undefined => {
  const list = Array.isArray(o.emails) ? (o.emails as { value?: unknown; primary?: unknown }[]) : [];
  const pick = list.find((e) => e.primary === true) ?? list[0];
  const v = typeof o.userName === "string" && o.userName.includes("@") ? o.userName : typeof pick?.value === "string" ? pick.value : undefined;
  return v ? v.trim().toLowerCase().slice(0, 120) : undefined;
};
/** A full user body (POST and PUT). */
export function attrsOf(body: unknown): Attrs {
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return { userName: emailFrom(o), name: nameFrom(o), externalId: typeof o.externalId === "string" ? o.externalId.slice(0, 200) : undefined, active: asBool(o.active) ?? undefined };
}
/** A PATCH body. Okta sends {op, value:{...}}, Entra sends {op, path, value} with strings like "False"; both end up as the same attributes. */
export function patchAttrs(body: unknown): Attrs {
  const ops = (body && typeof body === "object" && Array.isArray((body as { Operations?: unknown }).Operations) ? (body as { Operations: unknown[] }).Operations : []) as { op?: unknown; path?: unknown; value?: unknown }[];
  const out: Attrs = {};
  for (const op of ops) {
    const kind = typeof op.op === "string" ? op.op.toLowerCase() : "";
    if (kind !== "replace" && kind !== "add") continue; // "remove" of a core attribute is not something we act on
    const path = typeof op.path === "string" ? op.path : "";
    const bag: Record<string, unknown> = path ? { [path.replace(/^emails\[.*\]\.value$/, "userName")]: op.value } : (op.value && typeof op.value === "object" ? (op.value as Record<string, unknown>) : {});
    if (path === "name.givenName" || path === "name.familyName" || path === "name.formatted") bag.name = { [path.split(".")[1]]: op.value };
    const a = attrsOf(bag);
    if (a.userName) out.userName = a.userName;
    if (a.name) out.name = a.name;
    if (a.externalId !== undefined) out.externalId = a.externalId;
    if (a.active !== undefined) out.active = a.active;
  }
  return out;
}

const validEmail = (e: string | undefined): e is string => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;

// ---- operations ----
export type Outcome<T> = { ok: true; value: T; created?: boolean } | { error: ScimError };
const company = (id: number) => db.select().from(companies).where(eq(companies.id, id)).get();

/** POST /Users */
export function createUser(companyId: number, a: Attrs): Outcome<{ user: User; externalId: string }> {
  if (!company(companyId)) return { error: { status: 401, detail: "Unknown company." } };
  if (!validEmail(a.userName)) return { error: { status: 400, detail: "userName must be an email address.", scimType: "invalidValue" } };
  const name = a.name ?? a.userName.split("@")[0];
  const have = db.select().from(users).where(eq(users.email, a.userName)).get();
  if (have) {
    // an existing learner who belongs to this company alone is adopted; anyone else is a conflict, with no hint about who they are
    if (have.role !== "learner" || !soleCompany(have.id, companyId)) return { error: { status: 409, detail: "That userName is already in use.", scimType: "uniqueness" } };
    if (!linkOf(companyId, have.id)) db.insert(directoryUsers).values({ companyId, userId: have.id, externalId: a.externalId ?? "" }).run();
    if (have.status === "offboarded" && a.active !== false) reinstateUser(have.id);
    return { ok: true, value: { user: db.select().from(users).where(eq(users.id, have.id)).get()!, externalId: linkOf(companyId, have.id)?.externalId ?? "" }, created: false };
  }
  const user = db.transaction((tx) => {
    const u = tx.insert(users).values({ name, email: a.userName!, jobRole: "general", audience: "staff", role: "learner", passwordHash: "" }).returning().get();
    provision(tx, u.id, u.email, "general", "staff", [{ kind: "company", id: companyId }]);
    tx.insert(directoryUsers).values({ companyId, userId: u.id, externalId: a.externalId ?? "" }).run();
    return u;
  });
  if (a.active === false) offboardUser(user.id); // created disabled
  return { ok: true, value: { user: db.select().from(users).where(eq(users.id, user.id)).get()!, externalId: a.externalId ?? "" }, created: true };
}

/** PUT and PATCH /Users/{id}: the attributes present are applied, the rest left alone. */
export function updateUser(companyId: number, id: string, a: Attrs): Outcome<{ user: User; externalId: string }> {
  const m = managed(companyId, id);
  if (!m) return { error: { status: 404, detail: "User not found." } };
  if (a.userName !== undefined && a.userName !== m.user.email) {
    if (!validEmail(a.userName)) return { error: { status: 400, detail: "userName must be an email address.", scimType: "invalidValue" } };
    if (db.select({ id: users.id }).from(users).where(eq(users.email, a.userName)).get()) return { error: { status: 409, detail: "That userName is already in use.", scimType: "uniqueness" } };
    db.update(users).set({ email: a.userName }).where(eq(users.id, m.user.id)).run();
  }
  if (a.name !== undefined && a.name !== m.user.name) db.update(users).set({ name: a.name }).where(eq(users.id, m.user.id)).run();
  if (a.externalId !== undefined) db.update(directoryUsers).set({ externalId: a.externalId }).where(and(eq(directoryUsers.companyId, companyId), eq(directoryUsers.userId, m.user.id))).run();
  if (a.active === false) offboardUser(m.user.id);
  else if (a.active === true) reinstateUser(m.user.id);
  const next = managed(companyId, id)!;
  return { ok: true, value: { user: next.user, externalId: next.externalId } };
}

/** DELETE /Users/{id}: switches the person off. Nothing is deleted. */
export function removeUser(companyId: number, id: string): { ok: true } | { error: ScimError } {
  const m = managed(companyId, id);
  if (!m) return { error: { status: 404, detail: "User not found." } };
  offboardUser(m.user.id);
  return { ok: true };
}

/** GET /Users with the filters directories use: `userName eq "x"` and `externalId eq "x"`, paged. */
export function listUsers(companyId: number, filter: string | null, startIndex: number, count: number): Outcome<{ total: number; rows: { user: User; externalId: string }[] }> {
  const all = db.select({ u: users, x: directoryUsers.externalId }).from(directoryUsers).innerJoin(users, eq(users.id, directoryUsers.userId))
    .where(and(eq(directoryUsers.companyId, companyId), eq(users.role, "learner"))).orderBy(asc(users.id)).all();
  let rows = all.map((r) => ({ user: r.u, externalId: r.x }));
  if (filter) {
    const f = /^\s*(userName|externalId)\s+eq\s+"([^"]{1,200})"\s*$/i.exec(filter);
    if (!f) return { error: { status: 400, detail: "Only filters like userName eq \"a@b.com\" are supported.", scimType: "invalidFilter" } };
    const want = f[2].toLowerCase();
    rows = rows.filter((r) => (f[1].toLowerCase() === "username" ? r.user.email : r.externalId).toLowerCase() === want);
  }
  const from = Math.max(1, startIndex), size = Math.min(PAGE_MAX, Math.max(0, count));
  return { ok: true, value: { total: rows.length, rows: rows.slice(from - 1, from - 1 + size) } };
}
