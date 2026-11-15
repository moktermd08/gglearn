/**
 * Checks the behaviour stories: npm run check:star (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows. Run db:push first).
 * The coach says the right things, stories and applications are only ever read for their owner, a pack follows the story it was built from,
 * deleting a story keeps tailored wording, the PDF is valid, and none of this can reach the public CV.
 */
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db, starApplications, starPicks, starStories, users } from "../lib/db";
import { reviewStory } from "../lib/star/coach";
import { BEHAVIOURS, composeAnswer, wordCount } from "../lib/star/framework";
import { applicationOf, buildPack, coverage, packText, storiesOf, storyOf } from "../lib/star/data";
import { renderPack } from "../lib/star/pdf";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

async function main() {
  const good = { situation: "In my team of six, calls about the new form doubled in two weeks and waits passed 20 minutes.", task: "I had to bring the wait under 10 minutes this month without extra staff.", action: "I listed the ten most common queries, wrote a one-page guide with plain answers, and trained the team in a short huddle. I asked the form owners to fix the two unclear questions, and I checked the wait times every morning to see whether it was working. I learnt to test a fix with a small group first.", result: "Waits fell to 7 minutes within two weeks and repeat calls dropped by 30%. I now share every guide with the other sites." };
  const g = reviewStory(good);
  check("a clear first-person story with a number has no fixes", g.ready && g.tips.every((t) => t.level !== "fix"));
  check("an empty story is not ready and every part is asked for", !reviewStory({ situation: "", task: "", action: "", result: "" }).ready && reviewStory({ situation: "", task: "", action: "", result: "" }).tips.length >= 4);
  const we = reviewStory({ ...good, action: "We listed the common queries and we wrote a guide. We trained everyone and we asked the owners to fix the form. We checked the wait times together every morning and our team learnt a lot from it." });
  check("saying we more than I is a fix on the action", we.tips.some((t) => t.level === "fix" && t.part === "action"));
  check("a result with no measure gets a suggestion, not a block", reviewStory({ ...good, result: "It went well and everyone was pleased with the way things turned out in the end." }).tips.some((t) => t.part === "result" && t.level === "improve"));
  check("word counting is exact", wordCount("  one two\nthree  ") === 3 && wordCount("") === 0);
  // edge cases from real people (docs/star/design.md): other scripts, short clear parts, leaders, loose number words
  check("Chinese text without spaces is counted by word, not as one", wordCount("我在联络中心管理一个六人团队并把等待时间缩短到七分钟") >= 8);
  const bn = reviewStory({ situation: "আমি একটি ছয় জনের দল পরিচালনা করতাম এবং কলের সংখ্যা দ্বিগুণ হয়েছিল", task: "আমাকে অপেক্ষার সময় দশ মিনিটের নিচে আনতে হবে", action: "আমি প্রশ্নগুলো তালিকা করেছি এবং একটি নির্দেশিকা লিখেছি আর দলকে প্রশিক্ষণ দিয়েছি এবং প্রতিদিন সকালে অপেক্ষার সময় পরীক্ষা করেছি", result: "অপেক্ষার সময় সাত মিনিটে নেমেছে এবং ৩০% কম ফোন এসেছে" });
  check("a story in Bengali is not blocked by the English first-person rule", bn.ready && !bn.tips.some((t) => t.level === "fix"));
  check("a short but complete action is advice, not a block", reviewStory({ ...good, action: "I rewrote the call script, trained all six advisers in a twenty minute huddle, and checked the wait times every morning for two weeks, changing the script twice." }).ready);
  check("a part with only a few words is still a fix", !reviewStory({ ...good, action: "I did it." }).ready);
  const lead = reviewStory({ ...good, action: "I set our plan and briefed the team every morning. I agreed our targets with the director, I coached two new starters, I removed a blocker with our supplier, and I asked the team to review progress weekly so that our team owned the result." });
  check("our and the team do not count as we", lead.ready);
  check("“all” is not a measurable result", reviewStory({ ...good, result: "It was all fine in the end and I learned a lot from it." }).tips.some((t) => t.part === "result" && t.level === "improve"));
  check("a number written as a word counts as a measure", !reviewStory({ ...good, result: "Waits fell to seven minutes and I now share the guide with other sites." }).tips.some((t) => t.text.startsWith("Add a measurable")));
  check("composeAnswer joins the four parts in order", composeAnswer(good).split("\n\n").length === 4 && composeAnswer(good).startsWith("In my team"));
  check("every behaviour has a title, a gist and prompts", BEHAVIOURS.length === 9 && BEHAVIOURS.every((b) => b.title && b.gist && b.prompts.length >= 3));

  // ---- data: two people, one story each
  const [a, b] = db.select().from(users).limit(2).all();
  if (!a || !b) { console.log("FAIL needs two users in the database"); process.exit(1); }
  const made: number[] = [], apps: number[] = [];
  try {
    const s = db.insert(starStories).values({ userId: a.id, title: "check story", ...good, behaviours: JSON.stringify(["delivering", "pace", "bogus", "decisions"]), ready: true }).returning().get();
    made.push(s.id);
    check("a behaviour key that is not in the framework is dropped on read", storyOf(a.id, s.id)!.behaviours.join() === "pace,decisions");
    check("someone else cannot read the story", storyOf(b.id, s.id) === null && !storiesOf(b.id).some((x) => x.id === s.id));
    check("coverage counts ready stories per behaviour", coverage(storiesOf(a.id)).find((c) => c.key === "pace")!.ready >= 1);

    const app = db.insert(starApplications).values({ userId: a.id, title: "check job", wordLimit: 60 }).returning().get();
    apps.push(app.id);
    db.insert(starPicks).values([{ applicationId: app.id, behaviour: "pace", storyId: s.id }, { applicationId: app.id, behaviour: "leadership" }, { applicationId: app.id, behaviour: "decisions", storyId: s.id, answer: "My tailored words for this job." }]).run();
    check("someone else cannot open the application or its pack", applicationOf(b.id, app.id) === null && buildPack(b.id, app.id) === null);
    const pack = buildPack(a.id, app.id)!;
    check("the pack follows the story, uses tailored wording when there is some, and lists what is missing", pack.entries.length === 2 && pack.entries.find((e) => e.behaviour === "pace")!.answer === composeAnswer(good) && pack.entries.find((e) => e.behaviour === "decisions")!.tailored && pack.missing.join() === "Leadership");
    check("a pack entry over the limit says by how much", pack.entries.find((e) => e.behaviour === "pace")!.over === wordCount(composeAnswer(good)) - 60);
    check("plain text export has the job, the statements and what is missing", packText(pack, "statements").includes("check job") && packText(pack, "statements").includes("Still to cover: Leadership") && packText(pack, "cue").includes("S: In my team"));

    const bytes = await renderPack(pack, "statements", { name: "Test Person" });
    const pdf = await PDFDocument.load(bytes);
    check("the pack PDF is a valid document", pdf.getPageCount() >= 1 && bytes.length > 1000);
    const hostile = await renderPack({ ...pack, job: "Analyst \u0000 <script> ñ 漢字", entries: [{ ...pack.entries[0], answer: "x".repeat(5000) + " é 漢" }] }, "cue", {});
    check("hostile text and a very long answer do not break the PDF", (await PDFDocument.load(hostile)).getPageCount() >= 1);
    const withCv = await renderPack(pack, "statements", { cv: bytes });
    check("a CV can be put in front of the pack", (await PDFDocument.load(withCv)).getPageCount() === pdf.getPageCount() * 2);

    db.update(starPicks).set({ storyId: null }).where(eq(starPicks.storyId, s.id)).run();
    db.delete(starStories).where(eq(starStories.id, s.id)).run(); made.length = 0;
    const after = buildPack(a.id, app.id)!;
    check("after the story is deleted the tailored wording is kept and the untailored pick is listed as missing", after.entries.length === 1 && after.entries[0].answer === "My tailored words for this job." && after.missing.includes("Delivering at Pace"));
  } finally {
    if (apps.length) db.delete(starPicks).where(inArray(starPicks.applicationId, apps)).run();
    if (apps.length) db.delete(starApplications).where(inArray(starApplications.id, apps)).run();
    if (made.length) db.delete(starStories).where(inArray(starStories.id, made)).run();
  }

  // ---- the source: what must stay true
  const act = src("app/star-actions.ts");
  check("every action works as the person and logs a view-as use", act.includes("actingUser()") && act.includes("logViewAsUse(") && (act.match(/const me = await owner\("\w+"\);/g) ?? []).length >= 5);
  check("every action that changes a row scopes it to the owner", /eq\(starStories\.userId, me\.id\)/.test(act) && /eq\(starApplications\.userId, me\.id\)/.test(act));
  check("stories never reach the CV builder or its pages", !["lib/cv/build.ts", "lib/cv/export.ts", "lib/cv/pdf.ts", "app/(cv)/cv/[token]/page.tsx"].some((f) => /lib\/star|star[A-Z]\w+|star_(stories|applications|picks)/.test(src(f))));
  check("downloads are private, uncached and not indexed", src("app/(site)/profile/behaviours/applications/[id]/export/route.ts").includes("private, no-store") && src("app/(site)/profile/behaviours/applications/[id]/export/route.ts").includes("noindex"));
  check("nothing is rendered as HTML", !src("components/star/StoryForm.tsx").includes("dangerouslySetInnerHTML") && !src("components/star/PickEditor.tsx").includes("dangerouslySetInnerHTML"));
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
}
main();
