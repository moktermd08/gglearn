import { and, eq, inArray, isNull } from "drizzle-orm";
import { brands, db, toolAccess, toolRoleAccess, tools, users } from "@/lib/db";
import { scopesOf } from "@/lib/paths";

/**
 * The tool access register: which systems exist, who may use them, and what each person holds right now.
 * It records access; it does not change it in the other system. Revoking here makes the to-do ("Revoke GitHub") and the record
 * that it was done; a person still removes the account in the tool, following the tool's `revokeSteps`.
 * Used by onboarding (what to grant), role change, promotion and demotion (what to add or remove), and offboarding (everything left).
 */
export type Level = "user" | "admin" | "owner";
export type Tool = typeof tools.$inferSelect;
export type Grant = typeof toolAccess.$inferSelect;
export type RevokeReason = NonNullable<Grant["revokeReason"]>;
export type GrantReason = Grant["reason"];

export const TOOL_CATEGORIES = ["code", "design", "communication", "finance", "hr", "marketing", "sales", "support", "infrastructure", "analytics", "documentation", "other"] as const;
const RANK: Record<Level, number> = { user: 1, admin: 2, owner: 3 };
const now = () => Math.floor(Date.now() / 1000);

/** Tools that apply to someone: global ones, plus those of their companies and brands (a company covers its brands). */
export function toolsFor(userId: number): Tool[] {
  const scopes = scopesOf(userId);
  const companyIds = new Set(scopes.filter((s) => s.kind === "company").map((s) => s.id));
  const brandIds = new Set(scopes.filter((s) => s.kind === "brand").map((s) => s.id));
  for (const b of db.select({ id: brands.id, companyId: brands.companyId }).from(brands).all()) if (b.companyId != null && companyIds.has(b.companyId)) brandIds.add(b.id);
  return db.select().from(tools).where(eq(tools.retired, "no")).all()
    .filter((t) => t.scope === "global" || (t.scope === "company" && companyIds.has(t.refId)) || (t.scope === "brand" && brandIds.has(t.refId)));
}

/** What a person holds now. */
export function activeAccess(userId: number): { grant: Grant; tool: Tool }[] {
  return db.select({ grant: toolAccess, tool: tools }).from(toolAccess).innerJoin(tools, eq(tools.id, toolAccess.toolId))
    .where(and(eq(toolAccess.userId, userId), isNull(toolAccess.revokedAt))).all();
}

/** Everyone who holds this tool right now: the review list ("who still has access to X?"). */
export function holdersOf(toolId: number) {
  return db.select({ grant: toolAccess, name: users.name, status: users.status }).from(toolAccess).innerJoin(users, eq(users.id, toolAccess.userId))
    .where(and(eq(toolAccess.toolId, toolId), isNull(toolAccess.revokedAt))).all();
}

/** People who left but still hold access: the offboarding audit. */
export function leaversWithAccess() {
  return db.select({ grant: toolAccess, tool: tools, name: users.name }).from(toolAccess).innerJoin(tools, eq(tools.id, toolAccess.toolId)).innerJoin(users, eq(users.id, toolAccess.userId))
    .where(and(isNull(toolAccess.revokedAt), eq(users.status, "offboarded"))).all();
}

/** Give access. Already holding it at this level or higher does nothing; holding it lower raises it (the old grant is closed, so history shows the change). */
export function grantAccess(userId: number, toolId: number, level: Level, reason: GrantReason, by: number | null): boolean {
  const t = db.select().from(tools).where(eq(tools.id, toolId)).get();
  if (!t || t.retired === "yes") return false;
  const held = db.select().from(toolAccess).where(and(eq(toolAccess.userId, userId), eq(toolAccess.toolId, toolId), isNull(toolAccess.revokedAt))).get();
  if (held && RANK[held.level] >= RANK[level]) return false;
  db.transaction((tx) => {
    if (held) tx.update(toolAccess).set({ revokedAt: now(), revokedBy: by, revokeReason: "role_change" }).where(eq(toolAccess.id, held.id)).run();
    tx.insert(toolAccess).values({ userId, toolId, level, reason, grantedBy: by }).run();
  });
  return true;
}

/** Take access away (a record that it was done; the account itself is removed in the tool). */
export function revokeAccess(accessId: number, reason: RevokeReason, by: number | null): boolean {
  return db.update(toolAccess).set({ revokedAt: now(), revokedBy: by, revokeReason: reason }).where(and(eq(toolAccess.id, accessId), isNull(toolAccess.revokedAt))).run().changes > 0;
}

