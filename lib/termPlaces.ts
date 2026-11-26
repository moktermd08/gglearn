import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, termAliases, termLinks, termPlaces, terms } from "@/lib/db";
import { slugify } from "@/lib/urlText";

/**
 * The atom library's structure: a term is defined once and sits in any number of banks. `term_places` records where; `terms.bank_id` names the home place.
 * A term with no place recorded yet (a database that has not been filled in with `npm run backfill:atoms`) is where its own columns say, so nothing depends
 * on that script having run.
 */

export type TermRow = typeof terms.$inferSelect;
export type Place = { bankId: number; groupName: string; sortOrder: number };
/** A term and every place it sits. `bankId`, `groupName` and `sortOrder` are those of the first place, which is the home one unless re-placed with `inBank`. */
export type PlacedTerm = TermRow & { places: Place[] };

const parseList = (s: string): string[] => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
};
const nameKey = (s: string) => s.trim().toLowerCase();

/** May this person be shown the term? Hidden, draft and rejected terms are kept from everyone, company terms too until company libraries exist, and a personal term is its owner's alone. */
export const visibleTo = (t: TermRow, userId: number | null) =>
  t.status === "active" && t.review !== "draft" && t.review !== "rejected" && t.companyId == null && (t.ownerUserId == null || t.ownerUserId === userId);

export function withPlaces(rows: TermRow[]): PlacedTerm[] {
  const recorded = new Map<number, Place[]>();
  for (const p of db.select().from(termPlaces).orderBy(asc(termPlaces.bankId)).all()) {
    const list = recorded.get(p.termId) ?? [];
    list.push({ bankId: p.bankId, groupName: p.groupName, sortOrder: p.sortOrder });
    recorded.set(p.termId, list);
  }
  return rows.map((t) => {
    const own: Place[] = t.bankId == null ? [] : [{ bankId: t.bankId, groupName: t.groupName, sortOrder: t.sortOrder }];
    const places = [...(recorded.get(t.id) ?? own)].sort((a, b) => Number(b.bankId === t.bankId) - Number(a.bankId === t.bankId) || a.bankId - b.bankId);
    const home = places[0];
    return home ? { ...t, ...home, places } : { ...t, places };
  });
}

/** The terms that sit in a bank, each described as it appears there. */
export const inBank = (list: PlacedTerm[], bankId: number): PlacedTerm[] =>
  list.flatMap((t) => { const p = t.places.find((x) => x.bankId === bankId); return p ? [{ ...t, ...p }] : []; });

/** Every term that belongs to no one person, whatever its state: what an admin or an import works on. */
export const everyShared = (): PlacedTerm[] => withPlaces(db.select().from(terms).where(isNull(terms.ownerUserId)).orderBy(asc(terms.id)).all());
export const everyInBank = (bankId: number) => inBank(everyShared(), bankId).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

