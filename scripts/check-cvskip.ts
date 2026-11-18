/**
 * Checks leaving some jobs or courses off a CV for one reader: npm run check:cvskip (uses DATABASE_FILE or data/gglearn.db; makes two throwaway people and
 * removes them). A link can leave off entries the owner has, the rest of the CV is untouched, and it can never touch another person's entries.
 */
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { cvEntries, cvLinks, db, users } from "../lib/db";
import { buildCv } from "../lib/cv/build";
import { createLink, updateLink, viewOf } from "../lib/cv/links";
import { PRESETS, SKIP_MAX, skipOf, type View } from "../lib/cv/types";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

const [a, b] = ["a", "b"].map((x) => db.insert(users).values({ email: `t-${x}@cvskip.check`, name: `T Skip ${x}`, jobRole: "developer" }).returning().get());
const add = (userId: number, kind: "experience" | "education" | "project" | "skill", title: string) => db.insert(cvEntries).values({ userId, kind, title, org: "Org", startsOn: "2020-01" }).returning().get();

async function main() {
  try {
    const j1 = add(a.id, "experience", "Cabinet job"), j2 = add(a.id, "experience", "Bar work"), j3 = add(a.id, "experience", "Analyst job"), e1 = add(a.id, "education", "BA"), p1 = add(a.id, "project", "Side project"), s1 = add(a.id, "skill", "Excel");
    const theirs = add(b.id, "experience", "Their job");
    const titles = (view: View) => buildCv(a.id, view, "https://x.test")!.sections.flatMap((s) => s.items).map((i) => i.title).filter(Boolean);
    const full = PRESETS.full.view;

    check("a view with no skip list shows everything, as before", ["Cabinet job", "Bar work", "Analyst job", "BA", "Side project", "Excel"].every((t) => titles(full).includes(t)));
    const t2 = titles({ ...full, skip: [j2.id] });
    check("a skipped job is gone and everything else stays", !t2.includes("Bar work") && ["Cabinet job", "Analyst job", "BA", "Side project", "Excel"].every((t) => t2.includes(t)));
    const t3 = titles({ ...full, skip: [j1.id, j2.id, j3.id, e1.id] });
    check("leaving off a whole section removes the section, not just its items", !buildCv(a.id, { ...full, skip: [j1.id, j2.id, j3.id] }, "https://x.test")!.sections.some((s) => s.key === "experience") && !t3.includes("BA") && t3.includes("Side project"));
    check("another person's entry id in the list changes nothing", titles({ ...full, skip: [theirs.id] }).length === titles(full).length);
    check("a skipped entry is also gone from the PDF's source document", !JSON.stringify(buildCv(a.id, { ...full, skip: [j2.id] }, "https://x.test")).includes("Bar work"));

    check("the saved list is read carefully: only whole positive numbers, once each", JSON.stringify(viewOf({ sections: "{}", contact: "{}", skip: '[1,2,2,"x",-3,0,1.5,null,{"a":1}]' }).skip) === "[1,2]");
    check("a missing, damaged or wrong-shaped list leaves nothing off", ["{}", "not json", '"abc"', "null"].every((s) => viewOf({ sections: "{}", contact: "{}", skip: s }).skip!.length === 0) && viewOf({ sections: "{}", contact: "{}" }).skip!.length === 0);
    check("a very long list is cut", viewOf({ sections: "{}", contact: "{}", skip: JSON.stringify(Array.from({ length: SKIP_MAX + 100 }, (_, i) => i + 1)) }).skip!.length === SKIP_MAX);
    check("the set helper tolerates no list", skipOf({}).size === 0 && skipOf({ skip: [1, 2] }).has(2));

    const made = await createLink(a.id, { kind: "private", label: "Recruiter", skip: [j2.id, theirs.id, 999999] });
    check("a new link keeps the owner's entries and drops anyone else's and made-up ones", "link" in made && JSON.stringify(viewOf(made.link).skip) === JSON.stringify([j2.id]));
    if ("link" in made) {
      const id = made.link.id;
      check("saving without saying anything about the list keeps it", "link" in updateLink(a.id, id, { label: "Recruiter 2" }) && JSON.stringify(viewOf(db.select().from(cvLinks).where(eq(cvLinks.id, id)).get()!).skip) === JSON.stringify([j2.id]));
      const changed = updateLink(a.id, id, { skip: [j1.id, j3.id, theirs.id] });
      check("a new list replaces the old one, and again only the owner's entries count", "link" in changed && JSON.stringify(viewOf(changed.link).skip?.sort()) === JSON.stringify([j1.id, j3.id].sort()));
      const cleared = updateLink(a.id, id, { skip: [] });
      check("an empty list puts everything back", "link" in cleared && viewOf(cleared.link).skip!.length === 0);
      updateLink(a.id, id, { skip: [j2.id, s1.id] });
      db.delete(cvEntries).where(eq(cvEntries.id, j2.id)).run();
      const pruned = updateLink(a.id, id, { label: "Recruiter 3" });
      check("an entry that has been deleted drops out of the list the next time the link is saved", "link" in pruned && JSON.stringify(viewOf(pruned.link).skip) === JSON.stringify([s1.id]));
      check("another person cannot change this link's list", "error" in updateLink(b.id, id, { skip: [] }));
    }
    check("the owner's own previews are unaffected by any link", titles(PRESETS.full.view).includes("Cabinet job") && !!p1);

    const page = src("app/(site)/profile/cv/page.tsx"), act = src("app/cv-actions.ts");
    check("both the create form and the edit form offer the checklist", (page.match(/<SkipBoxes /g) ?? []).length === 2 && page.includes('name="skipForm"') && page.includes('name="skip"'));
    check("the action only changes the list when the form said it was showing it", /skipForm"\) === "1"/.test(act) && /getAll\("skip"\)/.test(act));
  } finally {
    const ids = [a.id, b.id];
    db.delete(cvLinks).where(inArray(cvLinks.userId, ids)).run();
    db.delete(cvEntries).where(inArray(cvEntries.userId, ids)).run();
    db.delete(users).where(inArray(users.id, ids)).run();
  }
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
}
main();
