import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { brands, db, enrollments, knowledgeAcks, knowledgeChanges, knowledgeItems, questions, tracks, users } from "@/lib/db";
import { openTo } from "@/lib/paths";

type Tx = Pick<typeof db, "insert" | "select" | "update" | "delete">;
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

/** Days a learner has to read a material change before it counts as overdue. */
export const REVIEW_DAYS = 7;

/**
 * Saves a new body for a knowledge item and records the change. Returns null when nothing changed.
 * Existing questions are left alone: the admin sees how many are linked and decides what to rewrite.
 */
export function recordChange(tx: Tx, item: typeof knowledgeItems.$inferSelect, after: string, o: { note?: string; material?: boolean; by?: number | null }) {
  if (after === item.body) return null;
  const version = item.version + 1;
  tx.update(knowledgeItems).set({ body: after, version, updatedAt: now() }).where(eq(knowledgeItems.id, item.id)).run();
  return tx.insert(knowledgeChanges).values({
    itemId: item.id, trackId: item.trackId, version, title: item.title, note: o.note ?? "", before: item.body, after,
    material: o.material === false ? 0 : 1, createdBy: o.by ?? null,
  }).returning().get();
}

export type Pending = { change: typeof knowledgeChanges.$inferSelect; track: typeof tracks.$inferSelect; dueAt: number; overdue: boolean };

/**
 * Material changes this person has not confirmed. Only people enrolled in the track before the change are asked:
 * someone who joined afterwards learned the current text from the start.
 */
export function pendingFor(userId: number, at = now()): Pending[] {
  const me = db.select({ a: users.audience, s: users.status }).from(users).where(eq(users.id, userId)).get();
  if (!me || me.s !== "active") return [];
  const rows = db.select({ c: knowledgeChanges, t: tracks }).from(knowledgeChanges)
    .innerJoin(tracks, eq(tracks.id, knowledgeChanges.trackId))
    .innerJoin(enrollments, and(eq(enrollments.trackId, knowledgeChanges.trackId), eq(enrollments.userId, userId)))
    .where(and(
      eq(knowledgeChanges.material, 1),
      sql`${enrollments.startedAt} < ${knowledgeChanges.createdAt}`,
      sql`not exists (select 1 from ${knowledgeAcks} k where k.change_id = ${knowledgeChanges.id} and k.user_id = ${userId})`,
    )).orderBy(desc(knowledgeChanges.createdAt)).all();
  // a newer change to the same item replaces an older unread one: only the latest text matters
  const latest = new Map<number, number>();
  for (const r of rows) latest.set(r.c.itemId, Math.max(latest.get(r.c.itemId) ?? 0, r.c.version));
  return rows.filter((r) => openTo(me.a, r.t.audience) && latest.get(r.c.itemId) === r.c.version)
    .map((r) => ({ change: r.c, track: r.t, dueAt: r.c.createdAt + REVIEW_DAYS * DAY, overdue: at > r.c.createdAt + REVIEW_DAYS * DAY }));
}

/** Confirms a change for one person (and any older unread changes to the same item, which this text replaces). */
export function acknowledge(userId: number, changeId: number): boolean {
  const p = pendingFor(userId).find((x) => x.change.id === changeId);
  if (!p) return false;
  const older = db.select({ id: knowledgeChanges.id }).from(knowledgeChanges)
    .where(and(eq(knowledgeChanges.itemId, p.change.itemId), sql`${knowledgeChanges.version} <= ${p.change.version}`)).all().map((r) => r.id);
  db.insert(knowledgeAcks).values(older.map((changeId) => ({ userId, changeId }))).onConflictDoNothing().run();
  return true;
}

export type ChangeReport = {
  change: typeof knowledgeChanges.$inferSelect;
  track: typeof tracks.$inferSelect;
  brand: string;
  by: string | null;
  linkedQuestions: number;
  affected: { id: number; name: string; jobRole: string; read: boolean }[];
  overdue: boolean;
};

/** Recent changes with who has and has not read each. A reader of a newer change to the same item counts as having read this one. */
export function changeReport(limit = 30, at = now(), only?: Set<number> | null): ChangeReport[] {
  const changes = db.select({ c: knowledgeChanges, t: tracks, b: brands }).from(knowledgeChanges)
    .innerJoin(tracks, eq(tracks.id, knowledgeChanges.trackId)).innerJoin(brands, eq(brands.id, tracks.brandId))
    .orderBy(desc(knowledgeChanges.createdAt), desc(knowledgeChanges.id)).limit(limit).all();
  if (!changes.length) return [];
  const ids = changes.map((x) => x.c.id);
  const acks = new Set(db.select().from(knowledgeAcks).where(inArray(knowledgeAcks.changeId, ids)).all().map((a) => `${a.userId}:${a.changeId}`));
  const linked = new Map(db.select({ id: questions.knowledgeItemId, n: sql<number>`count(*)` }).from(questions)
    .where(and(inArray(questions.knowledgeItemId, changes.map((x) => x.c.itemId)), eq(questions.status, "active"))).groupBy(questions.knowledgeItemId).all().map((r) => [r.id, r.n]));
  const authors = [...new Set(changes.map((x) => x.c.createdBy).filter((id): id is number => id != null))];
  const names = new Map((authors.length ? db.select({ id: users.id, n: users.name }).from(users).where(inArray(users.id, authors)).all() : []).map((u) => [u.id, u.n]));
  return changes.map(({ c, t, b }) => {
    const enrolled = db.select({ u: { id: users.id, name: users.name, jobRole: users.jobRole, audience: users.audience } }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId))
      .where(and(eq(enrollments.trackId, c.trackId), eq(users.status, "active"), sql`${enrollments.startedAt} < ${c.createdAt}`)).all()
      .filter((r) => openTo(r.u.audience, t.audience) && (!only || only.has(r.u.id)));
    const newer = db.select({ id: knowledgeChanges.id }).from(knowledgeChanges)
      .where(and(eq(knowledgeChanges.itemId, c.itemId), sql`${knowledgeChanges.version} > ${c.version}`)).all().map((r) => r.id);
    const newerAcks = newer.length ? new Set(db.select().from(knowledgeAcks).where(inArray(knowledgeAcks.changeId, newer)).all().map((a) => a.userId)) : new Set<number>();
    const affected = c.material ? enrolled.map((r) => ({ id: r.u.id, name: r.u.name, jobRole: r.u.jobRole, read: acks.has(`${r.u.id}:${c.id}`) || newerAcks.has(r.u.id) })) : [];
    return {
      change: c, track: t, brand: b.name, by: c.createdBy ? names.get(c.createdBy) ?? null : null,
      linkedQuestions: linked.get(c.itemId) ?? 0, affected,
      overdue: !!c.material && at > c.createdAt + REVIEW_DAYS * DAY && affected.some((a) => !a.read),
    };
  });
}

/** How many material changes each person still has to read, for the compliance list. */
export function pendingCounts(only?: Set<number> | null): Map<number, number> {
  const out = new Map<number, number>(), seen = new Set<string>();
  for (const r of changeReport(100, now(), only)) {
    if (!r.change.material) continue;
    for (const a of r.affected) {
      const key = `${a.id}:${r.change.itemId}`; // one count per item, however many edits it had
      if (!a.read && !seen.has(key)) { seen.add(key); out.set(a.id, (out.get(a.id) ?? 0) + 1); }
    }
  }
  return out;
}
