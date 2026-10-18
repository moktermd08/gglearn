import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import { db, notifications } from "@/lib/db";

type Tx = Pick<typeof db, "insert" | "select" | "update">;
export type Note = { key: string; kind: typeof notifications.$inferInsert["kind"]; title: string; body?: string; href?: string };

/** Records an event for a person once. `read: true` files it as already seen (used when a feature is first opened, to avoid backfill spam). */
export function notify(userId: number, n: Note, opts: { read?: boolean; tx?: Tx } = {}) {
  (opts.tx ?? db).insert(notifications).values({
    userId, key: n.key, kind: n.kind, title: n.title.slice(0, 120), body: (n.body ?? "").slice(0, 300), href: n.href ?? "",
    readAt: opts.read ? Math.floor(Date.now() / 1000) : null,
  }).onConflictDoNothing().run();
}

export const unreadCount = (userId: number) =>
  db.select({ n: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).get()?.n ?? 0;

export const listNotes = (userId: number, limit = 50) =>
  db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit).all();

export function markAllRead(userId: number) {
  db.update(notifications).set({ readAt: Math.floor(Date.now() / 1000) }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).run();
}

/** Marks one event read by its key, e.g. an invitation once it has been answered, so the bell does not keep counting it. */
export function markKeyRead(userId: number, key: string) {
  db.update(notifications).set({ readAt: Math.floor(Date.now() / 1000) }).where(and(eq(notifications.userId, userId), eq(notifications.key, key), isNull(notifications.readAt))).run();
}

export function markRead(userId: number, id: number) {
  db.update(notifications).set({ readAt: Math.floor(Date.now() / 1000) }).where(and(eq(notifications.userId, userId), eq(notifications.id, id), isNull(notifications.readAt))).run();
}

/** Highest player level this person has already been told about (0 = never). */
export function lastLevelNoted(userId: number): number {
  return Math.max(0, ...db.select({ k: notifications.key }).from(notifications).where(and(eq(notifications.userId, userId), like(notifications.key, "level-%"))).all().map((r) => Number(r.k.slice(6)) || 0));
}
