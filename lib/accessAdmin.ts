import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brands, companies, db, toolAccess, toolRoleAccess, tools, users } from "@/lib/db";
import { type Level, type RevokeReason, TOOL_CATEGORIES, grantAccess, revokeAccess, toolsFor } from "@/lib/access";
import { roleKey } from "@/lib/roles";
import { slugify, type SetupState } from "@/lib/setup";
import { isGlobal, reachOf, scopeInReach, userInReach } from "@/lib/tenancy";

type Me = { id: number; role: "admin" | "manager" | "learner" };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const LEVELS = ["user", "admin", "owner"] as const;
const REASONS = ["no_longer_needed", "role_change", "demotion", "offboarding", "security", "other"] as const;

/** Only an admin runs the register, and only for tools in a company or brand they run. A global tool (every company) belongs to the platform owner. */
export function canManageTool(me: Me, t: { scope: "global" | "company" | "brand"; refId: number }): boolean {
  if (me.role !== "admin") return false;
  const reach = reachOf(me.id);
  return t.scope === "global" ? isGlobal(reach) : scopeInReach(reach, { kind: t.scope, id: t.refId });
}

/** "global", "company:3" or "brand:7" as stored fields, or null when the person may not put a tool there. */
type Where = { scope: "global" | "company" | "brand"; refId: number };
function parseWhere(me: Me, raw: string): Where | null {
  const [kind, idText] = raw.split(":"), id = Number(idText);
  const w: Where | null = kind === "global" ? { scope: "global", refId: 0 } : (kind === "company" || kind === "brand") && Number.isInteger(id) ? { scope: kind, refId: id } : null;
  if (!w || !canManageTool(me, w)) return null;
  if (w.scope === "company" && !db.select({ id: companies.id }).from(companies).where(eq(companies.id, w.refId)).get()) return null;
  if (w.scope === "brand" && db.select().from(brands).where(eq(brands.id, w.refId)).get()?.kind !== "company") return null;
  return w;
}

const TOOL = z.object({
  name: z.string().min(1, "Give the tool a name.").max(80),
  category: z.enum(TOOL_CATEGORIES),
  sensitivity: z.enum(["standard", "sensitive"]),
  revokeSteps: z.string().max(1000),
});

export function addTool(me: Me, fd: FormData): SetupState {
  const where = parseWhere(me, str(fd.get("where")));
  if (!where) return { error: "Pick a company or brand you run." };
  const p = TOOL.safeParse({ name: str(fd.get("name")), category: str(fd.get("category")) || "other", sensitivity: str(fd.get("sensitivity")) || "standard", revokeSteps: str(fd.get("revokeSteps")) });
  if (!p.success) return { error: p.error.issues[0].message };
  const base = slugify(`${where.scope}-${where.refId}-${p.data.name}`);
  let slug = base;
  for (let n = 2; db.select({ id: tools.id }).from(tools).where(eq(tools.slug, slug)).get(); n++) slug = `${base}-${n}`;
  const ownerId = Number(fd.get("ownerId")) || null;
  if (ownerId != null && !userInReach(reachOf(me.id), ownerId)) return { error: "The owner must be someone you run." };
  db.insert(tools).values({ slug, name: p.data.name, category: p.data.category, sensitivity: p.data.sensitivity, revokeSteps: p.data.revokeSteps, ...where, ownerId }).run();
  return { done: `${p.data.name} added.` };
}

export function updateTool(me: Me, fd: FormData): SetupState {
  const t = db.select().from(tools).where(eq(tools.id, Number(fd.get("toolId")))).get();
  if (!t || !canManageTool(me, t)) return { error: "You cannot change this tool." };
  const p = TOOL.safeParse({ name: str(fd.get("name")), category: str(fd.get("category")) || t.category, sensitivity: str(fd.get("sensitivity")) || t.sensitivity, revokeSteps: str(fd.get("revokeSteps")) });
  if (!p.success) return { error: p.error.issues[0].message };
  const ownerId = Number(fd.get("ownerId")) || null;
  if (ownerId != null && !userInReach(reachOf(me.id), ownerId)) return { error: "The owner must be someone you run." };
  const retired = str(fd.get("retired")) === "yes" ? "yes" : "no";
  db.update(tools).set({ ...p.data, ownerId, retired }).where(eq(tools.id, t.id)).run();
  return { done: `${p.data.name} saved.` };
}

