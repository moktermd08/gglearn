import { and, eq, isNull, sql } from "drizzle-orm";
import { db, termBanks, termExamAnswers, terms } from "@/lib/db";
import { parseTermInput, sameTerm } from "@/lib/terms";
import type { SetupState } from "@/lib/setup";

/**
 * What a super admin does to the term bank. The caller (app/(admin)/admin/terms/actions.ts) has already checked that the person is a super admin;
 * these only check the input, so they can be used and tested without a session.
 */

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(fd.get(k));
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const rolesOf = (s: string) => [...new Set(s.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean))].join(",");
const similarOf = (s: string) => JSON.stringify([...new Set(s.split(/[;,]/).map((x) => x.trim()).filter(Boolean))].slice(0, 12));
const now = () => Math.floor(Date.now() / 1000);

/** A bank's name, what it is for, and the job roles it suits (comma separated; empty means everyone). A new bank also gets its address from its name. */
export function saveBank(fd: FormData): SetupState {
  const id = num(fd, "id"), name = text(fd, "name"), description = text(fd, "description"), roles = rolesOf(text(fd, "roles"));
  if (name.length < 2 || name.length > 60) return { error: "Give the bank a name of 2 to 60 characters." };
  if (description.length > 300) return { error: "Keep the description under 300 characters." };
  if (Number.isInteger(id) && id > 0) {
    if (!db.select({ id: termBanks.id }).from(termBanks).where(eq(termBanks.id, id)).get()) return { error: "That bank no longer exists." };
    db.update(termBanks).set({ name, description, roles }).where(eq(termBanks.id, id)).run();
    return { done: "Bank saved." };
  }
  const slug = slugOf(name);
  if (!slug) return { error: "Use letters or numbers in the name." };
  if (db.select({ id: termBanks.id }).from(termBanks).where(eq(termBanks.slug, slug)).get()) return { error: "A bank with that name already exists." };
  const order = (db.select({ m: sql<number>`coalesce(max(${termBanks.sortOrder}), 0)` }).from(termBanks).get()?.m ?? 0) + 1;
  db.insert(termBanks).values({ slug, name, description, roles, sortOrder: order }).run();
  return { done: `Bank “${name}” created.` };
}

const duplicate = (bankId: number | null, ownerUserId: number | null, term: string, exceptId = 0) => {
  const rows = bankId != null
    ? db.select({ id: terms.id, term: terms.term }).from(terms).where(and(eq(terms.bankId, bankId), isNull(terms.ownerUserId))).all()
    : db.select({ id: terms.id, term: terms.term }).from(terms).where(and(isNull(terms.bankId), eq(terms.ownerUserId, ownerUserId ?? -1))).all();
  return rows.some((r) => r.id !== exceptId && sameTerm(r.term, term));
};

/** Adds a term to a bank, or changes one (when `id` is sent): its words, meaning, group, rank, look-alikes, bank and whether it is shown. */
export function saveTerm(fd: FormData): SetupState {
  const p = parseTermInput({ term: fd.get("term"), meaning: fd.get("meaning"), tier: fd.get("tier"), groupName: fd.get("groupName") });
  if ("error" in p) return p;
  const bankId = num(fd, "bankId"), id = num(fd, "id");
  if (!db.select({ id: termBanks.id }).from(termBanks).where(eq(termBanks.id, bankId)).get()) return { error: "Choose a bank." };
  const similar = similarOf(text(fd, "similar"));
  const status = text(fd, "status") === "hidden" ? "hidden" : "active";
  if (Number.isInteger(id) && id > 0) {
    const cur = db.select().from(terms).where(eq(terms.id, id)).get();
    if (!cur || cur.ownerUserId != null) return { error: "That term no longer exists." };
    if (duplicate(bankId, null, p.ok.term, id)) return { error: "That bank already has a term with those words." };
    db.update(terms).set({ bankId, term: p.ok.term, meaning: p.ok.meaning, tier: p.ok.tier, groupName: p.ok.groupName, similar, status, updatedAt: now() }).where(eq(terms.id, id)).run();
    return { done: `“${p.ok.term}” saved.` };
  }
  if (duplicate(bankId, null, p.ok.term)) return { error: "That bank already has a term with those words." };
  const order = (db.select({ m: sql<number>`coalesce(max(${terms.sortOrder}), 0)` }).from(terms).where(eq(terms.bankId, bankId)).get()?.m ?? 0) + 1;
  db.insert(terms).values({ bankId, term: p.ok.term, meaning: p.ok.meaning, tier: p.ok.tier, groupName: p.ok.groupName, similar, status, sortOrder: order }).run();
  return { done: `“${p.ok.term}” added.` };
}

/** Takes a term out of use. A term that has been asked in someone's check is hidden (their results keep pointing at it); one that never was is deleted. */
export function removeTerm(id: number): SetupState {
  const cur = db.select().from(terms).where(eq(terms.id, id)).get();
  if (!cur) return { error: "That term no longer exists." };
  const asked = db.select({ n: sql<number>`count(*)` }).from(termExamAnswers).where(eq(termExamAnswers.termId, id)).get()?.n ?? 0;
  if (asked > 0) { db.update(terms).set({ status: "hidden", updatedAt: now() }).where(eq(terms.id, id)).run(); return { done: `“${cur.term}” hidden: it has been asked in checks, so it is kept.` }; }
  db.delete(terms).where(eq(terms.id, id)).run();
  return { done: `“${cur.term}” deleted.` };
}

/** Moves a candidate's own term into a shared bank. If the bank already has that term the candidate's copy is simply hidden. */
export function promoteTerm(id: number, bankId: number, groupName: string): SetupState {
  const cur = db.select().from(terms).where(eq(terms.id, id)).get();
  if (!cur || cur.ownerUserId == null) return { error: "That is not a candidate's own term." };
  if (!db.select({ id: termBanks.id }).from(termBanks).where(eq(termBanks.id, bankId)).get()) return { error: "Choose a bank to add it to." };
  if (duplicate(bankId, null, cur.term)) {
    db.update(terms).set({ status: "hidden", updatedAt: now() }).where(eq(terms.id, id)).run();
    return { done: `That bank already has “${cur.term}”, so the candidate's copy was hidden.` };
  }
  const order = (db.select({ m: sql<number>`coalesce(max(${terms.sortOrder}), 0)` }).from(terms).where(eq(terms.bankId, bankId)).get()?.m ?? 0) + 1;
  db.update(terms).set({ bankId, ownerUserId: null, groupName: groupName.trim().slice(0, 60) || cur.groupName, sortOrder: order, updatedAt: now() }).where(eq(terms.id, id)).run();
  return { done: `“${cur.term}” is now in the shared bank, and everyone can be tested on it.` };
}
