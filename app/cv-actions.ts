"use server";
import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { answerNotes, cvEntries, cvProfiles, cvQuotes, db } from "@/lib/db";
import { realUser, refuseWhileViewingAs, requireUser } from "@/lib/auth";
import { createLink, revokeLink, updateLink } from "@/lib/cv/links";
import { cleanBlock, cleanLine, isEmail, isHexColour, parseJson, safeUrl } from "@/lib/cv/text";
import { ENTRY_KIND_LIST, LIMITS, SECTION_KEYS, TEMPLATES, type EntryKind } from "@/lib/cv/types";
import { allowed, hit } from "@/lib/rate-limit";

/**
 * Everything a person does to their own CV. Each action works as the real signed-in person, never while a super admin is viewing as someone
 * (a CV, and who may read it, is the owner's own), checks that what it touches is theirs, and cleans what it saves. The CV itself stays private
 * until a share link exists (lib/cv/links.ts).
 */
type Res = { error?: string; done?: string } | null;
const BLOCKED: Res = { error: "Exit the view first: your CV is changed as yourself, not as the person you are viewing." };
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function owner() {
  const me = await requireUser();
  if (await refuseWhileViewingAs()) return null;
  const real = await realUser();
  if (!real || real.id !== me.id) return null;
  const key = `cv-write:${me.id}`;
  if (!allowed(key, 400)) return null;
  hit(key, 60 * 60 * 1000);
  return me;
}
const refresh = () => revalidatePath("/profile/cv");

/** "2024-05" or "2024" for a date a person typed, or "" when it is not one. */
const normDate = (v: string) => { const m = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(v.trim()); return m && Number(m[1]) >= 1950 && Number(m[1]) <= 2100 ? v.trim() : ""; };

export async function saveProfileAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const email = cleanLine(fd.get("contactEmail"), LIMITS.email).toLowerCase();
  if (email && !isEmail(email)) return { error: "That email does not look right." };
  const links: { label: string; url: string }[] = [];
  for (const line of text(fd.get("links")).split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [a, b] = line.includes("|") ? [line.slice(0, line.indexOf("|")), line.slice(line.indexOf("|") + 1)] : ["", line];
    const url = safeUrl(b);
    if (!url) return { error: `"${cleanLine(line, 60)}" is not a web address. Use https://… (one per line, optionally "Label | address").` };
    links.push({ label: cleanLine(a, LIMITS.linkLabel), url });
  }
  if (links.length > LIMITS.links) return { error: `Keep it to ${LIMITS.links} links.` };
  const template = TEMPLATES.find((t) => t.key === fd.get("template"))?.key ?? "classic";
  const accent = isHexColour(text(fd.get("accent"))) ? text(fd.get("accent")) : "";
  const phone = cleanLine(fd.get("phone"), LIMITS.phone).replace(/[^\d+()\-\s.]/g, "");
  const row = { headline: cleanLine(fd.get("headline"), LIMITS.headline), summary: cleanBlock(fd.get("summary"), LIMITS.summary), location: cleanLine(fd.get("location"), LIMITS.location), contactEmail: email, phone, links: JSON.stringify(links), template, accent, updatedAt: Math.floor(Date.now() / 1000) };
  db.insert(cvProfiles).values({ userId: me.id, ...row }).onConflictDoUpdate({ target: cvProfiles.userId, set: row }).run();
  refresh();
  return { done: "Saved." };
}

export async function saveEntryAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const kind = ENTRY_KIND_LIST.find((k) => k === fd.get("kind")) as EntryKind | undefined;
  if (!kind) return { error: "Choose what you are adding." };
  const title = cleanLine(fd.get("title"), LIMITS.title);
  if (!title) return { error: kind === "skill" ? "Name the skill." : "Give it a title." };
  const current = fd.get("current") === "on";
  const startsOn = normDate(text(fd.get("startsOn"))), endsOn = current ? "" : normDate(text(fd.get("endsOn")));
  if (text(fd.get("startsOn")).trim() && !startsOn) return { error: "Write the start as 2024 or 2024-05." };
  if (!current && text(fd.get("endsOn")).trim() && !endsOn) return { error: "Write the end as 2024 or 2024-05." };
  if (startsOn && endsOn && endsOn < startsOn) return { error: "The end cannot be before the start." };
  const row = { kind, title, org: cleanLine(fd.get("org"), LIMITS.org), location: cleanLine(fd.get("location"), LIMITS.location), startsOn, endsOn, current, body: cleanBlock(fd.get("body"), LIMITS.body) };
  const id = Number(fd.get("id"));
  if (Number.isInteger(id) && id > 0) {
    const r = db.update(cvEntries).set(row).where(and(eq(cvEntries.id, id), eq(cvEntries.userId, me.id))).returning().get();
    if (!r) return { error: "That entry is not yours." };
  } else {
    const have = db.select({ n: sql<number>`count(*)`, lo: sql<number | null>`min(${cvEntries.sort})` }).from(cvEntries).where(eq(cvEntries.userId, me.id)).get();
    if ((have?.n ?? 0) >= LIMITS.entries) return { error: `That is plenty: ${LIMITS.entries} entries. Remove one first.` };
    db.insert(cvEntries).values({ userId: me.id, ...row, sort: (have?.lo ?? 1) - 1 }).run(); // newest on top
  }
  refresh();
  return { done: "Saved." };
}

