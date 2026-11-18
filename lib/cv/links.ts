import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { cvLinkDays, cvLinks, db, users } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { LIMITS, LINK_KINDS, PRESETS, SECTION_KEYS, datesOf, type ContactView, type DatesView, type LinkKind, type PresetKey, type View } from "@/lib/cv/types";
import { cleanLine, parseJson } from "@/lib/cv/text";

/**
 * Share links for a CV. The token is `${id}.${signature}`: the signature is an HMAC of the id and a random nonce kept in the row, so nothing
 * secret is stored, a guessed or counted-up id is useless, and the owner can copy the link again later. Revoking, or the end date, stops it
 * at once. A passcode link also needs a code the owner tells the reader; only a salted hash of it is kept. Anything that is not a live link
 * is treated exactly like no link at all (the caller answers 404).
 */
export type Link = typeof cvLinks.$inferSelect;
const nowSec = () => Math.floor(Date.now() / 1000);
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (id: number, nonce: string) => createHmac("sha256", secret()).update(`cvlink:${id}:${nonce}`).digest("base64url").slice(0, 32);

export const tokenOf = (l: Pick<Link, "id" | "nonce">) => `${l.id}.${sign(l.id, l.nonce)}`;
export const pathOf = (l: Pick<Link, "id" | "nonce">) => `/cv/${tokenOf(l)}`;

/** The row behind a token if the token is genuine, whatever state the link is in. */
export function linkByToken(raw: string): Link | null {
  const m = /^(\d{1,9})\.([A-Za-z0-9_-]{32})$/.exec(raw);
  if (!m) return null;
  const l = db.select().from(cvLinks).where(eq(cvLinks.id, Number(m[1]))).get();
  if (!l) return null;
  const want = Buffer.from(sign(l.id, l.nonce)), got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? l : null;
}

export type LinkState = "open" | "revoked" | "expired";
export const stateOf = (l: Link, t = nowSec()): LinkState => (l.revokedAt ? "revoked" : l.expiresAt != null && l.expiresAt <= t ? "expired" : "open");

/** The live link behind a token (genuine, not revoked, not expired, owner still active), or null. */
export function openLink(raw: string): Link | null {
  const l = linkByToken(raw);
  if (!l || stateOf(l) !== "open") return null;
  const owner = db.select({ s: users.status }).from(users).where(eq(users.id, l.userId)).get();
  return owner?.s === "active" ? l : null;
}

/** What this link shows, with anything missing treated as hidden. */
export function viewOf(l: Pick<Link, "sections" | "contact"> & Partial<Pick<Link, "dates">>): View {
  const s = parseJson<Record<string, unknown>>(l.sections, {}), c = parseJson<Record<string, unknown>>(l.contact, {}), d = parseJson<Record<string, unknown>>(l.dates ?? "{}", {});
  return {
    sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, s[k] === true])) as View["sections"],
    contact: { email: c.email === true, phone: c.phone === true, location: c.location === true, links: c.links === true },
    dates: { education: d.education !== false, older: d.older !== false }, // anything not said shows
  };
}

export const DAYS = [7, 30, 90, 180, 365] as const;
export type LinkInput = { label?: unknown; kind?: unknown; preset?: unknown; sections?: Record<string, boolean>; contact?: Partial<ContactView>; dates?: Partial<DatesView>; passcode?: unknown; days?: unknown; allowPdf?: unknown; indexable?: unknown };

function viewFrom(i: LinkInput, kind: LinkKind): View {
  const base = PRESETS[(i.preset as PresetKey) in PRESETS ? (i.preset as PresetKey) : kind === "public" ? "public" : "recruiter"].view;
  const sections = { ...base.sections }, contact = { ...base.contact };
  if (i.sections) for (const k of SECTION_KEYS) if (typeof i.sections[k] === "boolean") sections[k] = i.sections[k];
  if (i.contact) for (const k of ["email", "phone", "location", "links"] as const) if (typeof i.contact[k] === "boolean") contact[k] = i.contact[k]!;
  const dates = datesOf(base);
  if (i.dates) for (const k of ["education", "older"] as const) if (typeof i.dates[k] === "boolean") dates[k] = i.dates[k]!;
  return { sections, contact, dates };
}