/** Default access for a job role on a tool: a level, or "none" to remove the default. "*" means everyone. */
export function setRoleAccess(me: Me, fd: FormData): SetupState {
  const t = db.select().from(tools).where(eq(tools.id, Number(fd.get("toolId")))).get();
  if (!t || !canManageTool(me, t)) return { error: "You cannot change this tool." };
  const raw = str(fd.get("jobRole")), jobRole = raw === "*" ? "*" : roleKey(raw), level = str(fd.get("level"));
  if (!jobRole) return { error: "Pick a job role, or * for everyone." };
  if (level === "none") { db.delete(toolRoleAccess).where(and(eq(toolRoleAccess.toolId, t.id), eq(toolRoleAccess.jobRole, jobRole))).run(); return { done: "Default removed." }; }
  if (!(LEVELS as readonly string[]).includes(level)) return { error: "Pick a level." };
  db.insert(toolRoleAccess).values({ toolId: t.id, jobRole, level: level as Level }).onConflictDoUpdate({ target: [toolRoleAccess.toolId, toolRoleAccess.jobRole], set: { level: level as Level } }).run();
  return { done: `${jobRole === "*" ? "Everyone" : jobRole} now gets ${level} access by default.` };
}

export function removeRoleAccess(me: Me, id: number): SetupState {
  const r = db.select().from(toolRoleAccess).where(eq(toolRoleAccess.id, id)).get();
  const t = r && db.select().from(tools).where(eq(tools.id, r.toolId)).get();
  if (!r || !t || !canManageTool(me, t)) return { error: "You cannot change this tool." };
  db.delete(toolRoleAccess).where(eq(toolRoleAccess.id, id)).run();
  return { done: "Default removed." };
}

/** Records that someone now has access (after the account was really created in the tool). */
export function grantForm(me: Me, fd: FormData): SetupState {
  const t = db.select().from(tools).where(eq(tools.id, Number(fd.get("toolId")))).get(), level = str(fd.get("level"));
  const email = str(fd.get("email")).toLowerCase(), person = email ? db.select({ id: users.id, status: users.status }).from(users).where(eq(users.email, email)).get() : null;
  const userId = person?.id ?? NaN;
  if (!t || !canManageTool(me, t)) return { error: "You cannot change this tool." };
  if (!person || person.status !== "active" || !userInReach(reachOf(me.id), userId)) return { error: "No active person you run has that email." };
  if (!(LEVELS as readonly string[]).includes(level)) return { error: "Pick a level." };
  if (!toolsFor(userId).some((x) => x.id === t.id)) return { error: "This tool does not belong to that person's company or brand." };
  return grantAccess(userId, t.id, level as Level, "request", me.id) ? { done: "Access recorded." } : { error: "They already have this access, or the tool is retired." };
}

/** Records that access was taken away (after the account was removed in the tool). */
export function revokeForm(me: Me, fd: FormData): SetupState {
  const g = db.select({ g: toolAccess, t: tools }).from(toolAccess).innerJoin(tools, eq(tools.id, toolAccess.toolId)).where(eq(toolAccess.id, Number(fd.get("accessId")))).get();
  const reason = str(fd.get("reason")) || "no_longer_needed";
  if (!g || !canManageTool(me, g.t)) return { error: "You cannot change this tool." };
  if (!(REASONS as readonly string[]).includes(reason)) return { error: "Pick a reason." };
  return revokeAccess(g.g.id, reason as RevokeReason, me.id) ? { done: "Revoked." } : { error: "Already revoked." };
}