export async function deleteEntryAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const r = db.delete(cvEntries).where(and(eq(cvEntries.id, Number(fd.get("id"))), eq(cvEntries.userId, me.id))).returning().get();
  refresh();
  return r ? { done: "Removed." } : { error: "That entry is not yours." };
}

export async function toggleEntryAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const e = db.select().from(cvEntries).where(and(eq(cvEntries.id, Number(fd.get("id"))), eq(cvEntries.userId, me.id))).get();
  if (!e) return { error: "That entry is not yours." };
  db.update(cvEntries).set({ visible: !e.visible }).where(eq(cvEntries.id, e.id)).run();
  refresh();
  return { done: e.visible ? "Hidden from your CV." : "Back on your CV." };
}

/** Moves an entry up or down among those of its own kind. */
export async function moveEntryAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const e = db.select().from(cvEntries).where(and(eq(cvEntries.id, Number(fd.get("id"))), eq(cvEntries.userId, me.id))).get();
  if (!e) return { error: "That entry is not yours." };
  const same = db.select().from(cvEntries).where(and(eq(cvEntries.userId, me.id), eq(cvEntries.kind, e.kind))).orderBy(asc(cvEntries.sort), asc(cvEntries.id)).all();
  const i = same.findIndex((x) => x.id === e.id), j = fd.get("dir") === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= same.length) return { done: "Already there." };
  const order = same.map((x) => x.id);
  [order[i], order[j]] = [order[j], order[i]];
  db.transaction((tx) => { order.forEach((id, n) => tx.update(cvEntries).set({ sort: same[0].sort + n }).where(eq(cvEntries.id, id)).run()); });
  refresh();
  return { done: "Moved." };
}

/** Leaves a platform item (a certificate, a skill, a quote, the highlights line) off the CV, or puts it back. */
export async function toggleHiddenAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const key = text(fd.get("key"));
  if (!/^(?:(?:cert|skill|quote):\d{1,9}|stat:highlights)$/.test(key)) return { error: "Not something on your CV." };
  const have = parseJson<string[]>(db.select({ h: cvProfiles.hidden }).from(cvProfiles).where(eq(cvProfiles.userId, me.id)).get()?.h ?? "[]", []);
  const next = have.includes(key) ? have.filter((k) => k !== key) : [...have, key];
  const hidden = JSON.stringify(next.slice(0, 500));
  db.insert(cvProfiles).values({ userId: me.id, hidden }).onConflictDoUpdate({ target: cvProfiles.userId, set: { hidden } }).run();
  refresh();
  return { done: have.includes(key) ? "Back on your CV." : "Hidden from your CV." };
}

/** Features, or stops featuring, a reviewer's praise on the CV. Only praise whose author allowed quoting, and only on the learner's own notes. */
export async function featureQuoteAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const noteId = Number(fd.get("noteId"));
  if (fd.get("on") === "0") { db.delete(cvQuotes).where(and(eq(cvQuotes.noteId, noteId), eq(cvQuotes.userId, me.id))).run(); refresh(); return { done: "No longer featured." }; }
  const n = db.select().from(answerNotes).where(eq(answerNotes.id, noteId)).get();
  if (!n || n.learnerId !== me.id || n.deletedAt || !n.quotable || n.kind !== "praise") return { error: "That praise cannot be featured." };
  db.insert(cvQuotes).values({ userId: me.id, noteId }).onConflictDoNothing().run();
  refresh();
  return { done: "Featured on your CV." };
}

// ---- share links

function chosenView(fd: FormData) {
  if (fd.get("custom") !== "1") return {};
  const sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, fd.get(`sec_${k}`) === "on"]));
  return { sections, contact: { email: fd.get("c_email") === "on", phone: fd.get("c_phone") === "on", location: fd.get("c_location") === "on", links: fd.get("c_links") === "on" } };
}

export async function createLinkAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const r = await createLink(me.id, { label: fd.get("label"), kind: fd.get("kind"), preset: fd.get("preset"), passcode: fd.get("passcode"), days: fd.get("days"), allowPdf: fd.get("allowPdf") === "on", indexable: fd.get("indexable") === "on", ...chosenView(fd) });
  if ("error" in r) return r;
  refresh();
  return { done: "Link created. Copy it from the list below." };
}

export async function updateLinkAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const r = updateLink(me.id, Number(fd.get("id")), { label: fd.get("label"), days: fd.get("days") === "keep" ? undefined : fd.get("days") === "none" ? "none" : fd.get("days"), allowPdf: fd.get("allowPdf") === "on", indexable: fd.get("indexable") === "on", ...chosenView(fd) });
  if ("error" in r) return r;
  refresh();
  return { done: "Saved." };
}

export async function revokeLinkAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner();
  if (!me) return BLOCKED;
  const r = revokeLink(me.id, Number(fd.get("id")));
  if ("error" in r) return r;
  refresh();
  return { done: "Revoked. The link no longer works." };
}
