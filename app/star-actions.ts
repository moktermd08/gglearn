"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { actingUser, logViewAsUse } from "@/lib/auth";
import { db, starApplications, starPicks, starStories } from "@/lib/db";
import { cleanBlock, cleanLine, safeUrl } from "@/lib/cv/text";
import { reviewStory } from "@/lib/star/coach";
import { DEFAULT_WORD_LIMIT, STORY_LIMITS, composeAnswer, isBehaviour, isGrade, isStatus, type BehaviourKey } from "@/lib/star/framework";
import { allowed, hit } from "@/lib/rate-limit";
import { eraseStories } from "@/lib/star/data";

/**
 * Everything a person does to their own behaviour stories and applications. Each action works as the person (or a super admin viewing as them, logged
 * under the super admin), checks that what it touches is theirs, and cleans what it saves. Nothing here is ever shown to anyone else.
 */
type Res = { error?: string; done?: string } | null;
const BLOCKED: Res = { error: "You cannot do that right now. Sign in again and try once more." };
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const now = () => Math.floor(Date.now() / 1000);

async function owner(what: string) {
  const a = await actingUser();
  if (!a) return null;
  const key = `star-write:${a.me.id}`;
  if (!allowed(key, 400)) return null;
  hit(key, 60 * 60 * 1000);
  await logViewAsUse(a.viewedBy, a.me, what);
  return a.me;
}
const id = (v: FormDataEntryValue | null) => { const n = Number(text(v)); return Number.isInteger(n) && n > 0 ? n : null; };
const refresh = () => revalidatePath("/profile/behaviours", "layout");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export async function saveStoryAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner("saveStoryAction");
  if (!me) return BLOCKED;
  const sid = id(fd.get("id"));
  const title = cleanLine(fd.get("title"), STORY_LIMITS.title);
  if (!title) return { error: "Give the story a short title you will recognise." };
  const parts = { situation: cleanBlock(fd.get("situation"), STORY_LIMITS.part), task: cleanBlock(fd.get("task"), STORY_LIMITS.part), action: cleanBlock(fd.get("action"), STORY_LIMITS.part), result: cleanBlock(fd.get("result"), STORY_LIMITS.part) };
  const picked = [...new Set(fd.getAll("behaviours").map(text).filter(isBehaviour))] as BehaviourKey[];
  if (picked.length > STORY_LIMITS.behaviours) return { error: `Choose up to ${STORY_LIMITS.behaviours} behaviours. A story that tries to prove everything proves little.` };
  const ready = fd.get("ready") === "on";
  if (ready) {
    const fixes = reviewStory(parts).tips.filter((t) => t.level === "fix");
    if (fixes.length) return { error: `Not ready yet: ${fixes[0].text}` };
    if (picked.length === 0) return { error: "Choose at least one behaviour this story shows before you mark it ready." };
  }
  const row = { title, context: cleanLine(fd.get("context"), STORY_LIMITS.context), ...parts, behaviours: JSON.stringify(picked), ready, updatedAt: now() };
  if (sid) {
    const r = db.update(starStories).set(row).where(and(eq(starStories.id, sid), eq(starStories.userId, me.id))).run();
    if (!r.changes) return { error: "That story was not found." };
    refresh();
    return { done: "Saved." };
  }
  const count = db.select({ n: sql<number>`count(*)` }).from(starStories).where(eq(starStories.userId, me.id)).get()?.n ?? 0;
  if (count >= STORY_LIMITS.stories) return { error: `You have ${STORY_LIMITS.stories} stories already. Remove one you no longer need.` };
  const made = db.insert(starStories).values({ userId: me.id, ...row }).returning({ id: starStories.id }).get();
  refresh();
  redirect(`/profile/behaviours/story/${made.id}`);
}

export async function deleteStoryAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner("deleteStoryAction");
  if (!me) return BLOCKED;
  const sid = id(fd.get("id"));
  if (!sid) return { error: "That story was not found." };
  const mine = db.select({ id: starStories.id }).from(starStories).where(and(eq(starStories.id, sid), eq(starStories.userId, me.id))).get();
  if (!mine) return { error: "That story was not found." };
  db.update(starPicks).set({ storyId: null }).where(eq(starPicks.storyId, sid)).run(); // an application keeps its tailored wording; it just loses the link
  db.delete(starStories).where(eq(starStories.id, sid)).run();
  refresh();
  redirect("/profile/behaviours");
}