/** The default access for a job role: "*" rows (everyone) plus the role's own, the higher level winning per tool. Only tools that apply to the person. */
export function expectedAccess(userId: number, jobRole: string): Map<number, Level> {
  const mine = new Set(toolsFor(userId).map((t) => t.id));
  const want = new Map<number, Level>();
  if (!mine.size) return want;
  for (const r of db.select().from(toolRoleAccess).where(inArray(toolRoleAccess.toolId, [...mine])).all()) {
    if (r.jobRole !== "*" && r.jobRole !== jobRole) continue;
    const cur = want.get(r.toolId);
    if (!cur || RANK[r.level] > RANK[cur]) want.set(r.toolId, r.level);
  }
  return want;
}

export type AccessChange = { tool: Tool; from: Level | null; to: Level | null; grantId?: number };
export type AccessPlan = { grant: AccessChange[]; raise: AccessChange[]; lower: AccessChange[]; revoke: AccessChange[] };

/**
 * What would change if this person held `jobRole`: access to add, raise, lower and remove. Used for onboarding (everything is "grant"),
 * promotion (mostly raise), demotion (lower and revoke) and role change. Access given by hand for a reason other than the role
 * (`request`, `other`) is left alone: only grants that came from a role are compared.
 */
export function planFor(userId: number, jobRole: string): AccessPlan {
  const want = expectedAccess(userId, jobRole);
  const have = activeAccess(userId);
  const plan: AccessPlan = { grant: [], raise: [], lower: [], revoke: [] };
  const held = new Set<number>();
  for (const { grant, tool } of have) {
    held.add(tool.id);
    const target = want.get(tool.id);
    if (!target) { if (grant.reason !== "request" && grant.reason !== "other") plan.revoke.push({ tool, from: grant.level, to: null, grantId: grant.id }); continue; }
    if (RANK[target] > RANK[grant.level]) plan.raise.push({ tool, from: grant.level, to: target, grantId: grant.id });
    else if (RANK[target] < RANK[grant.level]) plan.lower.push({ tool, from: grant.level, to: target, grantId: grant.id });
  }
  const byId = new Map(toolsFor(userId).map((t) => [t.id, t]));
  for (const [toolId, level] of want) if (!held.has(toolId) && byId.has(toolId)) plan.grant.push({ tool: byId.get(toolId)!, from: null, to: level });
  return plan;
}

/** Carry out a plan. Lowering closes the higher grant and opens the lower one. Returns how many records changed. */
export function applyPlan(userId: number, plan: AccessPlan, reason: "role_change" | "promotion" | "onboarding", by: number | null, why: "role_change" | "demotion" = "role_change"): number {
  let n = 0;
  db.transaction(() => {
    for (const c of plan.grant) if (grantAccess(userId, c.tool.id, c.to!, reason, by)) n++;
    for (const c of plan.raise) if (grantAccess(userId, c.tool.id, c.to!, reason, by)) n++;
    for (const c of plan.lower) if (revokeAccess(c.grantId!, why, by)) { db.insert(toolAccess).values({ userId, toolId: c.tool.id, level: c.to!, reason, grantedBy: by }).run(); n++; }
    for (const c of plan.revoke) if (revokeAccess(c.grantId!, why, by)) n++;
  });
  return n;
}

/** Checklist lines for leaving: one per held tool, sensitive ones first, each naming the owner and how to remove access. */
export function offboardingLines(userId: number): string[] {
  const owners = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name]));
  return activeAccess(userId)
    .sort((a, b) => Number(b.tool.sensitivity === "sensitive") - Number(a.tool.sensitivity === "sensitive") || a.tool.name.localeCompare(b.tool.name))
    .map(({ grant, tool }) => {
      const owner = tool.ownerId != null ? owners.get(tool.ownerId) : null;
      return `Revoke ${tool.name} (${grant.level})${tool.sensitivity === "sensitive" ? " — sensitive, do first" : ""}${owner ? ` — ask ${owner}` : ""}${tool.revokeSteps ? `: ${tool.revokeSteps}` : ""}`;
    });
}

/** Onboarding checklist lines: the access this role starts with. */
export function onboardingLines(userId: number, jobRole: string): string[] {
  return planFor(userId, jobRole).grant.map((c) => `Get ${c.tool.name} access (${c.to})${c.tool.ownerId ? "" : " — no owner set"}`);
}
