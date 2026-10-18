/**
 * Checks the ordered learning journey and its hard / soft lock: npm run check:journey (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows).
 * Needs the journey columns: run `npm run db:push` first.
 */
import { eq, like } from "drizzle-orm";
import { companies, db, enrollments, runs, userScopes, users } from "../lib/db";
import { catalog, resetCatalogCache } from "../lib/paths";
import { journeyFor, orderLockFor, settingFor } from "../lib/journeyLock";
import { UNLOCK_LEVEL, journeyState, rankOf, stagesOf } from "../lib/lifecycle/order";
import { loadRoles } from "../lib/lifecycle/roles";

process.env.CATALOG_TTL_MS = "0"; // the script changes passes directly, so it must never read a cached catalogue
let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? ` (${extra})` : ""}`); };

// ---- the order itself (no database) ----
{
  const s = stagesOf(["sdlc-security", "html-titan", "css-titan", "nodejs-titan", "mysql-titan", "react-titan", "governance-compliance", "not-a-known-track"]);
  check("stages run lowest rank first", s.map((x) => x.rank).join() === [...s.map((x) => x.rank)].sort((a, b) => a - b).join());
  check("tracks with one rank share a stage", s.find((x) => x.tracks.includes("html-titan"))!.tracks.includes("css-titan"));
  check("governance is the first stage, security after backend", s[0].tracks[0] === "governance-compliance" && rankOf("sdlc-security") > rankOf("nodejs-titan") && rankOf("nodejs-titan") > rankOf("react-titan") && rankOf("mysql-titan") > rankOf("nodejs-titan"));
  check("an unknown track sits in the middle", rankOf("not-a-known-track") === 50);
  const reach = { a: 20, b: 20, c: 3 };
  const st = [{ n: 1, rank: 1, tracks: ["a"] }, { n: 2, rank: 2, tracks: ["b"] }, { n: 3, rank: 3, tracks: ["c"] }];
  const js = journeyState(st, { a: 5 }, reach);
  check("stage 1 done unlocks stage 2", js[0].state === "done" && js[1].state === "current" && js[2].state === "locked");
  check("a locked stage names what it waits on", journeyState(st, {}, reach)[2].waitingOn.join() === "a");
  check("a track that can only reach level 3 needs level 3, not 5", journeyState(st, { a: 5, b: 5, c: 3 }, reach)[2].state === "done" && journeyState(st, { a: 5, b: 5, c: 2 }, reach)[2].state === "current");
  check("a track with no questions never blocks", journeyState(st, { a: 5, b: 5 }, { ...reach, c: 0 })[2].state === "done");
}

// ---- the lock, against the database ----
const cat = catalog();
const company0 = db.select().from(companies).orderBy(companies.id).get()!;
const company = company0;
const original = company.journeyLock;
const mk = (email: string, r: "admin" | "manager" | "learner", jobRole: string, audience: "staff" | "customer" = "staff") => {
  const u = db.insert(users).values({ email, name: email, role: r, jobRole, audience }).returning().get();
  db.insert(userScopes).values({ userId: u.id, kind: "company", refId: company.id }).run();
  return u;
};
const idOf = (slug: string) => cat.find((c) => c.slug === slug)!.id;
const pass = (userId: number, slug: string, level: number) => db.insert(runs).values({ userId, trackId: idOf(slug), level, passed: true, score: 1, finishedAt: Math.floor(Date.now() / 1000) }).run();

(async () => {
  try {
    const set = (v: "choice" | "hard" | "soft") => db.update(companies).set({ journeyLock: v }).where(eq(companies.id, company.id)).run();
    set("choice");
    const dev = mk("j-dev@check.local", "learner", "full stack developer");
    const stages = journeyFor(dev.id)!.stages.map((g) => ({ tracks: g.tracks.map((t) => t.slug) }));
    check("full stack developer has an ordered journey of several stages", stages.length >= 5, String(stages.length));
    const first = stages[0].tracks, second = stages[1].tracks, last = stages[stages.length - 1].tracks;
    const flat = stages.flatMap((g) => g.tracks);
    check("git and html come before javascript, then node, then databases, testing, servers and security", ["html-titan", "javascript-titan", "nodejs-titan", "mysql-titan", "sdlc-testing", "sdlc-devops", "sdlc-security"].every((t, i, arr) => i === 0 || flat.indexOf(t) >= flat.indexOf(arr[i - 1])));
    check("awareness tracks the ladder asks for at a low level are not gated", !flat.includes("brand-positioning-voice"));
    check("for an engineer, product management comes after the build skills", flat.indexOf("product-management-core") > flat.indexOf("nodejs-titan"));
    check("the default company setting is a lock people can switch", settingFor(dev.id) === "choice");

    // day one
    let j = journeyFor(dev.id)!;
    check("a new learner is on stage 1", j.current === 1 && j.locked);
    check("they cannot start a security track", !!orderLockFor(dev.id, idOf(last[0])));
    check("they can start a foundations track", !orderLockFor(dev.id, idOf(first[0])));
    check("the lock names what to pass first", (j.locks[last[0]]?.waitingOn.length ?? 0) > 0 && j.locks[last[0]].waitingOn.every((w) => first.includes(w.slug)));
    check("stage 2 is locked too, not just the last", !!j.locks[second[0]]);

    // pass stage 1 -> stage 2 opens, the last stays locked
    for (const t of first) pass(dev.id, t, UNLOCK_LEVEL);
    j = journeyFor(dev.id)!;
    check("passing stage 1 opens stage 2", !orderLockFor(dev.id, idOf(second[0])) && j.current === 2);
    check("the last stage is still locked", !!orderLockFor(dev.id, idOf(last[0])));

    // a placement check counts, so someone can test out
    for (const s of stages.slice(1, -1)) for (const t of s.tracks) {
      db.insert(enrollments).values({ userId: dev.id, trackId: idOf(t), placedLevel: UNLOCK_LEVEL, placedAt: 1 }).onConflictDoUpdate({ target: [enrollments.userId, enrollments.trackId], set: { placedLevel: UNLOCK_LEVEL } }).run();
    }
    check("testing out of the middle stages opens the last one", !orderLockFor(dev.id, idOf(last[0])));

    // started is never locked
    const dev2 = mk("j-dev2@check.local", "learner", "full stack developer");
    pass(dev2.id, last[0], 1);
    check("a track already started is never locked", !orderLockFor(dev2.id, idOf(last[0])));

    // soft by choice, hard and soft by company
    db.update(users).set({ journeyMode: "soft" }).where(eq(users.id, dev2.id)).run();
    const dev3 = mk("j-dev3@check.local", "learner", "full stack developer");
    db.update(users).set({ journeyMode: "soft" }).where(eq(users.id, dev3.id)).run();
    j = journeyFor(dev3.id)!;
    check("a learner can choose any order when the company allows it", !j.locked && Object.keys(j.locks).length === 0 && j.canSwitch);
    check("the recommended order is still shown when not locked", Object.keys(j.advice).length > 0);
    check("and nothing is blocked", !orderLockFor(dev3.id, idOf(last[0])));
    set("hard");
    j = journeyFor(dev3.id)!;
    check("a hard company setting overrides a learner's choice", j.locked && !j.canSwitch && !!orderLockFor(dev3.id, idOf(last[0])));
    set("soft");
    j = journeyFor(dev3.id)!;
    check("a soft company setting never locks", !j.locked && !orderLockFor(dev.id, idOf(last[0])) && !j.canSwitch);
    set("choice");

    // who it applies to
    const mgr = mk("j-mgr@check.local", "manager", "full stack developer");
    check("managers are never locked", !orderLockFor(mgr.id, idOf(last[0])));
    const cust = mk("j-cust@check.local", "learner", "full stack developer", "customer");
    check("customers have no journey", journeyFor(cust.id) === null);
    const none = mk("j-none@check.local", "learner", "general");
    check("someone with no role ladder has no journey", journeyFor(none.id) === null);

    // every role with a ladder has a journey whose first stage is open
    resetCatalogCache();
    const bad: string[] = [];
    for (const r of loadRoles()) {
      const u = mk(`j-r-${r.key.replace(/ /g, "-")}@check.local`, "learner", r.key);
      const jr = journeyFor(u.id);
      if (!jr || jr.stages.length === 0) { bad.push(`${r.name}: no journey`); continue; }
      const free = jr.stages[0].tracks.some((t) => !jr.locks[t.slug]);
      if (!free) bad.push(`${r.name}: nothing to start`);
    }
    check(`all ${loadRoles().length} roles open with something to start`, bad.length === 0, bad.slice(0, 4).join("; "));
  } finally {
    db.update(companies).set({ journeyLock: original }).where(eq(companies.id, company.id)).run();
    for (const u of db.select().from(users).where(like(users.email, "j-%@check.local")).all()) {
      db.delete(runs).where(eq(runs.userId, u.id)).run();
      db.delete(enrollments).where(eq(enrollments.userId, u.id)).run();
      db.delete(userScopes).where(eq(userScopes.userId, u.id)).run();
      db.delete(users).where(eq(users.id, u.id)).run();
    }
  }
  console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
  process.exit(fails ? 1 : 0);
})();
