import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, phaseSignoffs, userScopes, users } from "@/lib/db";
import { type CatalogTrack, type Progress, type Requirement, type Scope, catalog, loadProgress, requirementsFor, scopesOf } from "@/lib/paths";
import { type Reach, reachOf, userInReach, usersInReach } from "@/lib/tenancy";

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

type Signed = Map<string, { id: number; by: string; at: number; note: string }>;
/** For a list of people: what each call would otherwise look up for itself (the catalogue, everyone's progress, who has signed what). */
export type OnboardingContext = { cat?: CatalogTrack[]; prog?: Progress; signed?: Map<number, Signed> };

const NOT_GATED: Onboarding = { phases: [], gated: false, locked: new Map() };

/**
 * Where a person stands in onboarding: each phase with required learning, whether it is signed, and which tracks the gate holds back.
 * Someone past GATE_DAYS is not being gated, so nothing is worked out for them at all.
 */
export function onboardingFor(person: Person, scopes: Scope[] = scopesOf(person.id), ctx: OnboardingContext = {}): Onboarding {
  const gated = now() - person.createdAt < GATE_DAYS * DAY;
  if (!gated) return NOT_GATED;
  const reqs = requirementsFor(person, scopes, ctx.cat ?? catalog(), undefined, ctx.prog);
  const signed: Signed = ctx.signed ? ctx.signed.get(person.id) ?? new Map() : new Map(
    db.select({ s: phaseSignoffs, by: users.name }).from(phaseSignoffs).innerJoin(users, eq(users.id, phaseSignoffs.signedBy))
      .where(and(eq(phaseSignoffs.userId, person.id), isNull(phaseSignoffs.revokedAt))).all().map((r) => [r.s.phase, { id: r.s.id, by: r.by, at: r.s.signedAt, note: r.s.note }]),
  );
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

/**
 * May this manager sign off this person? Only managers and admins, never for themselves, and only for people inside their reach
 * (lib/tenancy.ts): a company's manager or admin cannot sign another company's staff, and only the platform owner (no scopes) reaches everyone.
 */
export function canSignOff(manager: { id: number; role: string }, learnerId: number): boolean {
  if (manager.id === learnerId) return false; // nobody signs off their own onboarding, admins included
  if (manager.role !== "admin" && manager.role !== "manager") return false;
  return userInReach(reachOf(manager.id), learnerId);
}

/**
 * Phases waiting for a manager, across everyone this manager may sign. Only people still inside the gate window are looked at, and they are looked at together.
 * `within`: only the company or brand they have switched to in the admin.
 */
export function awaitingSignoff(manager: { id: number; role: string }, within?: Reach): { person: typeof users.$inferSelect; phase: PhaseStatus }[] {
  if (manager.role !== "admin" && manager.role !== "manager") return [];
  const mine = usersInReach(reachOf(manager.id)), scoped = within ? usersInReach(within) : null;
  const cutoff = now() - GATE_DAYS * DAY;
  const people = db.select().from(users).where(and(eq(users.status, "active"), gt(users.createdAt, cutoff))).orderBy(users.name).all()
    .filter((u) => u.id !== manager.id && (!mine || mine.has(u.id)) && (!scoped || scoped.has(u.id)));
  if (!people.length) return [];
  const ids = new Set(people.map((u) => u.id));
  const scopesBy = new Map<number, Scope[]>();
  for (const sc of db.select().from(userScopes).all()) if (ids.has(sc.userId)) scopesBy.set(sc.userId, [...(scopesBy.get(sc.userId) ?? []), { kind: sc.kind, id: sc.refId }]);
  const signed = new Map<number, Signed>();
  for (const r of db.select({ s: phaseSignoffs, by: users.name }).from(phaseSignoffs).innerJoin(users, eq(users.id, phaseSignoffs.signedBy)).where(isNull(phaseSignoffs.revokedAt)).all()) {
    if (!ids.has(r.s.userId)) continue;
    signed.set(r.s.userId, (signed.get(r.s.userId) ?? new Map()).set(r.s.phase, { id: r.s.id, by: r.by, at: r.s.signedAt, note: r.s.note }));
  }
  const ctx: OnboardingContext = { cat: catalog(), prog: loadProgress(ids), signed };
  const out: { person: typeof users.$inferSelect; phase: PhaseStatus }[] = [];
  for (const person of people) {
    const ready = onboardingFor(person, scopesBy.get(person.id) ?? [], ctx).phases.find((p) => p.state === "ready");
    if (ready) out.push({ person, phase: ready });
  }
  return out;
}

/** The sign-off history for one person, newest first, including ones since revoked. */
export function signoffHistory(userId: number) {
  return db.select({ s: phaseSignoffs, by: users.name }).from(phaseSignoffs).innerJoin(users, eq(users.id, phaseSignoffs.signedBy))
    .where(eq(phaseSignoffs.userId, userId)).orderBy(desc(phaseSignoffs.signedAt)).all();
}
