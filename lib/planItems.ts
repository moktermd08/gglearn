import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, planItems, planLogs, users } from "@/lib/db";
import { reachOf, userInReach } from "@/lib/tenancy";
import { notify } from "@/lib/notifications";
import type { SetupState } from "@/lib/setup";

/**
 * Plan items the app cannot detect on its own: a manager sets them for someone they run ("shadow a release, twice a month"),
 * or a person adds their own. Who may do what follows the rules used everywhere else: a manager or admin acts only for people in their reach and
 * never for themselves; a person acts on their own items. Progress is counted from logs, so it cannot drift from what was recorded.
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };
const DAY = 86400, now = () => Math.floor(Date.now() / 1000);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
export const TITLE_MAX = 120, NOTE_MAX = 400, MAX_NEED = 20, MAX_ACTIVE = 50;

/** May `me` set, change or sign off items for `userId`? The person themself may for items they added; a manager or admin only for others in their reach. */
export function mayManage(me: Me, userId: number): boolean {
  if (me.id === userId) return false;
  return (me.role === "admin" || me.role === "manager") && userInReach(reachOf(me.id), userId);
}

export type ManualItem = {
  id: number; title: string; note: string; period: "once" | "weekly"; need: number; dueAt: number | null;
  have: number; done: boolean; overdue: boolean; signedOff: boolean; byManager: boolean; setBy: string; mine: boolean;
};

/** Completions that count: all of them for a "once" item, the last seven days for a weekly one. */
const countLogs = (itemId: number, period: "once" | "weekly", at: number) =>
  db.select({ id: planLogs.id }).from(planLogs).where(and(eq(planLogs.itemId, itemId), period === "weekly" ? gte(planLogs.at, at - 7 * DAY) : undefined)).all().length;

/** The active manual items for one person, with progress. */
export function manualItemsFor(userId: number, at = now()): ManualItem[] {
  const rows = db.select().from(planItems).where(and(eq(planItems.userId, userId), isNull(planItems.removedAt))).orderBy(desc(planItems.createdAt)).all();
  if (!rows.length) return [];
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...new Set(rows.map((r) => r.createdBy))])).all().map((u) => [u.id, u.name]));
  return rows.map((r) => {
    const have = countLogs(r.id, r.period, at), signedOff = r.signedOffAt != null;
    return {
      id: r.id, title: r.title, note: r.note, period: r.period, need: r.need, dueAt: r.dueAt, have: Math.min(have, r.need),
      done: signedOff || (r.period === "once" && have >= r.need) || (r.period === "weekly" && have >= r.need),
      signedOff, overdue: !signedOff && r.dueAt != null && r.dueAt < at, byManager: r.createdBy !== userId, setBy: r.createdBy === userId ? "You" : names.get(r.createdBy) ?? "A manager", mine: r.createdBy === userId,
    };
  });
}

function parse(fd: FormData): { title: string; note: string; period: "once" | "weekly"; need: number; dueAt: number | null } | string {
  const title = str(fd.get("title")), note = str(fd.get("note"));
  if (!title) return "Say what it is.";
  if (title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  if (note.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters.`;
  const period = str(fd.get("period")) === "weekly" ? "weekly" : "once";
  const need = Math.floor(Number(str(fd.get("need")) || 1));
  if (!Number.isFinite(need) || need < 1 || need > MAX_NEED) return `How many: a whole number from 1 to ${MAX_NEED}.`;
  const due = str(fd.get("due"));
  const dueAt = due ? Math.floor(Date.parse(`${due}T23:59:59Z`) / 1000) : null;
  if (due && (!Number.isFinite(dueAt!) || dueAt! < now() - DAY)) return "The date must be today or later.";
  if (period === "weekly" && dueAt) return "A weekly item repeats until removed, so leave the date empty.";
  return { title, note, period, need, dueAt };
}

/** Adds an item for `userId` (an item for yourself, or for someone you run). */
export function addItem(me: Me, userId: number, fd: FormData): SetupState {
  if (me.id !== userId && !mayManage(me, userId)) return { error: "You do not run that person." };
  const target = db.select({ id: users.id, status: users.status }).from(users).where(eq(users.id, userId)).get();
  if (!target || target.status !== "active") return { error: "That person is not active." };
  const p = parse(fd);
  if (typeof p === "string") return { error: p };
  if (db.select({ id: planItems.id }).from(planItems).where(and(eq(planItems.userId, userId), isNull(planItems.removedAt))).all().length >= MAX_ACTIVE) return { error: `That is ${MAX_ACTIVE} items already: remove one first.` };
  const row = db.insert(planItems).values({ userId, createdBy: me.id, ...p }).returning({ id: planItems.id }).get();
  if (me.id !== userId) notify(userId, { key: `plan-new-${row.id}`, kind: "system", title: "Something new on your plan", body: p.title, href: "/plan" });
  return { done: "Added to the plan." };
}

const itemOf = (id: number) => { const r = db.select().from(planItems).where(eq(planItems.id, id)).get(); return r && !r.removedAt ? r : null; };

/** Records one completion. The person does it for their own items; a manager may record it for someone they run. */
export function logItem(me: Me, itemId: number): string | null {
  const it = itemOf(itemId);
  if (!it) return "That item is gone.";
  if (me.id !== it.userId && !mayManage(me, it.userId)) return "That is not yours to change.";
  const have = countLogs(it.id, it.period, now());
  if (have >= it.need && it.period === "once") return null; // already done: a second press does nothing
  // one tap, one log: ignore a double press within a few seconds
  const last = db.select({ at: planLogs.at }).from(planLogs).where(eq(planLogs.itemId, it.id)).orderBy(desc(planLogs.at)).limit(1).get();
  if (last && now() - last.at < 3) return null;
  db.insert(planLogs).values({ itemId: it.id, by: me.id }).run();
  return null;
}

/** A manager confirms a "once" item is genuinely done, whatever the count. Undo clears it. */
export function signOff(me: Me, itemId: number, undo = false): string | null {
  const it = itemOf(itemId);
  if (!it) return "That item is gone.";
  if (!mayManage(me, it.userId)) return "Only a manager of that person can sign this off.";
  db.update(planItems).set(undo ? { signedOffAt: null, signedOffBy: null } : { signedOffAt: now(), signedOffBy: me.id }).where(eq(planItems.id, it.id)).run();
  if (!undo) notify(it.userId, { key: `plan-signoff-${it.id}`, kind: "system", title: "Signed off on your plan", body: it.title, href: "/plan" });
  return null;
}

/** Removes an item: its owner for items they added, or a manager of that person. Kept in the table, so the history stays. */
export function removeItem(me: Me, itemId: number): string | null {
  const it = itemOf(itemId);
  if (!it) return null;
  const own = me.id === it.userId && it.createdBy === me.id;
  if (!own && !mayManage(me, it.userId)) return "You cannot remove that. Ask the person who set it.";
  db.update(planItems).set({ removedAt: now() }).where(eq(planItems.id, it.id)).run();
  return null;
}