/** A public name for a new atom that no other has: the words of the term, with a number when they are taken. */
export function freeSlug(term: string, taken: Set<string> = new Set(db.select({ s: terms.slug }).from(terms).all().flatMap((r) => (r.s ? [r.s] : [])))): string {
  const base = slugify(term).slice(0, 80) || "term";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Moves a term's place: it leaves `from` (when given) and takes `to`. Its other places stay. */
export function movePlace(termId: number, from: number | null, to: Place) {
  db.transaction((tx) => {
    const gone = from == null ? [to.bankId] : [from, to.bankId];
    tx.delete(termPlaces).where(and(eq(termPlaces.termId, termId), inArray(termPlaces.bankId, gone))).run();
    tx.insert(termPlaces).values({ termId, ...to }).run();
  });
}

/** Which atom each look-alike name means: one in the same bank first, then the earliest public one with those words. */
function resolver(shared: PlacedTerm[]) {
  const byName = new Map<string, PlacedTerm[]>();
  for (const t of shared) (byName.get(nameKey(t.term)) ?? byName.set(nameKey(t.term), []).get(nameKey(t.term))!).push(t);
  return (from: PlacedTerm, name: string) => {
    const found = (byName.get(nameKey(name)) ?? []).filter((t) => t.id !== from.id);
    return found.find((t) => t.places.some((p) => from.places.some((q) => q.bankId === p.bankId))) ?? found[0];
  };
}

/** Rewrites a term's "confused with" links from its list of look-alikes. */
function writeLinks(t: PlacedTerm, find: ReturnType<typeof resolver>) {
  const names = parseList(t.similar), to = new Set<number>(), unknown: string[] = [];
  for (const name of names) { const hit = find(t, name); if (hit) to.add(hit.id); else unknown.push(name); }
  const have = db.select({ to: termLinks.toId }).from(termLinks).where(and(eq(termLinks.fromId, t.id), eq(termLinks.kind, "confused-with"))).all().map((r) => r.to);
  if (have.length === to.size && have.every((id) => to.has(id))) return { added: 0, unknown };
  db.transaction((tx) => {
    tx.delete(termLinks).where(and(eq(termLinks.fromId, t.id), eq(termLinks.kind, "confused-with"))).run();
    for (const id of to) tx.insert(termLinks).values({ fromId: t.id, toId: id, kind: "confused-with" }).run();
  });
  return { added: [...to].filter((id) => !have.includes(id)).length, unknown };
}

/** Gives a shared term that has just been written what every atom has: a public name, its home place and its links. */
export function settleAtom(termId: number) {
  const row = db.select().from(terms).where(eq(terms.id, termId)).get();
  if (!row || row.ownerUserId != null) return;
  if (!row.slug) db.update(terms).set({ slug: freeSlug(row.term) }).where(eq(terms.id, termId)).run();
  if (row.bankId != null) movePlace(termId, null, { bankId: row.bankId, groupName: row.groupName, sortOrder: row.sortOrder });
  const shared = everyShared();
  writeLinks(shared.find((t) => t.id === termId)!, resolver(shared));
}

/** Removes a term and everything that only describes it. The caller has made sure nobody's results point at it. */
export function deleteAtom(termId: number) {
  db.transaction((tx) => {
    tx.delete(termLinks).where(or(eq(termLinks.fromId, termId), eq(termLinks.toId, termId))).run();
    tx.delete(termAliases).where(eq(termAliases.termId, termId)).run();
    tx.delete(termPlaces).where(eq(termPlaces.termId, termId)).run();
    tx.delete(terms).where(eq(terms.id, termId)).run();
  });
}

export type Backfill = { terms: number; slugs: number; places: number; links: number; unknownLookAlikes: string[]; sharedNames: string[] };

/** Fills the new structure in from what each term already says. Adds only what is missing, so it can be run as often as wanted. */
export function backfillAtoms(): Backfill {
  const out: Backfill = { terms: 0, slugs: 0, places: 0, links: 0, unknownLookAlikes: [], sharedNames: [] };
  const rows = db.select().from(terms).where(isNull(terms.ownerUserId)).orderBy(asc(terms.id)).all();
  out.terms = rows.length;
  db.transaction(() => {
    const taken = new Set(rows.flatMap((r) => (r.slug ? [r.slug] : [])));
    const placed = new Set(db.select({ t: termPlaces.termId }).from(termPlaces).all().map((r) => r.t));
    for (const r of rows) {
      if (!r.slug) { const slug = freeSlug(r.term, taken); taken.add(slug); db.update(terms).set({ slug }).where(eq(terms.id, r.id)).run(); out.slugs++; }
      if (r.bankId != null && !placed.has(r.id)) { db.insert(termPlaces).values({ termId: r.id, bankId: r.bankId, groupName: r.groupName, sortOrder: r.sortOrder }).run(); out.places++; }
    }
    const shared = everyShared(), find = resolver(shared);
    for (const t of shared) { const w = writeLinks(t, find); out.links += w.added; out.unknownLookAlikes.push(...w.unknown.map((n) => `${t.term} → ${n}`)); }
    const names = new Map<string, number>();
    for (const t of shared) if (t.status === "active") names.set(nameKey(t.term), (names.get(nameKey(t.term)) ?? 0) + 1);
    out.sharedNames = [...names].filter(([, n]) => n > 1).map(([name]) => name);
  });
  return out;
}
