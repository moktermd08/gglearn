import { eq } from "drizzle-orm";
import { db, roleChanges, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { type Scope, scopesOf } from "@/lib/paths";
import { isGlobal, reachOf, scopeInReach, userInReach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";

/**
 * Access level: what a person may do inside the academy (users.role). Not their job role, which decides what they learn.
 *
 * - learner: learns. No admin screens.
 * - manager: runs the people in their companies: invites and onboards learners, sees who is up to date.
 * - admin: also sets up tracks, what is required, rewards and tool access, and runs managers.
 *
 * A manager or admin with NO scopes runs the whole academy (lib/tenancy.ts), so the rules below never create one: whoever is given
 * manager or admin access must already belong to something, and everything they belong to must be something the granter runs.
 * Only the platform owner (an admin with no scopes) makes an admin, so a company's admin can bring in managers but never another admin.
 */
export type Level = "learner" | "manager" | "admin";
type Me = { id: number; role: Level };

export const LEVELS: { key: Level; label: string; blurb: string }[] = [
  { key: "learner", label: "Learner", blurb: "Learns. No admin screens." },
  { key: "manager", label: "Manager", blurb: "Runs the people in their company: invites and onboards learners, sees who is up to date." },
  { key: "admin", label: "Admin", blurb: "Everything a manager does, plus tracks, what is required, rewards, tool access and managers." },
];
const RANK: Record<Level, number> = { learner: 0, manager: 1, admin: 2 };
export const isLevel = (v: string): v is Level => v === "learner" || v === "manager" || v === "admin";

/** The levels this person may hand out above learner (the choices the forms offer). Empty for anyone who may not grant access. */
export function grantableLevels(me: Me): Exclude<Level, "learner">[] {
  if (me.role !== "admin") return [];
  return isGlobal(reachOf(me.id)) ? ["manager", "admin"] : ["manager"];
}

/**
 * Why `me` may not give `to` to someone who belongs to `scopes`, or null when they may. Used when changing a person, creating one,
 * and again when an invite is used. "learner" is always allowed: taking access away is never the risk.
 */
export function refuseAccess(me: Me, to: Level, scopes: Scope[], audience: "staff" | "customer"): string | null {
  if (to === "learner") return null;
  if (me.role !== "admin") return "Only an admin can give manager or admin access.";
  if (audience !== "staff") return "Customers cannot be managers or admins.";
  if (!scopes.length) return "Pick the company, brand or project they will run first. With none, manager access would cover the whole academy.";
  const reach = reachOf(me.id);
  if (scopes.some((s) => !scopeInReach(reach, s))) return "They belong to something you do not run, so you cannot give them manager access.";
  if (to === "admin" && !isGlobal(reach)) return "Only the platform owner can make an admin.";
  return null;
}

/** The access an invite really gives when it is used: what the inviter asked for, if the inviter may still give it today. Otherwise learner. */
export function levelForInvite(inv: { role: Level; createdBy: number; scopes: Scope[]; audience: "staff" | "customer" }): Level {
  if (inv.role === "learner") return "learner";
  const by = db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, inv.createdBy)).get();
  if (!by || by.status !== "active") return "learner"; // the inviter left, or was demoted, since sending it
  return refuseAccess({ id: by.id, role: by.role }, inv.role, inv.scopes, inv.audience) ? "learner" : inv.role;
}

/** Changes one person's access level, with a note in the role history and a notice to them. Everything is re-checked here, not trusted from the page. */
export function setAccessLevel(me: Me, fd: FormData): SetupState {
  const userId = Number(fd.get("userId")), to = String(fd.get("access") ?? "");
  const u = Number.isInteger(userId) ? db.select().from(users).where(eq(users.id, userId)).get() : undefined;
  if (!u) return { error: "Pick a person." };
  if (!isLevel(to)) return { error: "Pick Learner, Manager or Admin." };
  if (me.role !== "admin") return { error: "Only an admin can change access." };
  if (u.id === me.id) return { error: "Nobody changes their own access." };
  if (u.status !== "active") return { error: "That person is not active." };
  const reach = reachOf(me.id);
  if (!userInReach(reach, u.id)) return { error: "You do not run that person." };
  if (u.role === "admin" && !isGlobal(reach)) return { error: "Only the platform owner can change an admin's access." };
  if (to === u.role) return { error: `They already have ${to} access.` };
  const no = refuseAccess(me, to, scopesOf(u.id), u.audience);
  if (no) return { error: no };

  const up = RANK[to] > RANK[u.role];
  db.transaction((tx) => {
    tx.update(users).set({ role: to }).where(eq(users.id, u.id)).run();
    tx.insert(roleChanges).values({ userId: u.id, fromRole: `access: ${u.role}`, toRole: `access: ${to}`, kind: up ? "promotion" : "demotion", note: "Access level changed", decidedBy: me.id }).run();
    notify(u.id, { key: `access-${u.id}-${Date.now()}`, kind: "system", title: up ? `You now have ${to} access` : `Your access is now ${to}`, body: LEVELS.find((l) => l.key === to)!.blurb, href: up ? "/admin" : "/dashboard" }, { tx });
  });
  return { done: `${u.name} now has ${to} access.` };
}
