import { desc, eq } from "drizzle-orm";
import { db, roleChanges, users } from "@/lib/db";
import { type AccessChange, type AccessPlan, applyPlan, planFor } from "@/lib/access";
import { canManageTool } from "@/lib/accessAdmin";
import { type CatalogTrack, requirementsFor, scopesOf, syncRequired } from "@/lib/paths";
import { roleKey } from "@/lib/roles";
import { reachOf, userInReach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";

type Me = { id: number; role: "admin" | "manager" | "learner" };
export type Kind = "promotion" | "demotion" | "role_change";
export const KINDS: { key: Kind; label: string }[] = [{ key: "role_change", label: "Sideways move or new role" }, { key: "promotion", label: "Promotion" }, { key: "demotion", label: "Demotion" }];
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** May this person change that person's role? Same rules as everywhere: in reach, not yourself, and only an admin for a manager or admin. */
export function mayChangeRole(me: Me, target: { id: number; role: string; status: string }): string | null {
  if (me.role !== "admin" && me.role !== "manager") return "Only managers and admins can change a role.";
  if (target.id === me.id) return "Nobody changes their own role.";
  if (target.status !== "active") return "That person is not active.";
  if (!userInReach(reachOf(me.id), target.id)) return "You do not run that person.";
  if (me.role !== "admin" && target.role !== "learner") return "Only an admin can change a manager's role.";
  return null;
}

export type Preview = { from: string; to: string; learning: { added: CatalogTrack[]; dropped: CatalogTrack[] }; access: AccessPlan };

/** What the move would change: required learning that appears or goes, and access to add, raise, lower or remove. Changes nothing. */
export function previewRoleChange(userId: number, newRole: string): Preview | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return null;
  const to = roleKey(newRole), scopes = scopesOf(u.id);
  const idsOf = (role: string) => new Map(requirementsFor({ id: u.id, jobRole: role, audience: u.audience }, scopes).map((r) => [r.track.id, r.track]));
  const before = idsOf(u.jobRole), after = idsOf(to);
  return {
    from: u.jobRole, to,
    learning: { added: [...after].filter(([id]) => !before.has(id)).map(([, t]) => t), dropped: [...before].filter(([id]) => !after.has(id)).map(([, t]) => t) },
    access: planFor(u.id, to),
  };
}

const LEVEL_NAME = (l: string | null) => l ?? "none";
/** One plain line per change, for the person who must do it in the tool. */
export function describeChange(kind: "add" | "raise" | "lower" | "remove", c: AccessChange, ownerName: (id: number | null) => string | null): string {
  const owner = ownerName(c.tool.ownerId), ask = owner ? ` (ask ${owner})` : "";
  if (kind === "add") return `Add ${c.tool.name} at ${LEVEL_NAME(c.to)}${ask}`;
  if (kind === "raise") return `Raise ${c.tool.name} from ${LEVEL_NAME(c.from)} to ${LEVEL_NAME(c.to)}${ask}`;
  if (kind === "lower") return `Lower ${c.tool.name} from ${LEVEL_NAME(c.from)} to ${LEVEL_NAME(c.to)}${ask}`;
  return `Remove ${c.tool.name}${c.tool.sensitivity === "sensitive" ? " (sensitive, do first)" : ""}${ask}${c.tool.revokeSteps ? `: ${c.tool.revokeSteps}` : ""}`;
}

const planLines = (p: AccessPlan, ownerName: (id: number | null) => string | null) => [
  ...[...p.revoke].sort((a, b) => Number(b.tool.sensitivity === "sensitive") - Number(a.tool.sensitivity === "sensitive")).map((c) => describeChange("remove", c, ownerName)),
  ...p.lower.map((c) => describeChange("lower", c, ownerName)), ...p.raise.map((c) => describeChange("raise", c, ownerName)), ...p.grant.map((c) => describeChange("add", c, ownerName)),
];

/**
 * Changes someone's role: the role itself, the learning it requires, and the access register, in one step, with the reason on record.
 * A promotion or demotion needs a reason. Register changes are made only for tools this person runs (admins); anything else is listed
 * for an admin to do. Either way the register is a record: the accounts themselves are changed in the tools, from the list returned.
 */
export function applyRoleChange(me: Me, fd: FormData): SetupState & { todo?: string[] } {
  const userId = Number(fd.get("userId")), kind = str(fd.get("kind")) as Kind, note = str(fd.get("note")).slice(0, 1000), to = roleKey(str(fd.get("jobRole")));
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return { error: "Pick a person." };
  const no = mayChangeRole(me, u);
  if (no) return { error: no };
  if (!KINDS.some((k) => k.key === kind)) return { error: "Say whether this is a promotion, a demotion or a role change." };
  if (!to || to.length > 40) return { error: "Enter a role of up to 40 characters." };
  if (to === u.jobRole) return { error: "That is already their role." };
  if (kind !== "role_change" && note.length < 3) return { error: `Give the reason for the ${kind === "promotion" ? "promotion" : "demotion"}.` };

  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((x) => [x.id, x.name]));
  const owner = (id: number | null) => (id != null ? names.get(id) ?? null : null);
  const full = planFor(u.id, to);
  const mine = (cs: AccessChange[]) => cs.filter((c) => canManageTool(me, c.tool));
  const own: AccessPlan = { grant: mine(full.grant), raise: mine(full.raise), lower: mine(full.lower), revoke: mine(full.revoke) };
  const left: AccessPlan = { grant: full.grant.filter((c) => !own.grant.includes(c)), raise: full.raise.filter((c) => !own.raise.includes(c)), lower: full.lower.filter((c) => !own.lower.includes(c)), revoke: full.revoke.filter((c) => !own.revoke.includes(c)) };
  const todo = planLines(full, owner), forAdmin = planLines(left, owner);

  db.transaction((tx) => {
    tx.update(users).set({ jobRole: to }).where(eq(users.id, u.id)).run();
    syncRequired({ id: u.id, jobRole: to, audience: u.audience }, tx);
    applyPlan(u.id, own, kind === "promotion" ? "promotion" : "role_change", me.id, kind === "demotion" ? "demotion" : "role_change");
    tx.insert(roleChanges).values({ userId: u.id, fromRole: u.jobRole, toRole: to, kind, note, actions: todo.join("\n"), decidedBy: me.id }).run();
  });
  return { done: `${u.name} is now ${to}.${forAdmin.length ? ` ${forAdmin.length} access change${forAdmin.length === 1 ? "" : "s"} need an admin.` : ""}`, todo };
}

/** Recent role changes, newest first; one person's, or everyone's within the people given. */
export function roleHistory(userId?: number, limit = 30) {
  const q = db.select({ c: roleChanges, who: users.name }).from(roleChanges).innerJoin(users, eq(users.id, roleChanges.userId));
  return (userId ? q.where(eq(roleChanges.userId, userId)) : q).orderBy(desc(roleChanges.createdAt)).limit(limit).all();
}
