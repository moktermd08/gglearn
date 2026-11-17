/**
 * Checks the date order of CV entries: npm run check:cvorder (uses DATABASE_FILE or data/gglearn.db; makes two throwaway people and removes them).
 * An entry lands where its dates belong when the list was in date order, a list the person arranged by hand is left alone, "newest first" sorts
 * on request, and nothing here touches another person or a kind without dates.
 */
import { readFileSync } from "node:fs";
import { asc, eq, inArray } from "drizzle-orm";
import { cvEntries, db, users } from "../lib/db";
import { DATED_KINDS, arrange, arrangeAfterSave, inDateOrder, newestFirst } from "../lib/cv/order";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const d = (startsOn: string, endsOn = "", current = false, id = 0) => ({ id, startsOn, endsOn, current });

check("what is current comes first, then the later end, then the later start", newestFirst(d("2020-01", "", true), d("2023-01", "2024-01")) < 0 && newestFirst(d("2020-01", "2022-06"), d("2018-01", "2021-06")) < 0 && newestFirst(d("2021-03", "2022-06"), d("2019-03", "2022-06")) < 0);
check("a year alone counts as the end of that year for an end date", newestFirst(d("2019", "2024"), d("2023-01", "2024-05")) < 0 && newestFirst(d("2019", "2024"), d("2023-01", "2024-11")) < 0 && newestFirst(d("2019", "2024"), d("2023-01", "2025-01")) > 0);
check("an entry with no dates goes last, two with none stay as they were", newestFirst(d(""), d("2000")) > 0 && newestFirst(d("2000"), d("")) < 0 && newestFirst(d(""), d("")) === 0);
check("a list is in date order only when each is no older than the next", inDateOrder([d("2022", "", true), d("2020", "2021")]) && !inDateOrder([d("2018", "2019"), d("2022", "2023")]) && inDateOrder([]));

const made: number[] = [];
const person = (tag: string) => { const u = db.insert(users).values({ email: `t-${tag}@cvorder.check`, name: `T ${tag}`, jobRole: "developer" }).returning().get(); made.push(u.id); return u; };
const add = (userId: number, sort: number, title: string, startsOn: string, endsOn = "", current = false, kind: "experience" | "skill" = "experience") =>
  db.insert(cvEntries).values({ userId, kind, title, startsOn, endsOn, current, sort }).returning().get();
const titles = (userId: number, kind = "experience") => db.select().from(cvEntries).where(eq(cvEntries.userId, userId)).orderBy(asc(cvEntries.sort), asc(cvEntries.id)).all().filter((e) => e.kind === kind).map((e) => e.title).join(",");

try {
  const a = person("a"), b = person("b");
  add(a.id, 1, "Now", "2022-01", "", true); add(a.id, 2, "Before", "2019-01", "2021-12"); add(a.id, 3, "First", "2015-01", "2018-12");
  const old = add(a.id, 0, "Old job added last", "2010-01", "2013-12"); // lands on top, as a new entry does
  check("a new old job in a list that was in date order goes where its dates belong", arrange(a.id, "experience", { changedId: old.id }) && titles(a.id) === "Now,Before,First,Old job added last");
  const newest = add(a.id, -5, "Added without its id", "2008-01", "2009-12"); // a new entry: the caller does not know its id
  check("a new entry is found by the action without being told its id", arrangeAfterSave(a.id, "experience") && titles(a.id) === "Now,Before,First,Old job added last,Added without its id");
  db.delete(cvEntries).where(eq(cvEntries.id, newest.id)).run();
  const mid = add(a.id, -1, "Gap filler", "2014-01", "2014-12");
  arrange(a.id, "experience", { changedId: mid.id });
  check("one that falls in the middle goes in the middle", titles(a.id) === "Now,Before,First,Gap filler,Old job added last");
  check("a current job stays on top", db.select().from(cvEntries).where(eq(cvEntries.userId, a.id)).orderBy(asc(cvEntries.sort)).get()!.title === "Now");

  add(b.id, 1, "Hand one", "2010-01", "2011-01"); add(b.id, 2, "Hand two", "2022-01", "2023-01");
  const fresh = add(b.id, 0, "Fresh", "2015-01", "2016-01");
  check("a list arranged by hand is left alone, and the new entry stays on top", arrange(b.id, "experience", { changedId: fresh.id }) === false && titles(b.id) === "Fresh,Hand one,Hand two");
  check("newest first sorts it when the person asks", arrange(b.id, "experience", { force: true }) && titles(b.id) === "Hand two,Fresh,Hand one");
  check("sorting again moves nothing", arrange(b.id, "experience", { force: true }) === false);

  const one = db.select().from(cvEntries).where(eq(cvEntries.title, "Before")).get()!;
  db.update(cvEntries).set({ startsOn: "2011-01", endsOn: "2012-06" }).where(eq(cvEntries.id, one.id)).run();
  check("editing the dates of one moves it when the list was in date order", arrange(a.id, "experience", { changedId: one.id }) && titles(a.id) === "Now,First,Gap filler,Old job added last,Before");
  const now = db.select().from(cvEntries).where(eq(cvEntries.title, "Now")).get()!;
  db.update(cvEntries).set({ current: false, startsOn: "2010-01", endsOn: "2012-01" }).where(eq(cvEntries.id, now.id)).run();
  check("a job that has ended no longer stays on top", arrange(a.id, "experience", { changedId: now.id }) && titles(a.id) === "First,Gap filler,Old job added last,Before,Now");

  add(a.id, 10, "Zeta", "", "", false, "skill"); add(a.id, 11, "Alpha", "", "", false, "skill");
  check("skills and other kinds without dates are never rearranged", arrange(a.id, "skill", { force: true }) === false && titles(a.id, "skill") === "Zeta,Alpha" && !DATED_KINDS.includes("skill"));
  check("one person's order never moves another's", titles(b.id) === "Hand two,Fresh,Hand one");

  const act = src("app/cv-actions.ts"), page = src("app/(site)/profile/cv/page.tsx");
  check("saving an entry arranges it, and the sort action works as the person and only for dated kinds", /arrangeAfterSave\(me\.id, kind,/.test(act) && /sortEntriesAction[\s\S]*?owner\("sortEntriesAction"\)[\s\S]*?DATED_KINDS\.find/.test(act));
  check("the page offers newest first only when a list is out of order", page.includes("!inDateOrder(mine)") && page.includes("sortEntriesAction"));
} finally {
  db.delete(cvEntries).where(inArray(cvEntries.userId, made)).run();
  db.delete(users).where(inArray(users.id, made)).run();
}
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
