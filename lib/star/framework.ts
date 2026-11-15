/**
 * The Civil Service Success Profiles behaviours, and what a STAR story is made of. No database, so the forms in the browser can use it (docs/star/design.md).
 * The descriptions are our own short wording of what each behaviour is about, to help someone find an example; they are not the official text, and the
 * person should always check the job advert for the behaviours and the level it asks for.
 */
export const BEHAVIOURS = [
  { key: "big-picture", title: "Seeing the Big Picture", gist: "Understanding how your work fits the wider aims of your team, department and the public it serves.", prompts: ["A time you linked your work to a wider priority or the people it affects", "A time you spotted a knock-on effect others had missed", "A time you changed what you did because of the bigger aim"] },
  { key: "changing", title: "Changing and Improving", gist: "Suggesting and making better ways of working, and staying open to new ideas.", prompts: ["A time you improved a process, tool or service", "A time you tried something new and it did not go as planned", "A time you brought others along with a change"] },
  { key: "decisions", title: "Making Effective Decisions", gist: "Weighing evidence and risk, and reaching a clear, well-reasoned decision.", prompts: ["A time you decided with incomplete information", "A time you used data or advice to choose between options", "A time you had to explain or defend a decision"] },
  { key: "leadership", title: "Leadership", gist: "Setting direction, being inclusive, and helping others do their best.", prompts: ["A time you led without being the manager", "A time you handled a difficult conversation or change in your team", "A time you made sure everyone could contribute"] },
  { key: "communicating", title: "Communicating and Influencing", gist: "Getting a clear message across and persuading others, in writing and in person.", prompts: ["A time you explained something complex to someone who did not know it", "A time you changed someone's mind", "A time you adjusted how you communicated for your audience"] },
  { key: "together", title: "Working Together", gist: "Building trusted working relationships with colleagues, partners and the public.", prompts: ["A time you worked with another team or organisation to reach a shared goal", "A time you resolved a disagreement", "A time you supported a colleague who was struggling"] },
  { key: "developing", title: "Developing Self and Others", gist: "Learning, using feedback, and helping other people grow.", prompts: ["A time you acted on feedback to improve", "A time you taught or coached someone", "A time you filled a gap in your own knowledge"] },
  { key: "quality", title: "Managing a Quality Service", gist: "Delivering a service that is reliable, accurate and meets people's needs.", prompts: ["A time you fixed a problem in a service people relied on", "A time you balanced quality against time or cost", "A time you used customer feedback or measures to improve what you delivered"] },
  { key: "pace", title: "Delivering at Pace", gist: "Taking responsibility, planning, and getting the right things done on time.", prompts: ["A time you met a tight deadline", "A time you had to reprioritise when things changed", "A time you took ownership of something that was going wrong"] },
] as const;
export type BehaviourKey = (typeof BEHAVIOURS)[number]["key"];
export const BEHAVIOUR_KEYS = BEHAVIOURS.map((b) => b.key) as BehaviourKey[];
export const behaviourTitle = (k: string) => BEHAVIOURS.find((b) => b.key === k)?.title ?? k;
export const isBehaviour = (k: unknown): k is BehaviourKey => typeof k === "string" && (BEHAVIOUR_KEYS as string[]).includes(k);

/** Civil Service grade groups; behaviours are assessed at a level that goes with the grade, so scope grows with it. */
export const GRADES = [
  { key: "aa-ao", label: "AA / AO", scope: "Your own tasks and how they help the team." },
  { key: "eo", label: "EO", scope: "Your own work plus helping a small team or a process." },
  { key: "heo-seo", label: "HEO / SEO", scope: "A team or a piece of delivery, with decisions you owned." },
  { key: "g7-g6", label: "Grade 7 / Grade 6", scope: "A service or programme, and people across teams or organisations." },
  { key: "scs", label: "Senior Civil Service", scope: "A whole organisation or system, with public and ministerial impact." },
  { key: "other", label: "Not sure / other", scope: "" },
] as const;
export type GradeKey = (typeof GRADES)[number]["key"];
export const isGrade = (k: unknown): k is GradeKey => GRADES.some((g) => g.key === k);

/** The four parts of a story, with what to write in each, and what share of the words each should get. */
export const PARTS = [
  { key: "situation", letter: "S", title: "Situation", ask: "Where were you, and what was happening? Just enough for a stranger to follow.", share: "about 15%", example: "In my team of six at the contact centre, calls about the new benefit form had doubled in a fortnight and wait times passed 20 minutes." },
  { key: "task", letter: "T", title: "Task", ask: "What were you responsible for? What did you need to achieve, and by when?", share: "about 10%", example: "I was asked to bring the wait down below 10 minutes before the end of the month without extra staff." },
  { key: "action", letter: "A", title: "Action", ask: "What did you do, step by step, and why? Say I, not we. This is where you score.", share: "about 50–60%", example: "I listed the ten most common queries, wrote a one-page guide with plain answers, trained the team in a 20-minute huddle, and asked the form owners to fix the two unclear questions." },
  { key: "result", letter: "R", title: "Result", ask: "What changed because of you? Give a number, a quote or a decision. What did you learn?", share: "about 15–20%", example: "Wait time fell to 7 minutes within two weeks, repeat calls dropped by a third, and my guide was adopted by the other two sites." },
] as const;
export type PartKey = (typeof PARTS)[number]["key"];

export const STORY_LIMITS = { title: 120, part: 1400, context: 120, behaviours: 4, stories: 80, applications: 40, advert: 300, note: 600, answer: 6000, wordLimit: 1500 } as const;
/** Many applications ask for about this many words per behaviour; the person sets the real limit for each application. */
export const DEFAULT_WORD_LIMIT = 250;
export const STATUSES = [
  { key: "preparing", label: "Preparing" }, { key: "submitted", label: "Submitted" }, { key: "interview", label: "Interview" }, { key: "closed", label: "Closed" },
] as const;
export type AppStatus = (typeof STATUSES)[number]["key"];
export const isStatus = (k: unknown): k is AppStatus => STATUSES.some((s) => s.key === k);

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export type StoryText = { situation: string; task: string; action: string; result: string };

/** The four parts joined into one first-person answer: a starting draft for a written statement, to be edited and tailored, never sent as is. */
export function composeAnswer(s: StoryText): string {
  return [s.situation, s.task, s.action, s.result].map((p) => p.trim()).filter(Boolean).join("\n\n");
}

/** Adverts limit each answer by words (often 250) or by characters with spaces (often 1,250). The person picks which, and the number, for each application. */
export const LIMIT_UNITS = [
  { key: "words", label: "words", min: 50, max: 1500, fallback: 250 },
  { key: "characters", label: "characters (with spaces)", min: 200, max: STORY_LIMITS.answer, fallback: 1250 },
] as const;
export type LimitUnit = (typeof LIMIT_UNITS)[number]["key"];
export const isUnit = (k: unknown): k is LimitUnit => LIMIT_UNITS.some((u) => u.key === k);
export const unitOf = (k: unknown) => LIMIT_UNITS.find((u) => u.key === k) ?? LIMIT_UNITS[0];
/** How big some text is in the advert's unit. A character is one letter, digit, space or line break (an emoji counts once). */
export const sizeOf = (s: string, unit: LimitUnit) => (unit === "characters" ? [...s.replace(/\r\n?/g, "\n")].length : wordCount(s));
export const unitName = (unit: LimitUnit, n: number) => (unit === "characters" ? (n === 1 ? "character" : "characters") : n === 1 ? "word" : "words");
