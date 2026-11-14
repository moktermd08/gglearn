import { and, desc, eq, isNull } from "drizzle-orm";
import { cvComments, cvEntries, cvReviewers, db, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { allowed, hit } from "@/lib/rate-limit";
import { askable, relationshipOf } from "@/lib/cv/endorse";
import { CV_COMMENT, SECTION_KEYS, type SectionKey } from "@/lib/cv/types";
import { NOTE_KINDS, type NoteKind } from "@/lib/questionNoteText";

/**
 * Mentor and manager comments on a CV draft (docs/cv/design.md). A CV is private until its owner shares it, so reading the draft needs the owner's
 * say-so, person by person:
 *  - the OWNER invites a mentor or a manager who runs them; they can end it at any time, and the person must still be that mentor or manager;
 *  - a reviewer sees every section of the draft but never the owner's email, phone, location or links (CV_REVIEW_VIEW);
 *  - they comment on a whole section or on one item (a job, a certificate). A comment is private between its author and the owner: other reviewers
 *    cannot see it;
 *  - the owner marks each comment done or dismisses it, and may reply once. The author is told.
 * Plain text. Nothing here changes the CV itself: a comment is advice, and the owner decides.
 */
type Me = { id: number; role: string };
type Res = { error?: string; done?: string } | null;
const DAY = 86400, now = () => Math.floor(Date.now() / 1000);
const nameOf = (id: number) => db.select({ n: users.name }).from(users).where(eq(users.id, id)).get()?.n ?? "Someone";
const clean = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

const grantOf = (ownerId: number, reviewerId: number) => db.select().from(cvReviewers).where(and(eq(cvReviewers.userId, ownerId), eq(cvReviewers.reviewerId, reviewerId))).get();

/** Why this person may not read and comment on that person's CV draft, or null when they may. */
export function whyNotReviewCv(me: Me, ownerId: number): string | null {
  if (me.id === ownerId) return "That is your own CV.";
  const owner = db.select({ s: users.status }).from(users).where(eq(users.id, ownerId)).get();
  if (!owner || owner.s !== "active") return "That person is not available.";
  const g = grantOf(ownerId, me.id);
  if (!g || g.endedAt != null) return "They have not asked you to review their CV.";
  if (!relationshipOf(me, ownerId)) return "You are no longer their manager or mentor."; // an invitation is not a licence once the relationship has ended
  return null;
}

/** The owner lets one of their mentors or managers read the draft and comment. The person is told. */
export function inviteReviewer(owner: Me, reviewerId: number): Res {
  const person = db.select().from(users).where(eq(users.id, reviewerId)).get();
  if (!person || person.status !== "active") return { error: "That person is not available." };
  if (!relationshipOf(person, owner.id)) return { error: "They are not one of your managers or mentors." };
  const key = `cv-invite:${owner.id}`;
  if (!allowed(key, 20)) return { error: "That is plenty of invitations for one day." };
  const g = grantOf(owner.id, reviewerId);
  if (g && g.endedAt == null) return { error: "They can already review your CV." };
  hit(key, DAY * 1000);
  if (g) db.update(cvReviewers).set({ endedAt: null, createdAt: now() }).where(eq(cvReviewers.id, g.id)).run();
  else db.insert(cvReviewers).values({ userId: owner.id, reviewerId }).run();
  notify(reviewerId, { key: `cv-invite:${owner.id}:${reviewerId}:${Math.floor(now() / DAY)}`, kind: "system", title: `${nameOf(owner.id)} asked you to review their CV`, body: "Read the draft and leave comments on any section. They decide what to change.", href: `/cv-review/${owner.id}` });
  return { done: "They can now read your draft and comment on it." };
}

/** The owner ends a person's access. Their comments stay as a record, but they can no longer open the draft. */
export function endReviewer(owner: Me, reviewerId: number): Res {
  const g = grantOf(owner.id, reviewerId);
  if (!g || g.endedAt != null) return { error: "They cannot review your CV." };
  db.update(cvReviewers).set({ endedAt: now() }).where(eq(cvReviewers.id, g.id)).run();
  return { done: "Done. They can no longer open your draft." };
}

/** Is this anchor something that belongs to this CV? ("" is the whole section). Typed entries are checked against the owner's own. */
function anchorOk(ownerId: number, anchor: string): boolean {
  if (anchor === "") return true;
  const m = /^(entry|cert|skill|quote|endorsement):(\d{1,9})$/.exec(anchor);
  if (!m) return false;
  if (m[1] !== "entry") return true; // platform items are the owner's by construction; their key is only a label
  return !!db.select({ id: cvEntries.id }).from(cvEntries).where(and(eq(cvEntries.id, Number(m[2])), eq(cvEntries.userId, ownerId))).get();
}

/** A reviewer leaves a comment on a section, or on one item in it. */
export function addComment(me: Me, fd: FormData): Res {
  const ownerId = Number(fd.get("ownerId"));
  const no = Number.isInteger(ownerId) ? whyNotReviewCv(me, ownerId) : "Choose a CV.";
  if (no) return { error: no };
  const section = SECTION_KEYS.find((k) => k === fd.get("section")) as SectionKey | undefined;
  if (!section) return { error: "Choose a section." };
  const anchor = typeof fd.get("anchor") === "string" ? (fd.get("anchor") as string) : "";
  if (!anchorOk(ownerId, anchor)) return { error: "That is not part of their CV." };
  const kind = (NOTE_KINDS.find((k) => k === fd.get("kind")) ?? "suggestion") as NoteKind;
  const body = clean(fd.get("body"), CV_COMMENT.max + 1);
  if (body.length < CV_COMMENT.min) return { error: `Write at least ${CV_COMMENT.min} characters.` };
  if (body.length > CV_COMMENT.max) return { error: `Keep it under ${CV_COMMENT.max} characters.` };
  const key = `cv-comment:${me.id}`;
  if (!allowed(key, CV_COMMENT.perDay)) return { error: "That is plenty for one day. They will see what you have written." };
  const mine = db.select({ id: cvComments.id }).from(cvComments).where(and(eq(cvComments.userId, ownerId), eq(cvComments.reviewerId, me.id), eq(cvComments.section, section), eq(cvComments.anchor, anchor), isNull(cvComments.deletedAt))).all().length;
  if (mine >= CV_COMMENT.perItem) return { error: `You have already left ${CV_COMMENT.perItem} comments here. Remove one, or add to it.` };
  hit(key, DAY * 1000);
  db.insert(cvComments).values({ userId: ownerId, reviewerId: me.id, section, anchor, kind, body }).run();
  // one notice per reviewer per owner per day, so ten comments do not send ten
  notify(ownerId, { key: `cv-comment:${me.id}:${ownerId}:${Math.floor(now() / DAY)}`, kind: "system", title: `${nameOf(me.id)} commented on your CV`, body: body.length > 120 ? `${body.slice(0, 117)}…` : body, href: "/profile/cv#feedback" });
  return { done: "Sent. They will see it next to that part of their CV." };
}

/** The owner marks a comment done (they acted on it), dismisses it (they will not), or puts it back to open. The author is told once. */
export function resolveComment(owner: Me, id: number, to: "done" | "dismissed" | "open"): Res {
  const c = db.select().from(cvComments).where(eq(cvComments.id, id)).get();
  if (!c || c.userId !== owner.id || c.deletedAt) return { error: "That is not yours." };
  if (c.status === to) return { error: "It is already that." };
  db.update(cvComments).set({ status: to, resolvedAt: to === "open" ? null : now() }).where(eq(cvComments.id, c.id)).run();
  if (to === "done") notify(c.reviewerId, { key: `cv-comment-done:${c.id}`, kind: "system", title: `${nameOf(owner.id)} acted on your CV comment`, body: c.body.length > 120 ? `${c.body.slice(0, 117)}…` : c.body, href: `/cv-review/${owner.id}` });
  return { done: to === "done" ? "Marked done." : to === "dismissed" ? "Dismissed." : "Reopened." };
}

/** The owner's one reply to a comment. The author is told. */
export function replyToComment(owner: Me, id: number, text: unknown): Res {
  const c = db.select().from(cvComments).where(eq(cvComments.id, id)).get();
  if (!c || c.userId !== owner.id || c.deletedAt) return { error: "That is not yours." };
  if (c.repliedAt) return { error: "You have already replied to this one." };
  const r = clean(text, CV_COMMENT.reply + 1);
  if (r.length < 2) return { error: "Write a few words." };
  if (r.length > CV_COMMENT.reply) return { error: `Keep it under ${CV_COMMENT.reply} characters.` };
  db.update(cvComments).set({ reply: r, repliedAt: now() }).where(eq(cvComments.id, c.id)).run();
  notify(c.reviewerId, { key: `cv-comment-reply:${c.id}`, kind: "system", title: `${nameOf(owner.id)} replied about their CV`, body: r.length > 120 ? `${r.slice(0, 117)}…` : r, href: `/cv-review/${owner.id}` });
  return { done: "Sent." };
}

/** An author removes their own comment. The row stays, marked. */
export function deleteComment(me: Me, id: number): Res {
  const c = db.select().from(cvComments).where(eq(cvComments.id, id)).get();
  if (!c || c.reviewerId !== me.id || c.deletedAt) return { error: "That is not yours." };
  db.update(cvComments).set({ deletedAt: now() }).where(eq(cvComments.id, c.id)).run();
  return { done: "Removed." };
}

export type CommentView = typeof cvComments.$inferSelect & { reviewer: string };
/** Everything said about this person's CV, newest first: for the OWNER, who sees all of it. */
export const commentsForOwner = (ownerId: number): CommentView[] =>
  db.select({ c: cvComments, who: users.name }).from(cvComments).innerJoin(users, eq(users.id, cvComments.reviewerId)).where(and(eq(cvComments.userId, ownerId), isNull(cvComments.deletedAt))).orderBy(desc(cvComments.id)).all().map(({ c, who }) => ({ ...c, reviewer: who }));
/** What THIS reviewer has said about that CV: never anyone else's. */
export const commentsByReviewer = (reviewerId: number, ownerId: number): CommentView[] =>
  db.select({ c: cvComments, who: users.name }).from(cvComments).innerJoin(users, eq(users.id, cvComments.reviewerId)).where(and(eq(cvComments.userId, ownerId), eq(cvComments.reviewerId, reviewerId), isNull(cvComments.deletedAt))).orderBy(cvComments.id).all().map(({ c, who }) => ({ ...c, reviewer: who }));
export const openCommentCount = (ownerId: number) => db.select({ id: cvComments.id }).from(cvComments).where(and(eq(cvComments.userId, ownerId), eq(cvComments.status, "open"), isNull(cvComments.deletedAt))).all().length;

/** People the owner has let review, and people they could still invite. */
export function reviewersOf(ownerId: number) {
  const active = db.select({ g: cvReviewers, who: users.name }).from(cvReviewers).innerJoin(users, eq(users.id, cvReviewers.reviewerId)).where(and(eq(cvReviewers.userId, ownerId), isNull(cvReviewers.endedAt))).all().map(({ g, who }) => ({ id: g.reviewerId, name: who }));
  const have = new Set(active.map((a) => a.id));
  return { active, invitable: askable({ id: ownerId, role: "learner" }).filter((a) => !have.has(a.id)) };
}
/** The CVs this person has been asked to review (the relationship must still hold). */
export function toReview(me: Me): { id: number; name: string }[] {
  return db.select({ g: cvReviewers, who: users.name, s: users.status }).from(cvReviewers).innerJoin(users, eq(users.id, cvReviewers.userId)).where(and(eq(cvReviewers.reviewerId, me.id), isNull(cvReviewers.endedAt))).all()
    .filter((r) => r.s === "active" && relationshipOf(me, r.g.userId)).map((r) => ({ id: r.g.userId, name: r.who }));
}
