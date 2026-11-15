import { wordCount, type StoryText } from "@/lib/star/framework";

/**
 * Tells someone, in plain words, what would make a STAR story stronger. No database and no AI: simple checks that are the same every time, so the
 * advice can be explained. It never blocks saving; it only says what it sees. Used live in the editor and again when a story is marked ready.
 */
export type Tip = { level: "fix" | "improve"; part: "situation" | "task" | "action" | "result" | "whole"; text: string };
export type Review = { words: number; parts: Record<keyof StoryText, number>; tips: Tip[]; ready: boolean; score: number };

const MIN = { situation: 12, task: 8, action: 40, result: 12 } as const;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const VAGUE = /\b(various|several things|a lot of|stuff|things|helped out|got involved|assisted with|was involved in|part of)\b/gi;

export function reviewStory(s: StoryText): Review {
  const parts = { situation: wordCount(s.situation), task: wordCount(s.task), action: wordCount(s.action), result: wordCount(s.result) };
  const words = parts.situation + parts.task + parts.action + parts.result;
  const tips: Tip[] = [];
  const say = (level: Tip["level"], part: Tip["part"], text: string) => tips.push({ level, part, text });

  for (const k of ["situation", "task", "action", "result"] as const) {
    if (parts[k] === 0) say("fix", k, `Add the ${k}.`);
    else if (parts[k] < MIN[k]) say("fix", k, `The ${k} is very short (${parts[k]} words). Add a little more detail.`);
  }
  if (parts.action >= MIN.action || parts.action > 0) {
    const i = count(s.action, /\b(i|i'm|i've|i'd|i'll|my|me)\b/gi), we = count(s.action, /\b(we|we're|we've|we'd|our|us|the team)\b/gi);
    if (we > i) say("fix", "action", "You say “we” more than “I”. Assessors score what you did. Say what you did yourself, and name your part in what the team did.");
    else if (i === 0 && parts.action >= MIN.action) say("fix", "action", "Write the action in the first person (“I did…”) so it is clear what was you.");
    const vague = count(s.action, VAGUE);
    if (vague >= 2) say("improve", "action", "Some wording is vague (for example “various”, “things”, “involved in”). Say exactly what you did.");
    if (words >= 80 && parts.action / words < 0.4) say("improve", "action", "The action is the part assessors score, but it is less than half of the story. Shorten the setting and say more about what you did and why.");
  }
  if (parts.result > 0 && !/\d|£|%|\b(doubled|halved|tripled|all|every|none|first|zero)\b/i.test(s.result)) say("improve", "result", "Add a measurable result if you can: a number, a percentage, a time saved, a decision made, or what someone said.");
  if (parts.result > 0 && !/\b(learn|learnt|learned|next time|would|now|since|going forward|realised|realized)\b/i.test(s.result + " " + s.action)) say("improve", "result", "Say what you learned or what you do differently now. It shows you reflect.");
  if (words >= 80 && (parts.situation + parts.task) / words > 0.4) say("improve", "situation", "The setting takes up a lot of the story. Keep only what a stranger needs to follow it.");
  if (words > 450) say("improve", "whole", `This is ${words} words. Written statements often have a limit of about 250 to 500 words per behaviour, so a shorter version will be easier to use.`);
  if (/\b(always|never|everyone|nobody)\b/i.test(s.result)) say("improve", "result", "Words like “always” or “everyone” sound unproven. Use a real figure or a named example.");

  const fixes = tips.filter((t) => t.level === "fix").length, improves = tips.length - fixes;
  const score = Math.max(0, Math.min(100, 100 - fixes * 22 - improves * 8));
  return { words, parts, tips, ready: fixes === 0 && words > 0, score };
}