/** A new share link. Returns why it was refused, or the row. */
export async function createLink(userId: number, i: LinkInput): Promise<{ error: string } | { link: Link }> {
  const kind = LINK_KINDS.find((k) => k === i.kind);
  if (!kind) return { error: "Choose the kind of link." };
  const label = cleanLine(i.label, LIMITS.label);
  const active = db.select({ id: cvLinks.id }).from(cvLinks).where(and(eq(cvLinks.userId, userId), isNull(cvLinks.revokedAt))).all().length;
  if (active >= LIMITS.activeLinks) return { error: `You already have ${LIMITS.activeLinks} live links. Revoke one you no longer need.` };
  let passHash = "";
  if (kind === "passcode") {
    const code = typeof i.passcode === "string" ? i.passcode.trim() : "";
    if (code.length < LIMITS.passcodeMin) return { error: `The passcode needs at least ${LIMITS.passcodeMin} characters.` };
    if (code.length > LIMITS.passcodeMax) return { error: `Keep the passcode under ${LIMITS.passcodeMax} characters.` };
    passHash = await hashPassword(code);
  }
  const days = DAYS.find((d) => d === Number(i.days));
  const view = viewFrom(i, kind);
  const row = db.insert(cvLinks).values({
    userId, label, kind, nonce: randomBytes(12).toString("base64url"), passHash, sections: JSON.stringify(view.sections), contact: JSON.stringify(view.contact), dates: JSON.stringify(view.dates),
    allowPdf: i.allowPdf !== false && i.allowPdf !== "off", indexable: kind === "public" && (i.indexable === true || i.indexable === "on"), expiresAt: days ? nowSec() + days * 86400 : null,
  }).returning().get();
  return { link: row };
}

/** Changes what a link shows, its label, PDF permission and end date. The kind and passcode stay as they were (make a new link for a different kind). */
export function updateLink(userId: number, id: number, i: LinkInput): { error: string } | { link: Link } {
  const l = db.select().from(cvLinks).where(and(eq(cvLinks.id, id), eq(cvLinks.userId, userId))).get();
  if (!l) return { error: "That link is not yours." };
  if (l.revokedAt) return { error: "That link has been revoked." };
  const view = viewFrom({ ...i, preset: undefined, sections: { ...viewOf(l).sections, ...(i.sections ?? {}) }, contact: { ...viewOf(l).contact, ...(i.contact ?? {}) }, dates: { ...viewOf(l).dates, ...(i.dates ?? {}) } }, l.kind);
  const days = i.days === "none" ? null : DAYS.find((d) => d === Number(i.days));
  const row = db.update(cvLinks).set({
    label: i.label === undefined ? l.label : cleanLine(i.label, LIMITS.label), sections: JSON.stringify(view.sections), contact: JSON.stringify(view.contact), dates: JSON.stringify(view.dates),
    allowPdf: i.allowPdf === undefined ? l.allowPdf : i.allowPdf === true || i.allowPdf === "on",
    indexable: l.kind === "public" && (i.indexable === undefined ? l.indexable : i.indexable === true || i.indexable === "on"),
    expiresAt: i.days === undefined ? l.expiresAt : days ? nowSec() + days * 86400 : null,
  }).where(eq(cvLinks.id, l.id)).returning().get();
  return { link: row };
}

export function revokeLink(userId: number, id: number): { error: string } | { done: true } {
  const r = db.update(cvLinks).set({ revokedAt: nowSec() }).where(and(eq(cvLinks.id, id), eq(cvLinks.userId, userId), isNull(cvLinks.revokedAt))).returning().get();
  return r ? { done: true } : { error: "That link is already gone, or is not yours." };
}

