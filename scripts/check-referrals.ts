/** Checks personal invite links and who counts as brought in: npm run check:referrals (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Needs SESSION_SECRET. */
import { eq, inArray, like } from "drizzle-orm";
import { db, runs, tracks, users } from "../lib/db";
import { referralCode, referralsOf, referrerOf, splitCode } from "../lib/referrals";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@ref.check")).all().map((r) => r.id);
  if (us.length) { db.delete(runs).where(inArray(runs.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
};
sweep();
const t0 = Math.floor(Date.now() / 1000);
try {
  const mk = (n: string, ref: number | null = null) => db.insert(users).values({ name: n, email: `${n}@ref.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x", referredBy: ref }).returning().get();
  const host = mk("host"), a = mk("a", host.id), b = mk("b", host.id), c = mk("c");
  const track = db.select().from(tracks).get()!;

  const code = referralCode(host.id);
  check("a code leads back to its owner", referrerOf(code) === host.id);
  // every code must round-trip, including ones whose signature contains a dash or an underscore
  const roundTrips = Array.from({ length: 400 }, (_, i) => i + 1).filter((id) => referralCode(id).split("-").length > 2 || referralCode(id).includes("_"));
  check("there are codes with a dash in the signature to test", roundTrips.some((id) => referralCode(id).split("-").length > 2));
  check("every code splits back into its id and its own signature, dashes and all", Array.from({ length: 400 }, (_, i) => i + 1).every((id) => { const c = referralCode(id), p = splitCode(c); return !!p && p.id === id && c.endsWith(p.sig) && p.sig.length === 10; }));
  check("a code with a changed id is refused", referrerOf(`${(a.id).toString(36)}-${code.split("-")[1]}`) === null);
  check("a code with a changed signature is refused", referrerOf(`${host.id.toString(36)}-AAAAAAAAAA`) === null);
  check("junk is refused", [null, undefined, "", "x", "a-b", "../..", "1-" + "A".repeat(40), "-1-AAAAAAAAAA"].every((x) => referrerOf(x as string) === null));
  check("a code for a person who no longer exists is refused", referrerOf(referralCode(99999999)) === null);

  check("two friends joined, none passed yet", JSON.stringify(referralsOf(host.id)) === JSON.stringify({ joined: 2, passed: 0 }));
  db.insert(runs).values({ userId: a.id, trackId: track.id, level: 1, score: 0.9, passed: true, finishedAt: t0 }).run();
  db.insert(runs).values({ userId: a.id, trackId: track.id, level: 2, score: 0.9, passed: true, finishedAt: t0 }).run();
  db.insert(runs).values({ userId: b.id, trackId: track.id, level: 1, score: 0.4, passed: false, finishedAt: t0 }).run();
  check("a friend counts once, however many levels they pass", referralsOf(host.id).passed === 1);
  check("a failed exam does not count", referralsOf(host.id).passed === 1);
  check("someone nobody brought in has none", referralsOf(c.id).joined === 0);
  db.insert(runs).values({ userId: b.id, trackId: track.id, level: 1, score: 0.9, passed: true, finishedAt: t0 }).run();
  check("the second friend counts after passing", referralsOf(host.id).passed === 2);
  check("the friend's own count is separate", referralsOf(a.id).joined === 0);
} finally {
  sweep();
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
