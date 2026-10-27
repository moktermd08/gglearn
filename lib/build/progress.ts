import { and, desc, eq } from "drizzle-orm";
import { buildProjects, buildSteps, db } from "@/lib/db";
import { RANKS } from "@/content/build/steps";
import { templateBySlug } from "@/content/build/projects";
import { GithubError, openRepo, runCheck } from "./github";
import type { Rank, Stage, Step } from "./types";

export type Project = typeof buildProjects.$inferSelect;

export const STEPS: { step: Step; rank: Rank; stage: Stage }[] = RANKS.flatMap((rank) => rank.stages.flatMap((stage) => stage.steps.map((step) => ({ step, rank, stage }))));

const now = () => Math.floor(Date.now() / 1000);

/** Puts the person's own project into a step's wording: {name}, {pitch}, {customer}, {mvp}, {stack}, {agent}, {launch}. */
export function fill(text: string, p: Pick<Project, "name" | "pitch" | "customer" | "templateSlug">): string {
  const t = templateBySlug(p.templateSlug) ?? templateBySlug("custom")!;
  const bare = (s: string) => s.replace(/[.\s]+$/, ""); // prompts add their own full stop
  const vars: Record<string, string> = { name: p.name, pitch: bare(p.pitch || t.pitch), customer: bare(p.customer || t.customer), mvp: t.mvp.join("; "), stack: t.stack, agent: t.agent, launch: t.launch };
  return text.replace(/\{(name|pitch|customer|mvp|stack|agent|launch)\}/g, (_, k: string) => vars[k]);
}

export function projectsFor(userId: number): Project[] {
  return db.select().from(buildProjects).where(eq(buildProjects.userId, userId)).orderBy(desc(buildProjects.createdAt)).all();
}

/** The person's own project, or undefined: every read and write goes through this, so nobody reaches another person's project by id. */
export function projectFor(userId: number, id: number): Project | undefined {
  return db.select().from(buildProjects).where(and(eq(buildProjects.id, id), eq(buildProjects.userId, userId))).get();
}

export function createProject(userId: number, v: { templateSlug: string; name: string; pitch: string; customer: string }): Project {
  return db.insert(buildProjects).values({ userId, ...v }).returning().get();
}

export function deleteProject(p: Project) {
  db.delete(buildSteps).where(eq(buildSteps.projectId, p.id)).run();
  db.delete(buildProjects).where(eq(buildProjects.id, p.id)).run();
}

export function setLinks(p: Project, repo: string | null, siteUrl: string | null) {
  // a different repository means the old evidence no longer applies
  if ((p.repo ?? null) !== repo) db.delete(buildSteps).where(and(eq(buildSteps.projectId, p.id), eq(buildSteps.how, "github"))).run();
  db.update(buildProjects).set({ repo, siteUrl, checked: null, updatedAt: now() }).where(eq(buildProjects.id, p.id)).run();
}

export type Done = Map<string, { how: "github" | "self"; evidence: string; doneAt: number }>;

export function doneFor(projectId: number): Done {
  return new Map(db.select().from(buildSteps).where(eq(buildSteps.projectId, projectId)).all().map((r) => [r.stepKey, { how: r.how, evidence: r.evidence, doneAt: r.doneAt }]));
}

export type Summary = { done: number; total: number; ranks: { rank: Rank; done: number; total: number }[]; next: string | null };

export function summary(done: Done): Summary {
  const ranks = RANKS.map((rank) => {
    const keys = rank.stages.flatMap((s) => s.steps.map((x) => x.key));
    return { rank, total: keys.length, done: keys.filter((k) => done.has(k)).length };
  });
  return { done: STEPS.filter((s) => done.has(s.step.key)).length, total: STEPS.length, ranks, next: STEPS.find((s) => !done.has(s.step.key))?.step.key ?? null };
}

/**
 * Reads the project's repository and updates every step that GitHub can prove. Steps GitHub proves follow the repository (a step is un-ticked if its file is
 * deleted); steps the person ticked themselves are never touched. When GitHub cannot be reached nothing is changed: a GithubError says why.
 */
export async function verify(p: Project): Promise<{ ticked: number; total: number }> {
  if (!p.repo) throw new GithubError("Add the address of your GitHub repository first.");
  const repo = openRepo(p.repo, p.siteUrl);
  await repo.meta(); // fails first, and clearly, for a missing or private repository
  const auto = STEPS.filter((s) => s.step.check.kind !== "self");
  let results;
  try { results = await Promise.all(auto.map(async (s) => [s.step, await runCheck(s.step.check, repo)] as const)); }
  catch (e) { throw e instanceof GithubError ? e : new GithubError("Something went wrong while reading GitHub. Try again in a moment."); }

  const had = doneFor(p.id);
  const hints: Record<string, string> = {};
  db.transaction((tx) => {
    for (const [step, r] of results) {
      if (r.unknown) continue;
      const row = had.get(step.key);
      if (r.ok) {
        if (!row) tx.insert(buildSteps).values({ projectId: p.id, stepKey: step.key, how: "github", evidence: r.evidence }).run();
        else if (row.how === "github" && row.evidence !== r.evidence) tx.update(buildSteps).set({ evidence: r.evidence }).where(and(eq(buildSteps.projectId, p.id), eq(buildSteps.stepKey, step.key))).run();
      } else {
        hints[step.key] = r.hint;
        if (row?.how === "github") tx.delete(buildSteps).where(and(eq(buildSteps.projectId, p.id), eq(buildSteps.stepKey, step.key))).run();
      }
    }
    tx.update(buildProjects).set({ checked: { at: now(), hints }, updatedAt: now() }).where(eq(buildProjects.id, p.id)).run();
  });
  return { ticked: results.filter(([, r]) => r.ok).length, total: results.length };
}

/** Ticks a step the person vouches for. Only steps whose check is "self" can be ticked this way. Returns a message for the person, or null when it worked. */
export function tickSelf(p: Project, key: string, note: string): string | null {
  const s = STEPS.find((x) => x.step.key === key)?.step;
  if (!s || s.check.kind !== "self") return "That step is checked on GitHub, not by you.";
  const text = note.trim();
  if (text.length < s.check.min) return `Write a little more: at least ${s.check.min} characters about what actually happened.`;
  if (text.length > 1000) return "Keep it under 1,000 characters.";
  db.insert(buildSteps).values({ projectId: p.id, stepKey: key, how: "self", evidence: text }).onConflictDoUpdate({ target: [buildSteps.projectId, buildSteps.stepKey], set: { evidence: text, how: "self" } }).run();
  return null;
}

export function untickSelf(p: Project, key: string) {
  db.delete(buildSteps).where(and(eq(buildSteps.projectId, p.id), eq(buildSteps.stepKey, key), eq(buildSteps.how, "self"))).run();
}
