/**
 * Checks career breaks on a CV: npm run check:cvbreak (uses DATABASE_FILE or data/gglearn.db; makes one throwaway person and removes them).
 * A break is a line in Experience with dates, a reason only if the person gave one, never a made-up employer, and it shows on every output.
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { cvEntries, db, users } from "../lib/db";
import { buildCv } from "../lib/cv/build";
import { exportJsonResume } from "../lib/cv/export";
import { cleanLine } from "../lib/cv/text";
import { BREAK_REASONS, LIMITS, PRESETS, isCareerBreak } from "../lib/cv/types";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

check("every reason is a plain line that survives cleaning unchanged", BREAK_REASONS.every((r) => cleanLine(r, LIMITS.title) === r));
check("the first reason says nothing about why", BREAK_REASONS[0] === "Career break" && BREAK_REASONS.slice(1).every((r) => r.startsWith("Career break: ")));
check("only a real break is recognised as one", BREAK_REASONS.every(isCareerBreak) && !isCareerBreak("Careers adviser") && !isCareerBreak("Career breakfast club") && !isCareerBreak("Break room designer"));

const u = db.insert(users).values({ email: `t-break@cvbreak.check`, name: "T Break", jobRole: "developer" }).returning().get();
try {
  db.insert(cvEntries).values([
    { userId: u.id, kind: "experience", title: "Policy Adviser", org: "Cabinet Office", startsOn: "2022-03", current: true, sort: 1 },
    { userId: u.id, kind: "experience", title: BREAK_REASONS[1], startsOn: "2019-09", endsOn: "2022-02", body: "Volunteered at a food bank", sort: 2 },
    { userId: u.id, kind: "experience", title: "Career break", startsOn: "2016-01", endsOn: "2016-06", sort: 3 },
  ]).run();
  const cv = buildCv(u.id, PRESETS.public.view, "https://x.test")!;
  const exp = cv.sections.find((s) => s.key === "experience")!;
  const gap = exp.items.find((i) => i.title === BREAK_REASONS[1])!;
  check("a break shows in Experience with its dates and the reason chosen", !!gap && gap.dates === "Sep 2019 – Feb 2022" && gap.body?.[0] === "Volunteered at a food bank");
  check("a break never invents an employer or a place", !gap.subtitle && !exp.items.find((i) => i.title === "Career break")!.subtitle);
  check("a break with no reason says only that", !!exp.items.find((i) => i.title === "Career break" && i.dates === "Jan 2016 – Jun 2016"));
  const json = JSON.stringify(exportJsonResume(u.id, "https://x.test"));
  check("a break is in the JSON Resume export with its dates", json.includes("Career break: caring responsibilities") && json.includes("2019-09"));
} finally {
  db.delete(cvEntries).where(eq(cvEntries.userId, u.id)).run();
  db.delete(users).where(eq(users.id, u.id)).run();
}

const page = src("app/(site)/profile/cv/page.tsx");
check("the form adds to Experience, needs a start date, and the reason is a choice", /function BreakForm[\s\S]*?name="kind" value="experience"[\s\S]*?name="startsOn" required[\s\S]*?name="title"/.test(page));
check("the form is offered only in the Experience section", /kind === "experience" && \(\s*<details>[\s\S]*?<BreakForm \/>/.test(page));
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
