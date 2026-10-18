import { eq, inArray } from "drizzle-orm";
import { brands, companies, db, projects, users } from "@/lib/db";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { levelsPassed } from "@/lib/progress";
import { loadRoles } from "@/lib/lifecycle/roles";
import { isTechRole } from "@/lib/lifecycle/model";
import { UNLOCK_LEVEL, journeyState, stagesOf, type Passed, type Reach } from "@/lib/lifecycle/order";

/**
 * A role's learning journey is taken in order (lib/lifecycle/order.ts). By default it is a hard lock: a track in a later stage cannot be started
 * until every track in the earlier stages has been taken to UNLOCK_LEVEL. A company can set "hard" (people cannot change it), "choice" (the
 * default: hard unless a person switches themselves to flexible) or "soft" (never locks, only recommends the order).
 *
 * The lock only stops someone starting a track they have no level in; anyone part-way through a track can always carry on.
 * It applies to learners with a job role that has a ladder. Managers and admins are never locked. A placement check counts as passing,
 * so a person who already knows a stage can test out of it.
 */
export type Setting = "choice" | "hard" | "soft";
const STRICT: Record<Setting, number> = { hard: 2, choice: 1, soft: 0 };

/** The company setting that applies to someone: the strictest of the companies they belong to (directly, or through a brand or project). */
export function settingFor(userId: number): Setting {
  const scopes = scopesOf(userId);
  const ids = new Set<number>(scopes.filter((s) => s.kind === "company").map((s) => s.id));
  const brandIds = scopes.filter((s) => s.kind === "brand").map((s) => s.id), projectIds = scopes.filter((s) => s.kind === "project").map((s) => s.id);
  if (brandIds.length) for (const b of db.select({ c: brands.companyId }).from(brands).where(inArray(brands.id, brandIds)).all()) if (b.c != null) ids.add(b.c);
  if (projectIds.length) for (const p of db.select({ c: projects.companyId }).from(projects).where(inArray(projects.id, projectIds)).all()) if (p.c != null) ids.add(p.c);
  if (!ids.size) return "choice";
  const rows = db.select({ s: companies.journeyLock }).from(companies).where(inArray(companies.id, [...ids])).all().map((r) => r.s as Setting);
  return rows.length ? rows.reduce((a, b) => (STRICT[b] > STRICT[a] ? b : a)) : "choice";
}

export type JourneyTrack = { slug: string; name: string; passed: number; need: number; open: boolean };
export type JourneyStage = { n: number; state: "done" | "current" | "locked"; tracks: JourneyTrack[]; waitingOn: string[] };
export type Journey = {
  roleKey: string; roleName: string;
  /** the company's setting, and whether this person can switch themselves */
  setting: Setting; canSwitch: boolean;
  /** locking is on for this person right now */
  locked: boolean;
  stages: JourneyStage[];
  /** tracks this person cannot start yet: slug -> the stage it is in and the track names to pass first (empty when locking is off) */
  locks: Record<string, { stage: number; waitingOn: { slug: string; name: string }[] }>;
  /** the same, whether or not locking is on: the order that is recommended */
  advice: Record<string, { stage: number; waitingOn: { slug: string; name: string }[] }>;
  /** the first stage not done (1-based), and how many there are */
  current: number; total: number;
};

/** Where a person stands in their role's journey, or null when they have no journey (no job role with a ladder, or a customer). */
export function journeyFor(userId: number): Journey | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.audience !== "staff") return null;
  const role = loadRoles().find((r) => r.key === u.jobRole.toLowerCase());
  if (!role) return null;
  const scopes = scopesOf(u.id), cat = catalog();
  const mine = cat.filter((t) => role.tracks.includes(t.slug) && inScope(t, u.audience, scopes));
  if (!mine.length) return null;
  const bySlug = new Map(mine.map((t) => [t.slug, t]));
  const passed: Passed = {}, reach: Reach = {};
  for (const t of mine) { passed[t.slug] = levelsPassed(u.id, t.id); reach[t.slug] = t.reach; }
  // a track the ladder only asks for at a low level is awareness, not a skill to gate on: it is not part of the order
  const asked = (slug: string) => (role.entry?.[slug] ?? UNLOCK_LEVEL) >= UNLOCK_LEVEL;
  // the role's own craft: what its ladder asks for at the entry rung (supporting skills come in on later rungs)
  const entryRung = Math.min(...Object.values(role.firstRung ?? { x: 2 }));
  const craft = new Set(Object.entries(role.firstRung ?? {}).filter(([, r]) => r === entryRung).map(([t]) => t));
  const cap: Reach = {};
  for (const [slug, level] of Object.entries(role.entry ?? {})) cap[slug] = level;
  const stages = stagesOf([...bySlug.keys()].filter(asked), isTechRole(role), craft);
  const states = journeyState(stages, passed, reach, () => true, cap);

  const setting = settingFor(u.id);
  const soft = setting === "soft" || (setting === "choice" && u.journeyMode === "soft");
  const exempt = u.role !== "learner"; // managers and admins are never locked
  const locked = !soft && !exempt;
  const name = (slug: string) => (bySlug.get(slug)?.name ?? slug).replace(/^\d+\.\s*/, "");
  const advice: Journey["advice"] = {};
  const outStages: JourneyStage[] = states.map((s) => ({
    n: s.stage.n, state: s.state, waitingOn: s.waitingOn.map(name),
    tracks: s.stage.tracks.map((slug) => ({ slug, name: name(slug), passed: passed[slug] ?? 0, need: Math.min(UNLOCK_LEVEL, cap[slug] ?? UNLOCK_LEVEL, reach[slug] ?? 0), open: true })),
  }));
  for (const s of states) if (s.state === "locked") for (const slug of s.stage.tracks) if ((passed[slug] ?? 0) === 0) advice[slug] = { stage: s.stage.n, waitingOn: s.waitingOn.map((w) => ({ slug: w, name: name(w) })) };
  const current = states.findIndex((s) => s.state !== "done");
  return { roleKey: role.key, roleName: role.name, setting, canSwitch: setting === "choice" && !exempt, locked, stages: outStages, locks: locked ? advice : {}, advice, current: current < 0 ? stages.length : current + 1, total: stages.length };
}

/** Why a track cannot be started yet because of the journey order, or null. Checked before an exam starts, so the lock holds without the page that shows it. */
export function orderLockFor(userId: number, trackId: number): { stage: number; waitingOn: { slug: string; name: string }[] } | null {
  const slug = catalog().find((t) => t.id === trackId)?.slug;
  if (!slug) return null;
  return journeyFor(userId)?.locks[slug] ?? null;
}