export async function saveApplicationAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner("saveApplicationAction");
  if (!me) return BLOCKED;
  const aid = id(fd.get("id"));
  const title = cleanLine(fd.get("title"), STORY_LIMITS.title);
  if (!title) return { error: "Name the job you are applying for." };
  const closes = text(fd.get("closesOn")).trim();
  if (closes && !isDate(closes)) return { error: "Write the closing date as 2026-12-31." };
  const advertRaw = cleanLine(fd.get("advertUrl"), STORY_LIMITS.advert);
  const advertUrl = advertRaw ? safeUrl(advertRaw) : "";
  if (advertRaw && !advertUrl) return { error: "That advert address does not look right. Use https://…" };
  const limit = Math.round(Number(text(fd.get("wordLimit"))) || DEFAULT_WORD_LIMIT);
  if (limit < 50 || limit > STORY_LIMITS.wordLimit) return { error: `Word limit should be between 50 and ${STORY_LIMITS.wordLimit}.` };
  const asked = [...new Set(fd.getAll("behaviours").map(text).filter(isBehaviour))] as BehaviourKey[];
  const grade = isGrade(text(fd.get("grade"))) ? text(fd.get("grade")) : "other";
  const statusIn = text(fd.get("status"));
  const row = { title, department: cleanLine(fd.get("department"), STORY_LIMITS.title), grade, closesOn: closes, advertUrl: advertUrl ?? "", wordLimit: limit, status: isStatus(statusIn) ? statusIn : "preparing", note: cleanBlock(fd.get("note"), STORY_LIMITS.note), updatedAt: now() };
  let appId = aid;
  if (aid) {
    const r = db.update(starApplications).set(row).where(and(eq(starApplications.id, aid), eq(starApplications.userId, me.id))).run();
    if (!r.changes) return { error: "That application was not found." };
  } else {
    const count = db.select({ n: sql<number>`count(*)` }).from(starApplications).where(eq(starApplications.userId, me.id)).get()?.n ?? 0;
    if (count >= STORY_LIMITS.applications) return { error: `You have ${STORY_LIMITS.applications} applications already. Remove old ones first.` };
    appId = db.insert(starApplications).values({ userId: me.id, ...row }).returning({ id: starApplications.id }).get().id;
  }
  // the behaviours the advert asks for: keep the ones still ticked (with their story and wording), add new ones, drop the rest
  const have = db.select().from(starPicks).where(eq(starPicks.applicationId, appId!)).all();
  const drop = have.filter((p) => !asked.includes(p.behaviour as BehaviourKey)).map((p) => p.id);
  if (drop.length) db.delete(starPicks).where(inArray(starPicks.id, drop)).run();
  const kept = new Set(have.map((p) => p.behaviour));
  for (const b of asked) if (!kept.has(b)) db.insert(starPicks).values({ applicationId: appId!, behaviour: b }).run();
  refresh();
  if (!aid) redirect(`/profile/behaviours/applications/${appId}`);
  return { done: "Saved." };
}

export async function deleteApplicationAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner("deleteApplicationAction");
  if (!me) return BLOCKED;
  const aid = id(fd.get("id"));
  if (!aid || !db.select({ id: starApplications.id }).from(starApplications).where(and(eq(starApplications.id, aid), eq(starApplications.userId, me.id))).get()) return { error: "That application was not found." };
  db.delete(starPicks).where(eq(starPicks.applicationId, aid)).run();
  db.delete(starApplications).where(eq(starApplications.id, aid)).run();
  refresh();
  redirect("/profile/behaviours");
}

/** Chooses the story for one behaviour of an application and saves the wording tailored to that job. An empty wording means "use the story as written". */
export async function savePickAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner("savePickAction");
  if (!me) return BLOCKED;
  const aid = id(fd.get("applicationId")), behaviour = text(fd.get("behaviour"));
  if (!aid || !isBehaviour(behaviour)) return { error: "That was not found." };
  const app = db.select().from(starApplications).where(and(eq(starApplications.id, aid), eq(starApplications.userId, me.id))).get();
  const pick = app && db.select().from(starPicks).where(and(eq(starPicks.applicationId, aid), eq(starPicks.behaviour, behaviour))).get();
  if (!app || !pick) return { error: "That was not found." };
  const sid = id(fd.get("storyId"));
  if (sid && !db.select({ id: starStories.id }).from(starStories).where(and(eq(starStories.id, sid), eq(starStories.userId, me.id))).get()) return { error: "Choose one of your own stories." };
  let answer = fd.get("reset") ? "" : cleanBlock(fd.get("answer"), STORY_LIMITS.answer);
  const story = sid ? db.select().from(starStories).where(eq(starStories.id, sid)).get() : null;
  if (story && answer === cleanBlock(composeAnswer(story), STORY_LIMITS.answer)) answer = ""; // unchanged from the story: keep following the story, not a frozen copy
  db.update(starPicks).set({ storyId: sid, answer, updatedAt: now() }).where(eq(starPicks.id, pick.id)).run();
  db.update(starApplications).set({ updatedAt: now() }).where(eq(starApplications.id, aid)).run();
  refresh();
  return { done: "Saved." };
}

/** Removes every story, application and answer the person has. Asks for the word "erase" so a stray call cannot do it. */
export async function eraseStoriesAction(_: Res, fd: FormData): Promise<Res> {
  const me = await owner("eraseStoriesAction");
  if (!me) return BLOCKED;
  if (text(fd.get("confirm")) !== "erase") return { error: "Nothing was erased." };
  eraseStories(me.id);
  refresh();
  redirect("/profile/behaviours");
}
