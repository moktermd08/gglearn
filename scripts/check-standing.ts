/**
 * Checks the goal assessment: title vs verified level, and career goals as route targets. npm run check:standing
 * (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows).
 */
import { eq, like } from "drizzle-orm";
import { db, promotions, runs, userScopes, users } from "../lib/db";
import { resetCatalogCache } from "../lib/paths";
import { rolesWithLadders } from "../lib/careers";
import { careerTarget, standingFor, targetFor } from "../lib/careerTarget";
import { careerSlug, parseCareerSlug, standing, verifiedLevel } from "../lib/standing";

process.env.CATALOG_TTL_MS = "0";
let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? ` (${extra})` : ""}`); };

// ---- the rules (no database) ----
check("nothing met proves nothing", verifiedLevel([{ level: 1, counted: 2, met: 1 }, { level: 2, counted: 2, met: 2 }]) === null);
check("the verified level is the last fully met rung in a row", verifiedLevel([{ level: 1, counted: 2, met: 2 }, { level: 2, counted: 1, met: 1 }, { level: 3, counted: 2, met: 1 }, { level: 4, counted: 1, met: 1 }]) === 2);
check("a rung with nothing to measure neither proves nor blocks", verifiedLevel([{ level: 1, counted: 1, met: 1 }, { level: 2, counted: 0, met: 0 }, { level: 3, counted: 1, met: 1 }]) === 3);
check("rungs out of order give the same answer", verifiedLevel([{ level: 2, counted: 1, met: 1 }, { level: 1, counted: 1, met: 1 }]) === 2);
const ladder = [1, 2, 3, 4];
check("with no promotion the person sits on the bottom rung by default", standing(ladder, null, null).level === 1 && standing(ladder, null, null).basis === "default");
check("the promotion decides the title, whatever the exams say", standing(ladder, 3, 1).level === 3 && standing(ladder, 3, 1).basis === "authority");
check("a title above the exams is title-ahead and counts the rungs", standing(ladder, 4, 2).agreement === "title-ahead" && standing(ladder, 4, 2).rungsApart === 2);
check("exams above the title is verified-ahead", standing(ladder, 2, 4).agreement === "verified-ahead" && standing(ladder, 2, 4).level === 2);
check("the same level is agreement", standing(ladder, 3, 3).agreement === "agree");
check("no exam evidence is unverified, not a mismatch", standing(ladder, 3, null).agreement === "unverified");
check("a goal slug round-trips, spaces and all", JSON.stringify(parseCareerSlug(careerSlug("Lead Developer", 3))) === JSON.stringify({ role: "lead developer", level: 3 }));
check("anything else is not a goal slug", parseCareerSlug("uk-civil-service-ao") === null && parseCareerSlug("career~x~y") === null);

// ---- against the database ----
const mk = (email: string, jobRole: string) => db.insert(users).values({ email, name: email, role: "learner", jobRole, audience: "staff" }).returning().get();
const sweep = () => {
  for (const u of db.select().from(users).where(like(users.email, "st-%@check.local")).all()) {
    db.delete(promotions).where(eq(promotions.userId, u.id)).run();
    db.delete(runs).where(eq(runs.userId, u.id)).run();
    db.delete(userScopes).where(eq(userScopes.userId, u.id)).run();
    db.delete(users).where(eq(users.id, u.id)).run();
  }
};
sweep();
try {
  const roles = rolesWithLadders();
  const role = roles.includes("developer") ? "developer" : roles[0];
  if (!role) { console.log("skip database checks: no career ladders loaded"); }
  else {
    const dev = mk("st-dev@check.local", role);
    resetCatalogCache();
    const s0 = standingFor(dev);
    check("a person with a ladder has a standing", !!s0 && s0.role === role);
    check("with no promotion and no exams they are on the bottom rung, unverified", !!s0 && s0.basis === "default" && s0.verified === null && s0.agreement === "unverified");

    const top = [...s0!.titles.keys()].sort((a, b) => a - b).at(-1)!;
    const goal = top > s0!.level ? careerTarget(dev, role, top) : null;
    check("a goal further up the ladder becomes a route target with areas to check", !!goal && goal.areas.length > 0 && goal.slug === careerSlug(role, top), goal ? String(goal.areas.length) : "no target");
    check("each stage is a rung on the way", !!goal && goal.stages!.length >= 1 && goal.areas.every((a) => a.stage! >= 1 && a.stage! <= goal.stages!.length));
    check("no area asks for more than one entry per track", !!goal && new Set(goal.areas.map((a) => a.trackSlug)).size === goal.areas.length);
    check("targetFor finds a goal by its slug", !!goal && targetFor(goal.slug, dev)?.slug === goal.slug);
    check("targetFor finds nothing for a goal at or below where they are", careerTarget(dev, role, s0!.level) === null);
    check("targetFor finds nothing for an unknown slug", targetFor("nope", dev) === null);

    if (top > s0!.level) {
      db.insert(promotions).values({ userId: dev.id, jobRole: role, level: top, decidedBy: dev.id, note: "check" }).run();
      const s1 = standingFor(dev)!;
      check("a promotion sets the title and wins over the exams", s1.level === top && s1.basis === "authority");
      check("with no exams behind it the title is ahead of what is verified or unverified", s1.agreement === "title-ahead" || s1.agreement === "unverified");
    }
  }
} finally { sweep(); }
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
