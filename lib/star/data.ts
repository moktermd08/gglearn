import { and, desc, eq, inArray } from "drizzle-orm";
import { db, starApplications, starPicks, starStories } from "@/lib/db";
import { parseJson } from "@/lib/cv/text";
import { BEHAVIOURS, BEHAVIOUR_KEYS, GRADES, behaviourTitle, composeAnswer, isBehaviour, wordCount, type BehaviourKey } from "@/lib/star/framework";
import { reviewStory, type Review } from "@/lib/star/coach";

/** Everything here takes the owner's id and only ever reads that person's rows: a story or application of someone else is simply not found. */
export type Story = Omit<typeof starStories.$inferSelect, "behaviours"> & { behaviours: BehaviourKey[] };
const parse = (r: typeof starStories.$inferSelect): Story => ({ ...r, behaviours: parseJson<unknown[]>(r.behaviours, []).filter(isBehaviour) });

export const storiesOf = (userId: number): Story[] => db.select().from(starStories).where(eq(starStories.userId, userId)).orderBy(desc(starStories.updatedAt), desc(starStories.id)).all().map(parse);
export const storyOf = (userId: number, id: number): Story | null => { const r = db.select().from(starStories).where(and(eq(starStories.userId, userId), eq(starStories.id, id))).get(); return r ? parse(r) : null; };
export const applicationsOf = (userId: number) => db.select().from(starApplications).where(eq(starApplications.userId, userId)).orderBy(desc(starApplications.updatedAt), desc(starApplications.id)).all();
export const applicationOf = (userId: number, id: number) => db.select().from(starApplications).where(and(eq(starApplications.userId, userId), eq(starApplications.id, id))).get() ?? null;
export const picksOf = (applicationId: number) => db.select().from(starPicks).where(eq(starPicks.applicationId, applicationId)).all();

/** For each behaviour: how many stories could evidence it, and how many of those the person calls ready. */
export function coverage(stories: Story[]) {
  return BEHAVIOURS.map((b) => {
    const mine = stories.filter((s) => s.behaviours.includes(b.key));
    return { key: b.key, title: b.title, total: mine.length, ready: mine.filter((s) => s.ready).length };
  });
}

export type PackEntry = {
  behaviour: BehaviourKey; title: string; storyTitle: string; context: string;
  parts: { situation: string; task: string; action: string; result: string } | null;
  answer: string; words: number; over: number; tailored: boolean; review: Review | null;
};
export type Pack = {
  job: string; department: string; grade: string; closesOn: string; advertUrl: string; wordLimit: number; note: string;
  entries: PackEntry[]; missing: string[]; // behaviours the advert asks for that have no story yet
};

/** One application as a document: for each behaviour it asks for, the story chosen and the wording to send (the tailored text, or the story as written). */
export function buildPack(userId: number, applicationId: number): Pack | null {
  const app = applicationOf(userId, applicationId);
  if (!app) return null;
  const picks = picksOf(app.id);
  const ids = picks.map((p) => p.storyId).filter((x): x is number => x != null);
  const mine = new Map((ids.length ? db.select().from(starStories).where(and(eq(starStories.userId, userId), inArray(starStories.id, ids))).all() : []).map((r) => [r.id, parse(r)]));
  const entries: PackEntry[] = [], missing: string[] = [];
  const order = new Map(BEHAVIOUR_KEYS.map((k, i) => [k, i]));
  for (const p of [...picks].sort((a, b) => (order.get(a.behaviour as BehaviourKey) ?? 99) - (order.get(b.behaviour as BehaviourKey) ?? 99))) {
    if (!isBehaviour(p.behaviour)) continue;
    const s = p.storyId != null ? mine.get(p.storyId) ?? null : null; // a story that was deleted, or is not theirs, is not used
    const answer = (p.answer.trim() || (s ? composeAnswer(s) : "")).trim();
    if (!s && !answer) { missing.push(behaviourTitle(p.behaviour)); continue; }
    const words = wordCount(answer);
    entries.push({ behaviour: p.behaviour, title: behaviourTitle(p.behaviour), storyTitle: s?.title ?? "", context: s?.context ?? "", parts: s ? { situation: s.situation, task: s.task, action: s.action, result: s.result } : null, answer, words, over: Math.max(0, words - app.wordLimit), tailored: p.answer.trim() !== "", review: s ? reviewStory(s) : null });
  }
  return { job: app.title, department: app.department, grade: GRADES.find((g) => g.key === app.grade)?.label ?? "", closesOn: app.closesOn, advertUrl: app.advertUrl, wordLimit: app.wordLimit, note: app.note, entries, missing };
}

