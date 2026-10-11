/**
 * What each of the 20 levels means, in plain words. These are general guides that apply to every subject:
 * the subject-specific part (topics, study-guide outline) comes from the track's own questions and lesson.
 */
export type LevelInfo = { meaning: string; expect: string };

export const LEVEL_INFO: LevelInfo[] = [
  { meaning: "You are meeting the subject for the first time.", expect: "Plain-language basics: the key terms, what things are for, and the very first steps." },
  { meaning: "You can follow along when someone shows you how.", expect: "Core ideas applied in guided, single-step situations." },
  { meaning: "You are building a working picture of how it fits together.", expect: "How the main parts relate, and the most common patterns you will see." },
  { meaning: "You can do simple tasks on your own.", expect: "Everyday tasks from start to finish, and spotting the obvious mistakes." },
  { meaning: "You are ready for supervised, real work. This level earns the Foundation certificate.", expect: "Reliable fundamentals across the whole subject, with some two-step reasoning." },
  { meaning: "You apply the subject in real work.", expect: "Practical scenarios, choosing between options, and reading real examples." },
  { meaning: "You handle routine tasks independently.", expect: "Multi-step problems, and knowing why one choice is better than another." },
  { meaning: "You cope with variety, not just the routine case.", expect: "Less common situations, trade-offs and troubleshooting." },
  { meaning: "You are quick and accurate.", expect: "Questions that combine several ideas and catch out half-knowledge." },
  { meaning: "A strong, well-rounded user. This level earns the Practitioner certificate.", expect: "Broad coverage plus depth in the common areas, with few easy points." },
  { meaning: "You go beyond the standard way of doing things.", expect: "Edge cases, performance and design choices." },
  { meaning: "You know the corners most people avoid.", expect: "Deep dives into particular areas and the subtle differences between similar things." },
  { meaning: "Other people come to you with their questions.", expect: "Diagnosing unfamiliar problems and judging between competing approaches." },
  { meaning: "You have seen it go wrong in many different ways.", expect: "Failure modes, hidden costs and long-term consequences." },
  { meaning: "You can design with it, not just use it. This level earns the Expert certificate.", expect: "Open-ended scenarios where several answers look right and judgement decides." },
  { meaning: "The top tier of practitioners.", expect: "Rare, difficult questions with little room for guessing." },
  { meaning: "Fluent and inventive.", expect: "Combining ideas in new ways and finding the elegant solution." },
  { meaning: "A reference point others quote.", expect: "The hardest scenarios, including the exceptions to the exceptions." },
  { meaning: "Very little surprises you any more.", expect: "Near-complete command, including the reasons behind the rules and their trade-offs." },
  { meaning: "The summit. This level earns the Titan certificate.", expect: "The toughest exam in the subject. Expect to need more than one attempt." },
];
