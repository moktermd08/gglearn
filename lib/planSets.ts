import { and, asc, eq, isNull } from "drizzle-orm";
import { db, planItems, plans, users } from "@/lib/db";
import { canReach } from "@/lib/journey";
import { mayManage } from "@/lib/planItems";
import { notify } from "@/lib/notifications";
import type { SetupState } from "@/lib/setup";

/**
 * Extra plans beside the main one (the person's career goal) and the required-learning plan. A person makes their own, or a manager or admin makes one
 * for someone they run (same reach rule as plan items). A plan may aim at a role, level and date, which then work out their own progress, or be only a list of items.
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };
const nowSec = () => Math.floor(Date.now() / 1000);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
export const MAX_PLANS = 5, NAME_MAX = 60;

export type PlanRow = typeof plans.$inferSelect;

export const plansOf = (userId: number): PlanRow[] =>
  db.select().from(plans).where(and(eq(plans.userId, userId), isNull(plans.removedAt))).orderBy(asc(plans.createdAt), asc(plans.id)).all();

/** One active plan, if it belongs to this person. */
export const planOf = (userId: number, planId: number): PlanRow | null => {
  const r = db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId), isNull(plans.removedAt))).get();
  return r ?? null;
};

/** Makes a plan for `userId`: the person themself, or someone `me` runs. A target is optional but must be somewhere the person can really get to. */
export function addPlan(me: Me, userId: number, fd: FormData): SetupState {
  if (me.id !== userId && !mayManage(me, userId)) return { error: "You do not run that person." };
  const person = db.select().from(users).where(eq(users.id, userId)).get();
  if (!person || person.status !== "active") return { error: "That person is not active." };
  const name = str(fd.get("name"));
  if (!name) return { error: "Give the plan a name." };
  if (name.length > NAME_MAX) return { error: `Keep the name under ${NAME_MAX} characters.` };
  if (plansOf(userId).length >= MAX_PLANS) return { error: `That is ${MAX_PLANS} plans already: remove one first.` };

  let targetRole: string | null = null, targetLevel: number | null = null, targetDate: number | null = null;
  const target = str(fd.get("target")), date = str(fd.get("date"));
  if (target || date) {
    const [role, lv] = target.split("|"), level = Number(lv);
    if (!role || !Number.isInteger(level)) return { error: "Choose a role and level, or leave both empty." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a date for the target." };
    const at = Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000), n = nowSec();
    if (!Number.isFinite(at) || at <= n || at > n + 20 * 365 * 86400) return { error: "The date must be in the future, within 20 years." };
    if (!canReach(person, role, level)) return { error: "That is not somewhere this path can reach." };
    targetRole = role; targetLevel = level; targetDate = at;
  }
  const row = db.insert(plans).values({ userId, createdBy: me.id, name, targetRole, targetLevel, targetDate }).returning({ id: plans.id }).get();
  if (me.id !== userId) notify(userId, { key: `plan-set-${row.id}`, kind: "system", title: "A new plan for you", body: name, href: `/plan?plan=${row.id}` });
  return { done: "Plan created." };
}

/** Removes a plan and its items (kept in the tables, marked removed). The owner removes plans they made; a manager removes any plan of someone they run. */
export function removePlan(me: Me, planId: number): string | null {
  const p = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!p || p.removedAt) return null;
  const own = me.id === p.userId && p.createdBy === me.id;
  if (!own && !mayManage(me, p.userId)) return "You cannot remove that. Ask the person who made it.";
  const t = nowSec();
  db.transaction((tx) => {
    tx.update(plans).set({ removedAt: t }).where(eq(plans.id, p.id)).run();
    tx.update(planItems).set({ removedAt: t }).where(and(eq(planItems.planId, p.id), isNull(planItems.removedAt))).run();
  });
  return null;
}
