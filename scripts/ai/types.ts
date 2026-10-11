/** Authoring format for an AI-technology track. The engine (engine.ts) expands these into 2,000+ leveled MCQs. */

/**
 * One concept/tool/feature, described by true predicates. Predicates are verb-first, third person singular, so they
 * read after the subject ("Temperature" + "scales the logits to control how random sampling is") and after
 * "Which <group label> ...?" ("Which sampling parameter scales the logits ...?").
 */
export type Card = {
  /** key into TrackSpec.groups */
  group: string;
  /** the name as it should appear in a question: "Temperature", "LoRA", "the system prompt" */
  subject: string;
  /** 1 = first steps, 2 = core, 3 = working practitioner, 4 = advanced, 5 = expert/internals */
  tier: 1 | 2 | 3 | 4 | 5;
  /** 2-4 TRUE, self-contained, mutually distinct predicates about this subject (no trailing period) */
  says: string[];
  /** a situation that this subject (and ideally only this one in its group) solves: "want repeatable, near-deterministic output". Reads after "when you ..." */
  use?: string;
  /** 0-2 plausible-but-FALSE predicates (real misconceptions) about this subject; the best distractors */
  not?: string[];
  /** subjects in the same group that are easily confused with this one or overlap with it; never used as distractors for each other */
  like?: string[];
};

/** A fully hand-written multiple-choice question for things the card model cannot express (code, outputs, workflows). */
export type QA = {
  q: string;
  right: string;
  wrong: [string, string, string];
  tier: 1 | 2 | 3 | 4 | 5;
  code?: string;
  topic?: string;
  /** one sentence explaining why `right` is right; shown after a wrong answer */
  why?: string;
};

export type TrackSpec = {
  /** url slug, always "<something>-titan" like the other Titan Academy tracks */
  slug: string;
  name: string;
  description: string;
  /** comma separated job roles it is recommended for: developer, designer, manager, sales */
  roles: string;
  /** group key -> singular noun phrase used inside questions: { sampler: "sampling parameter" } */
  groups: Record<string, string>;
  cards: Card[];
  qa?: QA[];
  /** ids of parametric generators from calc.ts that fit this subject (unlimited fresh numbers each) */
  calc?: string[];
  /** Company/role tracks only (content/cards): what the track is. Defaults to "technology". */
  kind?: "subject" | "product" | "service" | "tool" | "technology" | "process";
  /** brand slug the track hangs off when it has to be created. Defaults to "titan-academy". An existing track keeps its own brand and metadata. */
  brand?: string;
  audience?: "staff" | "customer" | "both";
  tier?: "mandatory" | "role" | "growth";
  /** who the knowledge applies to when the track is created. Card tracks default to "company" (shared by every brand). */
  scope?: "company" | "brand" | "project";
  /** the thinnest level must reach this many questions. Card tracks default to 50 (1000 in all), Titan tracks to 100. */
  minPerLevel?: number;
};

/** Engine output. */
export type GenQ = {
  prompt: string;
  code?: string;
  options: string[];
  correct: number;
  topic: string;
  hint?: string;
  form: string;
  /** relative difficulty used to spread questions over the 20 levels */
  score: number;
  timeSec: number;
  /** study-guide bullet: the card this question came from */
  subject?: string;
  /** subject + predicate index: two questions about the same fact are kept on different levels */
  fact?: string;
  blurb?: string;
  /** keep option order as authored (True/False, Both/Neither) */
  fixedOrder?: boolean;
};
