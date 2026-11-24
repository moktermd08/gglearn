/**
 * Checks that a person can take their stories out and erase them and their CV: npm run check:erase (uses DATABASE_FILE or data/gglearn.db; makes two
 * throwaway people and removes them and their rows). The export holds only the person's own words, erasing removes all of theirs and none of anyone else's, and the actions
 * ask for confirmation and act as the person.
 */
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { cvComments, cvEndorsements, cvEntries, cvLinkDays, cvLinks, cvProfiles, cvReviewers, db, starApplications, starPicks, starStories, users } from "../lib/db";
import { eraseCv } from "../lib/cv/erase";
import { eraseStories, exportStories } from "../lib/star/data";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const story = { situation: "s", task: "t", action: "a", result: "r" };

function main() {
  // two throwaway people made here and removed after, so a real person's data is never touched
  const tag0 = `erase-check-${Date.now()}`;
  const [a, b] = ["a", "b"].map((x) => db.insert(users).values({ email: `${tag0}-${x}@example.invalid`, name: `Erase check ${x}` }).returning().get());
  const storyIds: number[] = [], appIds: number[] = [];
  try {
    for (const [u, tag] of [[a, "mine"], [b, "theirs"]] as const) {
      const s = db.insert(starStories).values({ userId: u.id, title: `erase check ${tag}`, ...story }).returning().get(); storyIds.push(s.id);
      const app = db.insert(starApplications).values({ userId: u.id, title: `erase check job ${tag}` }).returning().get(); appIds.push(app.id);
      db.insert(starPicks).values({ applicationId: app.id, behaviour: "pace", storyId: s.id, answer: `words ${tag}` }).run();
      db.insert(cvProfiles).values({ userId: u.id, headline: `erase check ${tag}` }).onConflictDoUpdate({ target: cvProfiles.userId, set: { headline: `erase check ${tag}` } }).run();
      db.insert(cvEntries).values({ userId: u.id, kind: "experience", title: `erase check ${tag}` }).run();
      { const l = db.insert(cvLinks).values({ userId: u.id, label: `erase check ${tag}`, kind: "private", nonce: "n", sections: "{}", contact: "{}" }).returning().get(); db.insert(cvLinkDays).values({ linkId: l.id, day: 1, views: 2, pdfs: 1 }).run(); }
    }
    db.insert(cvReviewers).values({ userId: a.id, reviewerId: b.id }).run();
    db.insert(cvComments).values({ userId: a.id, reviewerId: b.id, section: "summary", body: "erase check comment" }).run();
    db.insert(cvEndorsements).values({ userId: a.id, authorId: b.id, status: "approved", relationship: "mentor", body: "erase check reference about a" }).run();
    db.insert(cvEndorsements).values({ userId: b.id, authorId: a.id, status: "approved", relationship: "mentor", body: "erase check reference a wrote about b" }).run();

    const out = exportStories(a.id), text = JSON.stringify(out);
    check("the export holds the person's stories and applications with their wording", out.stories.some((s) => s.title === "erase check mine") && out.applications[0].answers[0].tailoredAnswer === "words mine" && out.applications[0].answers[0].storyTitle === "erase check mine");
    check("the export holds nothing of anyone else's", !text.includes("erase check theirs") && !text.includes("words theirs") && !("userId" in out.stories[0]));

    const gone = eraseStories(a.id);
    check("erasing stories removes this person's stories, applications and answers", gone.stories >= 1 && gone.applications >= 1 && exportStories(a.id).stories.length === 0 && exportStories(a.id).applications.length === 0 && db.select().from(starPicks).where(inArray(starPicks.applicationId, appIds)).all().every((p) => p.answer === "words theirs"));
    check("erasing stories leaves everyone else's", exportStories(b.id).stories.some((s) => s.title === "erase check theirs") && exportStories(b.id).applications.some((x) => x.answers.length === 1));

    const cv = eraseCv(a.id);
    check("erasing the CV removes the profile, entries, links, reviewers, comments and references about the person", cv.entries >= 1 && cv.links >= 1 && cv.references >= 1 && cv.comments >= 1
      && !db.select().from(cvProfiles).where(eq(cvProfiles.userId, a.id)).get() && !db.select().from(cvEntries).where(eq(cvEntries.userId, a.id)).all().length && !db.select().from(cvLinks).where(eq(cvLinks.userId, a.id)).all().length
      && !db.select().from(cvReviewers).where(eq(cvReviewers.userId, a.id)).all().length && !db.select().from(cvEndorsements).where(eq(cvEndorsements.userId, a.id)).all().length);
    check("erasing the CV leaves another person's CV and the reference this person wrote for them", !!db.select().from(cvProfiles).where(eq(cvProfiles.userId, b.id)).get() && db.select().from(cvEntries).where(eq(cvEntries.userId, b.id)).all().length >= 1 && db.select().from(cvLinks).where(eq(cvLinks.userId, b.id)).all().length >= 1 && db.select().from(cvEndorsements).where(eq(cvEndorsements.userId, b.id)).all().length === 1);
    check("erasing the CV also removes the link view counts, and only this person's", !db.select().from(cvLinkDays).innerJoin(cvLinks, eq(cvLinks.id, cvLinkDays.linkId)).where(eq(cvLinks.userId, a.id)).all().length && db.select().from(cvLinkDays).innerJoin(cvLinks, eq(cvLinks.id, cvLinkDays.linkId)).where(eq(cvLinks.userId, b.id)).all().length === 1);
    check("erasing twice is harmless", eraseStories(a.id).stories === 0 && eraseCv(a.id).entries === 0);
  } finally {
    db.delete(cvComments).where(eq(cvComments.body, "erase check comment")).run();
    for (const u of [a, b]) {
      db.delete(cvReviewers).where(eq(cvReviewers.userId, u.id)).run();
      db.delete(cvEndorsements).where(eq(cvEndorsements.authorId, u.id)).run();
      db.delete(cvLinkDays).where(inArray(cvLinkDays.linkId, db.select({ id: cvLinks.id }).from(cvLinks).where(eq(cvLinks.userId, u.id)))).run();
      db.delete(cvLinks).where(eq(cvLinks.userId, u.id)).run();
    }
    for (const u of [a, b]) { db.delete(cvEntries).where(eq(cvEntries.userId, u.id)).run(); }
    db.delete(cvProfiles).where(inArray(cvProfiles.userId, [a.id, b.id])).run();
    if (appIds.length) { db.delete(starPicks).where(inArray(starPicks.applicationId, appIds)).run(); db.delete(starApplications).where(inArray(starApplications.id, appIds)).run(); }
    if (storyIds.length) db.delete(starStories).where(inArray(starStories.id, storyIds)).run();
    db.delete(users).where(inArray(users.id, [a.id, b.id])).run();
  }

  const sa = src("app/star-actions.ts"), ca = src("app/cv-actions.ts"), route = src("app/(site)/profile/behaviours/export/route.ts");
  check("both erase actions act as the person and need the word erase", /eraseStoriesAction[\s\S]*?owner\("eraseStoriesAction"\)[\s\S]*?"erase"/.test(sa) && /eraseCvAction[\s\S]*?owner\("eraseCvAction"\)[\s\S]*?"erase"/.test(ca));
  check("the stories download is signed-in only, private, uncached and not indexed", route.includes("currentUser()") && route.includes("private, no-store") && route.includes("noindex"));
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
}
main();