/** The pack as plain text, ready to paste into an application form or keep as a note. `statements` is the written answer; `cue` is the short STAR prompts for an interview. */
export function packText(pack: Pack, mode: "statements" | "cue"): string {
  const head = [`${pack.job}${pack.department ? `, ${pack.department}` : ""}`, mode === "statements" ? "Behaviour statements" : "Interview cue sheet", pack.closesOn ? `Closes ${pack.closesOn}` : ""].filter(Boolean).join("\n");
  const body = pack.entries.map((e) => {
    if (mode === "statements") return `${e.title.toUpperCase()}  (${e.words} words${e.over ? `, ${e.over} over the ${pack.wordLimit} limit` : ""})\n\n${e.answer}`;
    const p = e.parts;
    const bullet = (label: string, t: string) => (t.trim() ? `${label}: ${t.trim().replace(/\s+/g, " ")}` : `${label}: (add)`);
    return `${e.title.toUpperCase()}${e.storyTitle ? `: ${e.storyTitle}` : ""}${e.context ? ` (${e.context})` : ""}\n${p ? [bullet("S", p.situation), bullet("T", p.task), bullet("A", p.action), bullet("R", p.result)].join("\n") : e.answer}`;
  });
  return `${head}\n\n${body.join("\n\n---\n\n")}\n${pack.missing.length ? `\nStill to cover: ${pack.missing.join(", ")}\n` : ""}`;
}

const iso = (sec: number | null) => (sec ? new Date(sec * 1000).toISOString() : null);

/** Everything a person has written here, as plain data they can keep: their stories, their applications, and the wording for each behaviour. */
export function exportStories(userId: number) {
  const stories = storiesOf(userId);
  const title = new Map(stories.map((s) => [s.id, s.title]));
  return {
    format: "gglearn-behaviour-stories", version: 1, exportedAt: new Date().toISOString(),
    stories: stories.map((s) => ({ id: s.id, title: s.title, context: s.context, situation: s.situation, task: s.task, action: s.action, result: s.result, behaviours: s.behaviours, ready: s.ready, createdAt: iso(s.createdAt), updatedAt: iso(s.updatedAt) })),
    applications: applicationsOf(userId).map((a) => ({
      id: a.id, title: a.title, department: a.department, grade: a.grade, closesOn: a.closesOn, advertUrl: a.advertUrl, wordLimit: a.wordLimit, status: a.status, note: a.note, createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt),
      answers: picksOf(a.id).map((p) => ({ behaviour: p.behaviour, storyId: p.storyId, storyTitle: p.storyId ? title.get(p.storyId) ?? null : null, tailoredAnswer: p.answer, updatedAt: iso(p.updatedAt) })),
    })),
  };
}

/** Removes every story, application and answer this person has, and nothing of anyone else's. Returns how many of each. */
export function eraseStories(userId: number) {
  return db.transaction((tx) => {
    const apps = tx.select({ id: starApplications.id }).from(starApplications).where(eq(starApplications.userId, userId)).all().map((a) => a.id);
    if (apps.length) tx.delete(starPicks).where(inArray(starPicks.applicationId, apps)).run();
    tx.delete(starApplications).where(eq(starApplications.userId, userId)).run();
    const stories = tx.delete(starStories).where(eq(starStories.userId, userId)).returning({ id: starStories.id }).all().length;
    return { stories, applications: apps.length };
  });
}
