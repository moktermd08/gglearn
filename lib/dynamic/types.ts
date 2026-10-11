import type { Rng } from "./rng";

/** How a test run independently re-derives the stated answer by really executing something. Never used at runtime. */
export type Verify =
  | { lang: "js" | "py" | "php" | "sh"; src: string; expect: string } // stdout lines joined with "\n"
  | { lang: "sql"; src: string; expect: string } // sqlite3 -list output (rows joined with "\n", columns with "|")
  | { lang: "check"; ok: () => boolean } // a custom independent check
  | { lang: "ts"; programs: { src: string; ok: boolean }[] } // each program must compile (ok) or fail (!ok) under `strict`
  | { lang: "tskeys"; src: string; type: string; expect: string[] } // sorted property names of `type`
  | { lang: "tstype"; src: string; name: string; expect: string }; // checker's text for variable `name`

/** What a family produces: the right answer and plausible wrong ones. The engine shuffles and keys them. */
export type Draft = {
  prompt: string; // must contain the part that varies, because (track, level, prompt) is unique in the database
  code?: string;
  correct: string;
  wrong: string[]; // at least 3 distinct, none equal to `correct`
  topic: string;
  hint?: string;
  verify?: Verify;
};

export type Family = {
  id: string;
  tags: string[]; // subjects this family can serve, see tags.ts
  levels: [number, number]; // inclusive range of the 20 levels
  make(r: Rng, level: number): Draft;
};

export type Generated = {
  family: string;
  prompt: string;
  code: string | null;
  options: { key: string; text: string }[];
  answer: string;
  topic: string;
  hint: string | null;
};
