import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { brands, db, phaseSignoffs, projects, users } from "@/lib/db";
import { type Requirement, type Scope, requirementsFor, scopesOf } from "@/lib/paths";

/**
 * Onboarding phases, and the gate between them. A required track belongs to the phase its deadline (`dueDays`) falls in. A manager
 * signs a phase once all of its required learning is passed, and until then required learning in any later phase stays locked.
 * Nothing here names a company: the phases are the same for every one, and a company changes when something is due by changing
 * the track's deadline.
 */
export const PHASES = [
  { key: "d1", label: "Day 1", upTo: 1 },
  { key: "w1", label: "Week 1", upTo: 7 },
  { key: "d30", label: "First 30 days", upTo: 30 },
  { key: "d60", label: "First 60 days", upTo: 60 },
  { key: "d90", label: "First 90 days", upTo: Infinity },
] as const;
export type PhaseKey = (typeof PHASES)[number]["key"];

/** After this many days the gates lift: someone who joined long ago is not held back by a process that has finished. */
export const GATE_DAYS = 90;
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

export const phaseOf = (dueDays: number): PhaseKey => PHASES.find((p) => dueDays <= p.upTo)!.key;
export const isPhase = (v: string): v is PhaseKey => PHASES.some((p) => p.key === v);

export type PhaseState = "signed" | "ready" | "open" | "locked";
export type PhaseStatus = {
  key: PhaseKey;
  label: string;
  reqs: Requirement[];
  state: PhaseState; // signed: done and signed. ready: all passed, waiting for a manager. open: current, work left. locked: an earlier phase is not signed
  signed?: { id: number; by: string; at: number; note: string };
};
export type Onboarding = {
  phases: PhaseStatus[]; // only phases that have required learning
  gated: boolean; // false once the person is past GATE_DAYS
  locked: Map<number, { phase: string; waitingOn: string }>; // trackId -> why it cannot be started yet
};

type Person = { id: number; jobRole: string; audience: "staff" | "customer"; createdAt: number };

/** Where a person stands in onboarding: each phase with required learning, whether it is signed, and which tracks the gate holds back. */
export function onboardingFor(person: Person, scopes: Scope[] = scopesOf(person.id)): Onboarding {
  const reqs = requirementsFor(person, scopes);
  const signed = new Map(
    db.select({ s: phaseSignoffs, by: users.name }).from(phaseSignoffs).innerJoin(users, eq(users.id, phaseSignoffs.signedBy))
      .where(and(eq(phaseSignoffs.userId, person.id), isNull(phaseSignoffs.revokedAt))).all().map((r) => [r.s.phase, { id: r.s.id, by: r.by, at: r.s.signedAt, note: r.s.note }]),
  );
  const gated = now() - person.createdAt < GATE_DAYS * DAY;
  const locked: Onboarding["locked"] = new Map();
  let blocker: string | null = null; // label of the first phase that is not signed
  const phases: PhaseStatus[] = [];
  for (const p of PHASES) {
    const mine = reqs.filter((r) => phaseOf(r.track.dueDays) === p.key);
    if (!mine.length) continue;
    const sig = signed.get(p.key);
    const allDone = mine.every((r) => r.done);
    const state: PhaseState = sig ? "signed" : blocker && gated ? "locked" : allDone ? "ready" : "open";
    phases.push({ key: p.key, label: p.label, reqs: mine, state, signed: sig });
    if (state === "locked") for (const r of mine) if (!r.done) locked.set(r.track.id, { phase: p.label, waitingOn: blocker! });
    if (!sig) blocker ??= p.label;
  }
  return { phases, gated, locked };
}

/** Why a track cannot be started yet, or null. Used before an exam starts, so the gate holds even without the page that shows it. */
export function gateFor(userId: number, trackId: number): { phase: string; waitingOn: string } | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return null;
  return onboardingFor(u).locked.get(trackId) ?? null;
}

/** Companies, brands and projects a manager covers: their own scopes, and everything under a company or brand they have. */
function coverage(scopes: Scope[]): Set<string> {
  const keys = new Set(scopes.map((s) => `${s.kind}:${s.id}`));
  const companyIds = scopes.filter((s) => s.kind === "company").map((s) => s.id);
  const brandIds = scopes.filter((s) => s.kind === "brand").map((s) => s.id);
  if (companyIds.length) {
    for (const b of db.select({ id: brands.id }).from(brands).where(inArray(brands.companyId, companyIds)).all()) { keys.add(`brand:${b.id}`); brandIds.push(b.id); }
  }
  const under = [companyIds.length && inArray(projects.companyId, companyIds), brandIds.length && inArray(projects.brandId, brandIds)].filter(Boolean) as ReturnType<typeof inArray>[];
  if (under.length) for (const p of db.select({ id: projects.id }).from(projects).where(or(...under)).all()) keys.add(`project:${p.id}`);
  return keys;
}

/**
 * May this manager sign off this person? Admins can sign anyone. A manager can sign people who share a company, brand or project with
 * them, so one company's manager cannot sign another's staff. A manager with no scope at all keeps the global reach older accounts had.
 */
export function canSignOff(manager: { id: number; role: string }, learnerId: number): boolean {
  if (manager.id === learnerId) return false; // nobody signs off their own onboarding, admins included
  if (manager.role === "admin") return true;
  if (manager.role !== "manager") return false;
  const mine = scopesOf(manager.id);
  if (!mine.length) return true;
  const cover = coverage(mine);
  return scopesOf(learnerId).some((s) => cover.has(`${s.kind}:${s.id}`));
}

/** Phases waiting for a manager, across everyone this manager may sign. */
export function awaitingSignoff(manager: { id: number; role: string }): { person: typeof users.$inferSelect; phase: PhaseStatus }[] {
  const out: { person: typeof users.$inferSelect; phase: PhaseStatus }[] = [];
  for (const person of db.select().from(users).where(eq(users.status, "active")).orderBy(users.name).all()) {
    if (!canSignOff(manager, person.id)) continue;
    const o = onboardingFor(person);
    if (!o.gated) continue;
    const ready = o.phases.find((p) => p.state === "ready");
    if (ready) out.push({ person, phase: ready });
  }
  return out;
}

/** The sign-off history for one person, newest first, including ones since revoked. */
export function signoffHistory(userId: number) {
  return db.select({ s: phaseSignoffs, by: users.name }).from(phaseSignoffs).innerJoin(users, eq(users.id, phaseSignoffs.signedBy))
    .where(eq(phaseSignoffs.userId, userId)).orderBy(desc(phaseSignoffs.signedAt)).all();
}