/** Link previews, crawlers and monitors fetch a page without anyone reading it. They are not counted. */
export const looksAutomated = (ua: string | null | undefined) => !ua || /bot|crawl|spider|slurp|preview|fetch|monitor|scan|curl|wget|python|node|java|go-http|facebookexternalhit|whatsapp|slack|discord|telegram|linkedin|skype|embedly|headless/i.test(ua);

const DAY_KEEP = 90;
const dayNo = (t = nowSec()) => Math.floor(t / 86400);

/** Counts one reader, or one PDF download. Only counts and times: no address, no browser, no account. Pruned to the last 90 days. */
export function recordView(id: number, what: "view" | "pdf" = "view", t = nowSec()) {
  const d = dayNo(t), v = what === "view" ? 1 : 0, p = what === "pdf" ? 1 : 0;
  db.insert(cvLinkDays).values({ linkId: id, day: d, views: v, pdfs: p })
    .onConflictDoUpdate({ target: [cvLinkDays.linkId, cvLinkDays.day], set: { views: sql`${cvLinkDays.views} + ${v}`, pdfs: sql`${cvLinkDays.pdfs} + ${p}` } }).run();
  if (what === "view") db.update(cvLinks).set({ views: sql`${cvLinks.views} + 1`, lastViewedAt: sql`max(coalesce(${cvLinks.lastViewedAt}, 0), ${t})` }).where(eq(cvLinks.id, id)).run();
  if (Math.random() < 0.02) db.delete(cvLinkDays).where(and(eq(cvLinkDays.linkId, id), lt(cvLinkDays.day, d - DAY_KEEP))).run();
}

/** The last `days` days for one of the owner's own links, oldest first, with empty days filled in. Null when the link is not theirs. */
export function historyOf(userId: number, linkId: number, days = 30, t = nowSec()): { day: number; views: number; pdfs: number }[] | null {
  const l = db.select({ id: cvLinks.id }).from(cvLinks).where(and(eq(cvLinks.id, linkId), eq(cvLinks.userId, userId))).get();
  if (!l) return null;
  const end = dayNo(t), from = end - days + 1;
  const rows = new Map(db.select().from(cvLinkDays).where(and(eq(cvLinkDays.linkId, linkId), gte(cvLinkDays.day, from))).all().map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => { const r = rows.get(from + i); return { day: (from + i) * 86400, views: r?.views ?? 0, pdfs: r?.pdfs ?? 0 }; });
}

// ---- the passcode gate: after the right code, a short-lived signed cookie for that link alone
const GATE_HOURS = 12;
const gateMac = (id: number, exp: number) => createHmac("sha256", secret()).update(`cvgate:${id}:${exp}`).digest("base64url").slice(0, 32);
export const gateName = (id: number) => `cvk${id}`;
export const gateValue = (id: number, t = nowSec()) => { const exp = t + GATE_HOURS * 3600; return `${exp}.${gateMac(id, exp)}`; };
export const GATE_SECONDS = GATE_HOURS * 3600;
export function gateOpen(id: number, cookie: string | undefined, t = nowSec()): boolean {
  const m = /^(\d{9,12})\.([A-Za-z0-9_-]{32})$/.exec(cookie ?? "");
  if (!m || Number(m[1]) <= t) return false;
  const want = Buffer.from(gateMac(id, Number(m[1]))), got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** The view the owner asks to preview or download: "full", "public", "recruiter", or the id of one of their own links. Anything else is the full CV. */
export function viewForOwner(userId: number, as: string | undefined): { view: View; label: string; link: Link | null } {
  if (as === "public" || as === "recruiter" || as === "full") return { view: PRESETS[as].view, label: PRESETS[as].label, link: null };
  const id = Number(as);
  const l = Number.isInteger(id) && id > 0 ? db.select().from(cvLinks).where(and(eq(cvLinks.id, id), eq(cvLinks.userId, userId))).get() : undefined;
  return l ? { view: viewOf(l), label: l.label || "Link", link: l } : { view: PRESETS.full.view, label: PRESETS.full.label, link: null };
}
