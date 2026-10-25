"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { applyRoleChange, describeChange, mayChangeRole, previewRoleChange } from "@/lib/roleChange";
import { changePlaces } from "@/lib/placeChange";
import { type Audience, parseScopes, requirementsFor, validScopes } from "@/lib/paths";
import { coverageFor, hasNoRolePath, roleKey } from "@/lib/roles";
import { reachOf, scopeInReach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";

/**
 * Actions the People page adds on top of the ones in app/actions.ts. Nothing here grants anything new: each one runs the same lib function the
 * old screens did (and checks the caller again), so the rules are the ones in lib/accessLevel.ts, lib/tenancy.ts, lib/placeChange.ts and lib/roleChange.ts.
 */

export type PlanPreview =
  | { error: string }
  | { required: { name: string; tier: "mandatory" | "role"; level: number; days: number }[]; noRolePath: boolean };

/** What someone with this role, kind and places would be required to learn today. Read-only, and only for places the caller runs. */
export async function previewPlan(input: { jobRole: string; audience: string; scopes: string }): Promise<PlanPreview> {
  const me = await requireManager();
  const jobRole = roleKey(String(input.jobRole ?? "")), audience: Audience = input.audience === "customer" ? "customer" : "staff";
  const scopes = validScopes(db, parseScopes(String(input.scopes ?? "")));
  const reach = reachOf(me.id);
  if (!scopes.length || scopes.some((s) => !scopeInReach(reach, s))) return { error: "Pick places you run." };
  if (!jobRole) return { error: "Enter a role." };
  const required = requirementsFor({ id: 0, jobRole, audience }, scopes).map((r) => ({ name: r.track.name.replace(/^\d+\.\s*/, ""), tier: r.why, level: r.track.requiredLevel, days: r.track.dueDays }));
  return { required, noRolePath: audience === "staff" && hasNoRolePath(coverageFor(jobRole)) };
}

export type RolePreview = { error: string } | { from: string; to: string; added: string[]; dropped: string[]; access: { tone: "ok" | "warn" | "bad"; text: string }[]; adminOnly: boolean };

/** The "what changes" the Change a role page shows, for the edit panel. Changes nothing. */
export async function previewRole(userId: number, newRole: string): Promise<RolePreview> {
  const me = await requireManager();
  const u = db.select().from(users).where(eq(users.id, Number(userId))).get();
  if (!u) return { error: "Pick a person." };
  const no = mayChangeRole(me, u);
  if (no) return { error: no };
  if (!newRole.trim() || newRole.trim().length > 40) return { error: "Enter a role of up to 40 characters." };
  const p = previewRoleChange(u.id, newRole);
  if (!p) return { error: "Pick a person." };
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((x) => [x.id, x.name]));
  const owner = (id: number | null) => (id != null ? names.get(id) ?? null : null);
  const line = (kind: "add" | "raise" | "lower" | "remove", c: Parameters<typeof describeChange>[1]) => describeChange(kind, c, owner);
  const a = p.access;
  const clean = (t: { name: string }) => t.name.replace(/^\d+\.\s*/, "");
  return {
    from: p.from, to: p.to, added: p.learning.added.map(clean), dropped: p.learning.dropped.map(clean), adminOnly: me.role !== "admin",
    access: [
      ...[...a.revoke].sort((x, y) => Number(y.tool.sensitivity === "sensitive") - Number(x.tool.sensitivity === "sensitive")).map((c) => ({ tone: "bad" as const, text: line("remove", c) })),
      ...a.lower.map((c) => ({ tone: "warn" as const, text: line("lower", c) })),
      ...a.raise.map((c) => ({ tone: "ok" as const, text: line("raise", c) })),
      ...a.grant.map((c) => ({ tone: "ok" as const, text: line("add", c) })),
    ],
  };
}

export type RoleDone = (SetupState & { todo?: string[] }) | null;

/** Applies a role change (the same function as the Change a role page) and stays on the People page. */
export async function applyRole(_: RoleDone, fd: FormData): Promise<RoleDone> {
  const r = applyRoleChange(await requireManager(), fd);
  if (r?.done) for (const p of ["/admin/role-change", "/admin/people", "/admin/compliance", "/admin/careers", "/admin/access"]) revalidatePath(p);
  return r;
}

/** Saves where someone belongs and says why when it is refused (the old form refused silently). Same rules, in lib/placeChange.ts. */
export async function savePlaces(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await requireManager();
  const userId = Number(fd.get("userId"));
  const scopes = validScopes(db, parseScopes(fd.getAll("scope").filter((v): v is string => typeof v === "string").join(",")));
  const no = changePlaces(me.id, userId, scopes);
  if (no) return { error: no };
  revalidatePath("/admin/people"); revalidatePath("/admin/compliance");
  return { done: "Saved. They are enrolled in what is now required of them." };
}
