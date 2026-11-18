/**
 * Checks leaving dates off a CV for one reader: npm run check:cvdates (uses DATABASE_FILE or data/gglearn.db; makes one throwaway person and removes them).
 * Years of study and the dates of old jobs can be left off per link, everything else still shows, and a link made before this existed shows every date.
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { cvEntries, cvLinks, db, users } from "../lib/db";
import { buildCv } from "../lib/cv/build";
import { createLink, updateLink, viewOf } from "../lib/cv/links";
import { DEFAULT_DATES, OLD_YEARS, PRESETS, datesOf, type View } from "../lib/cv/types";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const year = new Date().getUTCFullYear(), cutoff = year - OLD_YEARS;

const u = db.insert(users).values({ email: "t-dates@cvdates.check", name: "T Dates", jobRole: "developer" }).returning().get();
const row = (kind: "experience" | "education", title: string, startsOn: string, endsOn = "", current = false) => ({ userId: u.id, kind, title, org: "Org", startsOn, endsOn, current });

async function main() {
  try {
    db.insert(cvEntries).values([
      row("experience", "Current job", "2012-03", "", true), row("experience", "Recent job", "2019-01", "2023-06"),
      row("experience", "Old job", "2001-01", "2007-12"), row("experience", `Ended ${cutoff}`, "2005-01", `${cutoff}-05`), row("experience", `Ended before ${cutoff}`, "2005-01", `${cutoff - 1}-12`),
      row("education", "Old degree", "2002-09", "2005-06"), row("education", "Recent course", `${year - 2}-09`, `${year - 1}-06`),
    ]).run();
    const dates = (view: View) => Object.fromEntries(buildCv(u.id, view, "https://x.test")!.sections.flatMap((s) => s.items).filter((i) => i.title).map((i) => [i.title, i.dates]));
    const withDates = (d?: Partial<View["dates"]>): View => ({ ...PRESETS.full.view, dates: d ? { ...DEFAULT_DATES, ...d } : undefined });

    const all = dates(withDates());
    check("a view with no dates setting shows every date, as before", Object.values(all).every(Boolean) && all["Old degree"] === "Sep 2002 – Jun 2005");
    const noStudy = dates(withDates({ education: false }));
    check("study years can be left off: courses stay, their dates go, jobs keep theirs", "Old degree" in noStudy && noStudy["Old degree"] === undefined && noStudy["Recent course"] === undefined && noStudy["Old job"] !== undefined && noStudy["Current job"] !== undefined);
    const noOld = dates(withDates({ older: false }));
    check("old dates can be left off: what ended long ago loses its dates, recent and current keep them", noOld["Old job"] === undefined && noOld["Recent job"] !== undefined && noOld["Current job"] !== undefined && noOld["Old degree"] === undefined && noOld["Recent course"] !== undefined);
    check("the cut is exactly fifteen years: ending in the cut-off year shows, the year before does not", noOld[`Ended ${cutoff}`] !== undefined && noOld[`Ended before ${cutoff}`] === undefined);
    const none = dates(withDates({ education: false, older: false }));
    check("with both off only recent work shows dates", none["Old degree"] === undefined && none["Recent course"] === undefined && none["Old job"] === undefined && none["Recent job"] !== undefined && none["Current job"] !== undefined);
    const doc = buildCv(u.id, withDates({ education: false, older: false }), "https://x.test")!;
    check("nothing but the dates is taken away: the titles, places and sections are all still there", doc.sections.find((s) => s.key === "education")!.items.length === 2 && doc.sections.find((s) => s.key === "experience")!.items.length === 5 && doc.sections.flatMap((s) => s.items).every((i) => !i.title || i.subtitle === "Org"));
    check("the owner's own full view is unaffected", datesOf(PRESETS.full.view).education && datesOf(PRESETS.full.view).older);

    check("a link made before this existed (no dates stored) shows every date", JSON.stringify(viewOf({ sections: "{}", contact: "{}" }).dates) === JSON.stringify(DEFAULT_DATES) && JSON.stringify(viewOf({ sections: "{}", contact: "{}", dates: "{}" }).dates) === JSON.stringify(DEFAULT_DATES));
    check("only an explicit false hides, and a damaged value shows", viewOf({ sections: "{}", contact: "{}", dates: '{"older":false}' }).dates!.older === false && viewOf({ sections: "{}", contact: "{}", dates: '{"older":false}' }).dates!.education === true && viewOf({ sections: "{}", contact: "{}", dates: "not json" }).dates!.older === true && viewOf({ sections: "{}", contact: "{}", dates: '{"older":"no"}' }).dates!.older === true);

    const made = await createLink(u.id, { kind: "private", label: "Recruiter", dates: { older: false } });
    check("a new link keeps the choice and leaves the rest as the preset has it", "link" in made && viewOf(made.link).dates!.older === false && viewOf(made.link).dates!.education === true);
    if ("link" in made) {
      const kept = updateLink(u.id, made.link.id, { label: "Recruiter 2" });
      check("saving a link without saying anything about dates keeps its choice", "link" in kept && viewOf(kept.link).dates!.older === false);
      const changed = updateLink(u.id, made.link.id, { dates: { education: false } });
      check("changing one date setting leaves the other as it was", "link" in changed && viewOf(changed.link).dates!.education === false && viewOf(changed.link).dates!.older === false);
      const back = updateLink(u.id, made.link.id, { dates: { older: true, education: true } });
      check("and both can be put back", "link" in back && JSON.stringify(viewOf(back.link).dates) === JSON.stringify(DEFAULT_DATES));
    }

    const page = src("app/(site)/profile/cv/page.tsx"), act = src("app/cv-actions.ts");
    check("the create form and the full view form both offer the date boxes", (page.match(/<DatesBoxes /g) ?? []).length === 2 && page.includes('name="datesForm"') && page.includes('name="d_education"') && page.includes('name="d_older"'));
    check("the action only changes dates when the form said it was showing them", /datesForm"\) === "1"/.test(act) && /d_education/.test(act) && /d_older/.test(act));
  } finally {
    db.delete(cvLinks).where(eq(cvLinks.userId, u.id)).run();
    db.delete(cvEntries).where(eq(cvEntries.userId, u.id)).run();
    db.delete(users).where(eq(users.id, u.id)).run();
  }
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
}
main();
