import { and, desc, eq, inArray } from "drizzle-orm";
import { db, starApplications, starPicks, starStories } from "@/lib/db";
import { parseJson } from "@/lib/cv/text";
import { BEHAVIOURS, BEHAVIOUR_KEYS, GRADES, behaviourTitle, composeAnswer, isBehaviour, sizeOf, unitName, wordCount, type BehaviourKey, type LimitUnit } from "@/lib/star/framework";
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
  answer: string; words: number; size: number; over: number; tailored: boolean; review: Review | null;
};
export type Pack = {
  job: string; department: string; grade: string; closesOn: string; advertUrl: string; wordLimit: number; limitUnit: LimitUnit; note: string;
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
    const words = wordCount(answer), size = sizeOf(answer, app.limitUnit);
    entries.push({ behaviour: p.behaviour, title: behaviourTitle(p.behaviour), storyTitle: s?.title ?? "", context: s?.context ?? "", parts: s ? { situation: s.situation, task: s.task, action: s.action, result: s.result } : null, answer, words, size, over: Math.max(0, size - app.wordLimit), tailored: p.answer.trim() !== "", review: s ? reviewStory(s) : null });
  }
  return { job: app.title, department: app.department, grade: GRADES.find((g) => g.key === app.grade)?.label ?? "", closesOn: app.closesOn, advertUrl: app.advertUrl, wordLimit: app.wordLimit, limitUnit: app.limitUnit, note: app.note, entries, missing };
}

/** The pack as plain text, ready to paste into an application form or keep as a note. `statements` is the written answer; `cue` is the short STAR prompts for an interview. */
export function packText(pack: Pack, mode: "statements" | "cue"): string {
  const head = [`${pack.job}${pack.department ? `, ${pack.department}` : ""}`, mode === "statements" ? "Behaviour statements" : "Interview cue sheet", pack.closesOn ? `Closes ${pack.closesOn}` : ""].filter(Boolean).join("\n");
  const body = pack.entries.map((e) => {
    if (mode === "statements") return `${e.title.toUpperCase()}  (${e.size} ${unitName(pack.limitUnit, e.size)}${e.over ? `, ${e.over} over the ${pack.wordLimit} limit` : ""})\n\n${e.answer}`;
    const p = e.parts;
    const bullet = (label: string, t: string) => (t.trim() ? `${label}: ${t.trim().replace(/\s+/g, " ")}` : `${label}: (add)`);
    return `${e.title.toUpperCase()}${e.storyTitle ? `: ${e.storyTitle}` : ""}${e.context ? ` (${e.context})` : ""}\n${p ? [bullet("S", p.situation), bullet("T", p.task), bullet("A", p.action), bullet("R", p.result)].join("\n") : e.answer}`;
  });
  return `${head}\n\n${body.join("\n\n---\n\n")}\n${pack.missing.length ? `\nStill to cover: ${pack.missing.join(", ")}\n` : ""}`;
}

/** The one thing to do next, in plain words: finish the application that closes soonest, else cover a behaviour with no ready story, else nothing. */
export function nextStep(userId: number): { text: string; href: string; label: string } | null {
  const stories = storiesOf(userId);
  if (stories.length === 0) return { text: "Start with the work you are proudest of in the last two years.", href: "/profile/behaviours/story/new", label: "Write your first story" };
  const open = applicationsOf(userId).filter((a) => a.status === "preparing").map((a) => ({ a, pack: buildPack(userId, a.id)! }))
    .map(({ a, pack }) => ({ a, missing: pack.missing.length, over: pack.entries.filter((e) => e.over > 0).length, empty: pack.entries.length + pack.missing.length === 0 }))
    .filter((x) => x.missing + x.over > 0 || x.empty).sort((x, y) => (x.a.closesOn || "9999").localeCompare(y.a.closesOn || "9999"));
  const first = open[0];
  if (first) {
    const bits = first.empty ? ["no behaviours chosen yet"] : [first.missing ? `${first.missing} still to cover` : "", first.over ? `${first.over} over the limit` : ""].filter(Boolean);
    return { text: `${first.a.title}${first.a.closesOn ? ` closes ${first.a.closesOn}` : ""}: ${bits.join(", ")}.`, href: `/profile/behaviours/applications/${first.a.id}`, label: "Finish this application" };
  }
  const gap = coverage(stories).find((c) => c.ready === 0);
  if (gap) return { text: `You have no ready story for ${gap.title}.`, href: `/profile/behaviours/story/new?b=${gap.key}`, label: `Write one for ${gap.title}` };
  return null;
}
