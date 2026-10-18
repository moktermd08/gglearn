/**
 * Search matching and ranking with nothing else attached, so it can be tested exactly. A query is split into words; an item matches when every word
 * appears somewhere in its text (any order, any case, accents ignored). Better matches come first: a title that starts with the query, then a title
 * with a word that starts with it, then a title containing it, then a match only in the other words.
 */
export const MIN_QUERY = 2, MAX_QUERY = 60;

export const normalise = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ").replace(/\s+/g, " ").trim();
export const words = (q: string) => normalise(q.slice(0, MAX_QUERY)).split(" ").filter(Boolean);

/** Does every word of the query appear in the text? */
export const matches = (q: string, ...texts: string[]): boolean => {
  const ws = words(q), hay = normalise(texts.join(" "));
  return ws.length > 0 && ws.every((w) => hay.includes(w));
};

/** Lower is better. Only meaningful for items that matched. */
export function rank(q: string, title: string, rest = ""): number {
  const t = normalise(title), full = normalise(q.slice(0, MAX_QUERY)), ws = words(q);
  if (t === full) return 0;
  if (t.startsWith(full)) return 1;
  if (ws.every((w) => t.split(" ").some((tw) => tw.startsWith(w)))) return 2;
  if (ws.every((w) => t.includes(w))) return 3;
  return normalise(rest).length ? 4 : 5;
}

export type Hit = { title: string; sub: string; href: string; kind: "page" | "topic" | "race" | "team" | "certificate" };

/** Sorts hits by rank, then alphabetically, and keeps the first `limit`. */
export function best<T extends { title: string }>(q: string, items: { item: T; rest?: string }[], limit: number): T[] {
  return items.map((x) => ({ x, r: rank(q, x.item.title, x.rest) })).sort((a, b) => a.r - b.r || a.x.item.title.localeCompare(b.x.item.title)).slice(0, limit).map((e) => e.x.item);
}
