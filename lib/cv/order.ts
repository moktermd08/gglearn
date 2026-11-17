import { and, asc, desc, eq } from "drizzle-orm";
import { cvEntries, db } from "@/lib/db";
import type { EntryKind } from "@/lib/cv/types";

/**
 * The order of what a person typed. A CV reads best with the most recent first, but a person who adds an old job last, or comes back after a break,
 * would otherwise get it on top. So for kinds that have dates, an entry is put where its dates belong, as long as that list was already in date order
 * (a person who has arranged theirs by hand keeps their arrangement), and "Put newest first" sorts it on request.
 */
export const DATED_KINDS: EntryKind[] = ["experience", "education", "project", "volunteer", "award"];

type Dated = { id: number; startsOn: string; endsOn: string; current: boolean };
const month = (v: string, pad: string) => (v.length === 4 ? `${v}-${pad}` : v); // "2024" counts as the end of 2024 for an end and the start of 2024 for a start

/** Most recent first: what is current, then the later end, then the later start; with no dates at all, last. */
export function newestFirst(a: Dated, b: Dated): number {
  const end = (e: Dated) => (e.current ? "9999-12" : month(e.endsOn || e.startsOn, "12"));
  const start = (e: Dated) => month(e.startsOn, "01");
  const ea = end(a), eb = end(b);
  if (ea !== eb) return !ea ? 1 : !eb ? -1 : eb.localeCompare(ea);
  const sa = start(a), sb = start(b);
  if (sa !== sb) return !sa ? 1 : !sb ? -1 : sb.localeCompare(sa);
  return 0;
}

export const inDateOrder = (list: Dated[]) => list.every((e, i) => i === 0 || newestFirst(list[i - 1], e) <= 0);

/**
 * Puts one kind of a person's entries in date order. With `changedId`, only when the others were already in date order (so a hand-made arrangement is
 * left alone); with `force`, always. Returns whether anything moved.
 */
export function arrange(userId: number, kind: EntryKind, opts: { changedId?: number; force?: boolean } = {}): boolean {
  if (!DATED_KINDS.includes(kind)) return false;
  const list = db.select().from(cvEntries).where(and(eq(cvEntries.userId, userId), eq(cvEntries.kind, kind))).orderBy(asc(cvEntries.sort), asc(cvEntries.id)).all();
  if (list.length < 2) return false;
  if (!opts.force && !inDateOrder(list.filter((e) => e.id !== opts.changedId))) return false;
  const sorted = list.map((e, i) => ({ e, i })).sort((x, y) => newestFirst(x.e, y.e) || x.i - y.i).map((x) => x.e); // equal dates keep the order they had
  if (sorted.every((e, i) => e.id === list[i].id)) return false;
  const base = list[0].sort;
  db.transaction((tx) => { sorted.forEach((e, n) => tx.update(cvEntries).set({ sort: base + n }).where(eq(cvEntries.id, e.id)).run()); });
  return true;
}

/** After saving one entry: the one edited, or, for a new one (no id yet known to the caller), the newest of its kind. */
export function arrangeAfterSave(userId: number, kind: EntryKind, editedId?: number): boolean {
  const id = editedId ?? db.select({ id: cvEntries.id }).from(cvEntries).where(and(eq(cvEntries.userId, userId), eq(cvEntries.kind, kind))).orderBy(desc(cvEntries.id)).get()?.id;
  return arrange(userId, kind, { changedId: id });
}
