import { and, desc, eq } from "drizzle-orm";
import { cvEndorsements, db, mentorships, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { allowed, hit } from "@/lib/rate-limit";
import { ENDORSE, RELATIONSHIP_LABEL } from "@/lib/cv/types";
import { reachOf, userInReach } from "@/lib/tenancy";

/**
 * References written for someone's CV by a manager or a mentor (docs/cv/design.md). A reference carries a real person's name, so it needs
 * both sides' say-so at every step:
 *  - who may write one: a manager or admin who runs the person, or a mentor the person chose. Never a parent, never the person themselves;
 *  - the person asks for it, or the author offers it; either way it is only pending until the PERSON approves it;
 *  - editing an approved one puts it back to pending, so what is published is always what the person last approved;
 *  - the author can withdraw at any time and it leaves the CV at once; the person can decline or hide it;
 *  - the relationship ("Manager", "Mentor") is worked out here from the real records, never typed by the author.
 */
export type Endorsement = typeof cvEndorsements.$inferSelect;
type Me = { id: number; role: string };
type Res = { error?: string; done?: string } | null;
const DAY = 86400, now = () => Math.floor(Date.now() / 1000);

/** How the author relates to the person on the platform, or null when they have no standing to write a reference. Managers outrank mentors. */
export function relationshipOf(author: Me, personId: number, reach = reachOf(author.id)): "manager" | "mentor" | null {
  if (author.id === personId) return null;
  if ((author.role === "manager" || author.role === "admin") && userInReach(reach, personId)) return "manager";
  if (db.select({ id: mentorships.id }).from(mentorships).where(and(eq(mentorships.mentorId, author.id), eq(mentorships.menteeId, personId), eq(mentorships.kind, "mentor"))).get()) return "mentor";
  return null;
}

/** Why this person may not write a reference for that person, or null when they may. */
export function whyNotEndorse(author: Me, personId: number): string | null {
  if (author.id === personId) return "Nobody writes a reference for themselves.";
  const p = db.select({ s: users.status }).from(users).where(eq(users.id, personId)).get();
  if (!p) return "That person does not exist.";
  if (p.s !== "active") return "That person is not active.";
  return relationshipOf(author, personId) ? null : "You do not run them and are not their mentor, so you cannot write a reference for them.";
}

const URLISH = /(?:https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+)/i;
/** Plain text, paragraphs kept (one blank line at most). */
export function cleanEndorsement(v: unknown, max: number): string {
  return (typeof v === "string" ? v : "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}
function checkBody(raw: unknown, rawContext: unknown): { error: string } | { body: string; context: string } {
  const body = cleanEndorsement(raw, ENDORSE.max + 1), context = cleanEndorsement(rawContext, ENDORSE.context + 1).replace(/\n+/g, " ");
  if (body.length < ENDORSE.min) return { error: `Write at least ${ENDORSE.min} characters: say what you saw them do, and the difference it made.` };
  if (body.length > ENDORSE.max) return { error: `Keep it under ${ENDORSE.max} characters.` };
  if (context.length > ENDORSE.context) return { error: `Keep the context under ${ENDORSE.context} characters.` };
  if (URLISH.test(body) || URLISH.test(context)) return { error: "Leave out web addresses and email addresses: a reference stands on what you say, not on a link." };
  return { body, context };
}

const nameOf = (id: number) => db.select({ n: users.name }).from(users).where(eq(users.id, id)).get()?.n ?? "Someone";
const dayKey = () => Math.floor(now() / DAY);

/** The person asks one eligible author for a reference. The author is told. */
export function requestEndorsement(owner: Me, authorId: number): Res {
  const author = db.select().from(users).where(eq(users.id, authorId)).get();
  if (!author || author.status !== "active") return { error: "That person is not available." };
  const rel = relationshipOf(author, owner.id);
  if (!rel) return { error: "They are not one of your managers or mentors." };
  const key = `endorse-ask:${owner.id}`;
  if (!allowed(key, 10)) return { error: "That is plenty of requests for one day." };
  const have = db.select().from(cvEndorsements).where(and(eq(cvEndorsements.userId, owner.id), eq(cvEndorsements.authorId, authorId))).get();
  if (have && ["requested", "pending", "approved"].includes(have.status)) return { error: have.status === "requested" ? "You have already asked them." : "They have already written one for you." };
  if (have && now() - (have.decidedAt ?? have.updatedAt) < ENDORSE.reaskDays * DAY) return { error: `Give it ${ENDORSE.reaskDays} days before asking this person again.` };
  hit(key, DAY * 1000);
  if (have) db.update(cvEndorsements).set({ status: "requested", relationship: rel, updatedAt: now(), decidedAt: null }).where(eq(cvEndorsements.id, have.id)).run();
  else db.insert(cvEndorsements).values({ userId: owner.id, authorId, status: "requested", relationship: rel }).run();
  notify(authorId, { key: `endorse-ask:${owner.id}:${authorId}:${dayKey()}`, kind: "system", title: `${nameOf(owner.id)} asked you for a reference`, body: "A short reference from you would go on their CV, only if they approve it.", href: `/endorse/${owner.id}` });
  return { done: "Asked. They will see your request." };
}

/** The author writes, or rewrites, a reference. It is pending until the person approves it. */
export function writeEndorsement(author: Me, personId: number, fd: FormData): Res {
  const no = whyNotEndorse(author, personId);
  if (no) return { error: no };
  const v = checkBody(fd.get("body"), fd.get("context"));
  if ("error" in v) return v;
  const rel = relationshipOf(author, personId)!;
  const have = db.select().from(cvEndorsements).where(and(eq(cvEndorsements.userId, personId), eq(cvEndorsements.authorId, author.id))).get();
  if (have?.status === "declined") return { error: "They chose not to feature an earlier reference from you. They can ask you again." };
  const key = `endorse-write:${author.id}`;
  if (!allowed(key, ENDORSE.perDay)) return { error: "That is plenty for one day." };
  hit(key, DAY * 1000);
  const t = now();
  if (have) db.update(cvEndorsements).set({ status: "pending", relationship: rel, body: v.body, context: v.context, writtenAt: t, decidedAt: null, updatedAt: t }).where(eq(cvEndorsements.id, have.id)).run();
  else db.insert(cvEndorsements).values({ userId: personId, authorId: author.id, status: "pending", relationship: rel, body: v.body, context: v.context, writtenAt: t, updatedAt: t }).run();
  notify(personId, { key: `endorse-written:${author.id}:${personId}:${t}`, kind: "system", title: `${nameOf(author.id)} wrote a reference for your CV`, body: "Read it, and approve it if you would like it on your CV. Nothing is shown until you do.", href: "/profile/cv#endorsements" });
  return { done: have?.status === "approved" ? "Saved. Because it changed, they will need to approve it again before it shows." : "Sent. It will go on their CV only if they approve it." };
}

/** The author takes their reference back. It leaves the CV at once. */
export function withdrawEndorsement(author: Me, id: number): Res {
  const e = db.select().from(cvEndorsements).where(eq(cvEndorsements.id, id)).get();
  if (!e || e.authorId !== author.id) return { error: "That is not yours." };
  if (e.status === "withdrawn" || e.status === "declined") return { error: "It is already gone." };
  db.update(cvEndorsements).set({ status: "withdrawn", decidedAt: now(), updatedAt: now() }).where(eq(cvEndorsements.id, e.id)).run();
  return { done: "Withdrawn. It is no longer on their CV." };
}

/** The person approves a written reference, or declines it (or one already approved). */
export function decideEndorsement(owner: Me, id: number, approve: boolean): Res {
  const e = db.select().from(cvEndorsements).where(eq(cvEndorsements.id, id)).get();
  if (!e || e.userId !== owner.id) return { error: "That is not yours." };
  if (approve) {
    if (e.status !== "pending") return { error: e.status === "approved" ? "It is already on your CV." : "There is nothing to approve." };
    db.update(cvEndorsements).set({ status: "approved", decidedAt: now(), updatedAt: now() }).where(eq(cvEndorsements.id, e.id)).run();
    notify(e.authorId, { key: `endorse-ok:${e.id}:${e.writtenAt}`, kind: "system", title: `${nameOf(owner.id)} will show your reference on their CV`, body: "Thank you. You can withdraw it at any time.", href: `/endorse/${owner.id}` });
    return { done: "Approved. It is now on your CV." };
  }
  if (!["pending", "approved"].includes(e.status)) return { error: "There is nothing to decline." };
  db.update(cvEndorsements).set({ status: "declined", decidedAt: now(), updatedAt: now() }).where(eq(cvEndorsements.id, e.id)).run();
  return { done: "Declined. It will not appear anywhere." };
}

/** The person withdraws a request they made, before anything was written. */
export function cancelRequest(owner: Me, id: number): Res {
  const e = db.select().from(cvEndorsements).where(eq(cvEndorsements.id, id)).get();
  if (!e || e.userId !== owner.id || e.status !== "requested") return { error: "There is no request to cancel." };
  db.delete(cvEndorsements).where(eq(cvEndorsements.id, e.id)).run();
  return { done: "Request cancelled." };
}

export type EndorsementView = Endorsement & { author: string; label: string };
/** Everything about this person's references, for them to manage, newest first. */
export function endorsementsOf(personId: number): EndorsementView[] {
  return db.select({ e: cvEndorsements, who: users.name }).from(cvEndorsements).innerJoin(users, eq(users.id, cvEndorsements.authorId)).where(eq(cvEndorsements.userId, personId)).orderBy(desc(cvEndorsements.updatedAt)).all()
    .map(({ e, who }) => ({ ...e, author: who, label: RELATIONSHIP_LABEL[e.relationship] }));
}
/** The references a reader may see: approved only, the author still active, newest first. */
export function approvedFor(personId: number): EndorsementView[] {
  return db.select({ e: cvEndorsements, who: users.name, s: users.status }).from(cvEndorsements).innerJoin(users, eq(users.id, cvEndorsements.authorId))
    .where(and(eq(cvEndorsements.userId, personId), eq(cvEndorsements.status, "approved"))).orderBy(desc(cvEndorsements.decidedAt)).all()
    .filter((r) => r.s === "active").map(({ e, who }) => ({ ...e, author: who, label: RELATIONSHIP_LABEL[e.relationship] }));
}

/** People this person could ask: their mentors, and the managers and admins who run them (not those who run everything). */
export function askable(person: Me): { id: number; name: string; label: string }[] {
  const out = new Map<number, { id: number; name: string; label: string }>();
  for (const m of db.select({ id: users.id, name: users.name }).from(mentorships).innerJoin(users, eq(users.id, mentorships.mentorId)).where(and(eq(mentorships.menteeId, person.id), eq(mentorships.kind, "mentor"), eq(users.status, "active"))).all()) out.set(m.id, { ...m, label: "Mentor" });
  for (const m of db.select().from(users).where(and(eq(users.status, "active"))).all()) {
    if (m.id === person.id || m.role === "learner") continue;
    const reach = reachOf(m.id);
    if (reach.all || !userInReach(reach, person.id)) continue; // someone who runs everyone is not someone who worked with them
    out.set(m.id, { id: m.id, name: m.name, label: "Manager" });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}
