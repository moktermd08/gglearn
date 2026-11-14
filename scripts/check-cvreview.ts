/**
 * Checks mentor and manager comments on a CV draft: npm run check:cvreview (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows;
 * the database parts need a company, and are skipped on an empty database. Run db:push first).
 * No draft without the owner's say-so, no contact details, nobody sees another reviewer's comments, ending access really ends it, and the owner
 * decides what happens to each comment.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { companies, cvComments, cvEntries, cvProfiles, cvReviewers, db, mentorships, notifications, userScopes, users } from "../lib/db";
import { buildCv } from "../lib/cv/build";
import { addComment, commentsByReviewer, commentsForOwner, deleteComment, endReviewer, inviteReviewer, openCommentCount, replyToComment, resolveComment, reviewersOf, toReview, whyNotReviewCv } from "../lib/cv/review";
import { CV_COMMENT, CV_REVIEW_VIEW } from "../lib/cv/types";

process.env.SESSION_SECRET ??= "check-cvreview-secret-0123456789abcdef";
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const form = (o: Record<string, string | number>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, String(v)); return fd; };
const ok = (r: { error?: string; done?: string } | null) => !!r?.done && !r.error;
const bad = (r: { error?: string; done?: string } | null) => !!r?.error && !r.done;
const BASE = "https://example.test";

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
check("every review action works as the person (or a super admin through a view, logged) and is named in the log", ["inviteReviewerAction", "endReviewerAction", "addCvCommentAction", "resolveCommentAction", "replyCommentAction", "deleteCommentAction"].every((n) => new RegExp(`function ${n}\\([\\s\\S]*?owner\\("${n}"\\)`).test(src("app/cv-actions.ts"))));
check("the reviewer's page is a 404 unless the owner has let them in", src("app/(site)/cv-review/[id]/page.tsx").includes("whyNotReviewCv(me, id) !== null") && src("app/(site)/cv-review/[id]/page.tsx").includes("notFound()"));
check("the reviewer's page is built with the view that hides contact details", src("app/(site)/cv-review/[id]/page.tsx").includes("CV_REVIEW_VIEW") && !CV_REVIEW_VIEW.contact.email && !CV_REVIEW_VIEW.contact.phone && !CV_REVIEW_VIEW.contact.location && !CV_REVIEW_VIEW.contact.links);
check("a comment is plain text, never HTML", ![...walk("components/cv"), ...walk("app/(site)/cv-review")].some((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML")));

const co = db.select().from(companies).orderBy(companies.id).get();
if (!co) console.log("skip database checks (needs a company)");
else {
  const made: number[] = [];
  const person = (tag: string, role: "learner" | "manager" | "admin", scoped = false, extra: Partial<typeof users.$inferInsert> = {}) => {
    const u = db.insert(users).values({ email: `t-${tag}@cvreview.check`, name: `T ${tag}`, jobRole: "developer", role, ...extra }).returning().get();
    made.push(u.id);
    if (scoped) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: co.id }).run();
    return u;
  };
  try {
    const owner = person("owner", "learner", true), mentor = person("mentor", "learner"), mgr = person("mgr", "manager", true), stranger = person("stranger", "learner"), parent = person("parent", "learner"), other = person("other", "learner", true);
    db.insert(mentorships).values([{ mentorId: mentor.id, menteeId: owner.id, kind: "mentor" }, { mentorId: parent.id, menteeId: owner.id, kind: "parent" }]).run();
    db.insert(cvProfiles).values({ userId: owner.id, headline: "H", summary: "A summary of who I am.", location: "Leeds", contactEmail: "owner@example.test", phone: "+44 7000 000000", links: JSON.stringify([{ label: "Site", url: "https://example.test" }]) }).run();
    const job = db.insert(cvEntries).values({ userId: owner.id, kind: "experience", title: "My job", org: "Acme", body: "Did things" }).returning().get();
    const otherJob = db.insert(cvEntries).values({ userId: other.id, kind: "experience", title: "Someone else's job" }).returning().get();
    const as = (u: { id: number; role: string }) => ({ id: u.id, role: u.role });
    const mine = (r: typeof mentor, section = "experience", anchor = `entry:${job.id}`, body = "Add a number to show the result of this.", kind = "suggestion") => addComment(as(r), form({ ownerId: owner.id, section, anchor, kind, body }));

    // consent
    check("nobody can read a draft the owner has not shared", [mentor, mgr, stranger, parent].every((p) => whyNotReviewCv(as(p), owner.id) !== null));
    check("the owner can only invite their own mentors and managers", bad(inviteReviewer(as(owner), stranger.id)) && bad(inviteReviewer(as(owner), parent.id)) && bad(inviteReviewer(as(owner), 999999999)));
    check("they invite a mentor, who is told", ok(inviteReviewer(as(owner), mentor.id)) && !!db.select().from(notifications).where(and(eq(notifications.userId, mentor.id), eq(notifications.href, `/cv-review/${owner.id}`))).get());
    check("inviting the same person twice is refused", bad(inviteReviewer(as(owner), mentor.id)));
    check("an invited mentor may now read it, and nobody else may", whyNotReviewCv(as(mentor), owner.id) === null && whyNotReviewCv(as(mgr), owner.id) !== null && whyNotReviewCv(as(stranger), owner.id) !== null);
    check("they invite a manager who runs them", ok(inviteReviewer(as(owner), mgr.id)) && whyNotReviewCv(as(mgr), owner.id) === null);
    check("nobody reviews their own CV", whyNotReviewCv(as(owner), owner.id) !== null);

    // what a reviewer sees
    const draft = buildCv(owner.id, CV_REVIEW_VIEW, BASE)!;
    check("the draft a reviewer sees has no email, phone, location or links", draft.contact.length === 0 && !JSON.stringify(draft).includes("owner@example.test") && !JSON.stringify(draft).includes("7000 000000"));
    check("every item can be pointed at: typed entries carry an anchor", (draft.sections.find((s) => s.key === "experience")?.items ?? []).some((i) => i.anchor === `entry:${job.id}`));

    // commenting
    check("a stranger cannot comment", bad(mine(stranger)) && commentsForOwner(owner.id).length === 0);
    check("a section must be real, and a short or long comment is refused", bad(mine(mentor, "nonsense")) && bad(mine(mentor, "experience", "", "hi")) && bad(mine(mentor, "experience", "", "x".repeat(700))));
    check("a comment can only point at the owner's own items", bad(mine(mentor, "experience", `entry:${otherJob.id}`)) && bad(mine(mentor, "experience", "entry:abc")) && bad(mine(mentor, "experience", "../x")));
    check("a mentor comments on an item, and the owner is told", ok(mine(mentor)) && commentsForOwner(owner.id).length === 1 && !!db.select().from(notifications).where(and(eq(notifications.userId, owner.id), eq(notifications.href, "/profile/cv#feedback"))).get());
    check("and on a whole section, with an unknown kind becoming a suggestion", ok(mine(mentor, "summary", "", "The summary could name the role you want.", "shout")) && commentsByReviewer(mentor.id, owner.id).some((c) => c.section === "summary" && c.anchor === "" && c.kind === "suggestion"));
    check("a manager comments too", ok(mine(mgr, "experience", `entry:${job.id}`, "Mention the team size you worked with.", "question")));
    check("a reviewer sees only their own comments", commentsByReviewer(mentor.id, owner.id).every((c) => c.reviewerId === mentor.id) && commentsByReviewer(mgr.id, owner.id).every((c) => c.reviewerId === mgr.id) && commentsByReviewer(mentor.id, owner.id).length === 2 && commentsByReviewer(mgr.id, owner.id).length === 1);
    check("the owner sees everyone's, with who wrote each", commentsForOwner(owner.id).length === 3 && new Set(commentsForOwner(owner.id).map((c) => c.reviewer)).size === 2);
    check("the limit per item is enforced", (() => { for (let i = 0; i < CV_COMMENT.perItem; i++) mine(mentor, "experience", `entry:${job.id}`, `Another thought number ${i} on this job.`); return bad(mine(mentor, "experience", `entry:${job.id}`, "One more than allowed here.")); })());

    // the owner decides
    const first = commentsForOwner(owner.id).find((c) => c.reviewerId === mgr.id)!;
    check("only the owner can mark a comment done, dismiss it or reply", bad(resolveComment(as(stranger), first.id, "done")) && bad(resolveComment(as(mgr), first.id, "done")) && bad(replyToComment(as(mgr), first.id, "thanks")));
    check("they mark it done, and the author is told", ok(resolveComment(as(owner), first.id, "done")) && !!db.select().from(notifications).where(and(eq(notifications.userId, mgr.id), eq(notifications.title, "T owner acted on your CV comment"))).get() && openCommentCount(owner.id) === commentsForOwner(owner.id).length - 1);
    check("doing the same again is refused, and they can reopen it", bad(resolveComment(as(owner), first.id, "done")) && ok(resolveComment(as(owner), first.id, "open")));
    const second = commentsForOwner(owner.id).find((c) => c.section === "summary")!;
    check("they can dismiss one, and the author is not told that", ok(resolveComment(as(owner), second.id, "dismissed")) && !db.select().from(notifications).where(and(eq(notifications.userId, mentor.id), eq(notifications.key, `cv-comment-done:${second.id}`))).get());
    check("they reply once, the author is told, a second reply is refused", ok(replyToComment(as(owner), second.id, "Good point, I will name the role.")) && bad(replyToComment(as(owner), second.id, "and another")) && !!db.select().from(notifications).where(and(eq(notifications.userId, mentor.id), eq(notifications.key, `cv-comment-reply:${second.id}`))).get());

    // removing
    const theirs = commentsByReviewer(mentor.id, owner.id)[0];
    check("only the author can remove a comment", bad(deleteComment(as(owner), theirs.id)) && bad(deleteComment(as(mgr), theirs.id)) && ok(deleteComment(as(mentor), theirs.id)));
    check("a removed comment is gone for both, and the row is only marked", !commentsForOwner(owner.id).some((c) => c.id === theirs.id) && !commentsByReviewer(mentor.id, owner.id).some((c) => c.id === theirs.id) && !!db.select().from(cvComments).where(eq(cvComments.id, theirs.id)).get()?.deletedAt);

    // who can review what, and ending access
    check("a reviewer is told which CVs they may read", toReview(as(mentor)).some((x) => x.id === owner.id) && toReview(as(stranger)).length === 0);
    const lists = reviewersOf(owner.id);
    check("the owner sees who can read it and who they could still ask", lists.active.length === 2 && !lists.invitable.some((a) => a.id === mentor.id));
    check("the owner ends a person's access: they can no longer read or comment", ok(endReviewer(as(owner), mentor.id)) && whyNotReviewCv(as(mentor), owner.id) !== null && bad(mine(mentor)) && toReview(as(mentor)).length === 0);
    check("ending it again is refused, and their earlier comments stay for the owner", bad(endReviewer(as(owner), mentor.id)) && commentsForOwner(owner.id).some((c) => c.reviewerId === mentor.id));
    check("the owner can let them back in", ok(inviteReviewer(as(owner), mentor.id)) && whyNotReviewCv(as(mentor), owner.id) === null);
    check("an invitation is no licence once the relationship has ended", (() => { db.delete(mentorships).where(eq(mentorships.mentorId, mentor.id)).run(); const r = whyNotReviewCv(as(mentor), owner.id) !== null && toReview(as(mentor)).length === 0; return r; })());
    check("nothing about the CV itself was changed by any of it", db.select().from(cvEntries).where(eq(cvEntries.id, job.id)).get()?.title === "My job" && db.select().from(cvProfiles).where(eq(cvProfiles.userId, owner.id)).get()?.summary === "A summary of who I am.");
  } finally {
    if (made.length) {
      db.delete(notifications).where(inArray(notifications.userId, made)).run();
      db.delete(cvComments).where(inArray(cvComments.userId, made)).run();
      db.delete(cvReviewers).where(inArray(cvReviewers.userId, made)).run();
      db.delete(cvEntries).where(inArray(cvEntries.userId, made)).run();
      db.delete(cvProfiles).where(inArray(cvProfiles.userId, made)).run();
      db.delete(mentorships).where(inArray(mentorships.menteeId, made)).run();
      db.delete(userScopes).where(inArray(userScopes.userId, made)).run();
      db.delete(users).where(inArray(users.id, made)).run();
    }
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
