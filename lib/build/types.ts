/** What a step looks for in the person's GitHub repository. Everything but "self" is read from GitHub itself, so ticking a step means the work exists. */
export type Check =
  /** the repository exists and is public */
  | { kind: "repo" }
  /** at least `min` files match `glob` (each at least `minBytes` big, so an empty stub does not count). `**` crosses folders, `*` does not, `{a,b}` is either */
  | { kind: "files"; glob: string; min?: number; minBytes?: number }
  /** no file matches `glob` (example files ending .example, .sample or .template are ignored): for things that must not be committed */
  | { kind: "absent"; glob: string }
  /** at least `n` commits on the default branch */
  | { kind: "commits"; n: number }
  /** at least `n` pull requests merged */
  | { kind: "prs"; n: number }
  /** at least `n` issues (pull requests are not counted) */
  | { kind: "issues"; n: number }
  /** the latest GitHub Actions run on the default branch that finished passed */
  | { kind: "ci" }
  /** at least `n` published releases */
  | { kind: "releases"; n: number }
  /** the live address answers with a page */
  | { kind: "site" }
  /** the repository has a description, a website address and at least `topics` topics */
  | { kind: "discoverable"; topics: number }
  /** the repository has a licence GitHub recognises */
  | { kind: "license" }
  /** not on GitHub (a conversation, a first customer): the person writes what happened, at least `min` characters */
  | { kind: "self"; min: number };

export type Step = {
  key: string;
  title: string;
  /** why this step is in the programme, one sentence */
  why: string;
  /** what to do, in order */
  doIt: string[];
  /** a prompt to paste into an AI coding tool or chat assistant. {name}, {pitch}, {customer}, {mvp}, {stack}, {agent} and {launch} are filled in, here and in the steps */
  prompt?: string;
  /** a track on this site that teaches the idea behind the step */
  learn?: string;
  check: Check;
};

export type Stage = { key: string; title: string; blurb: string; steps: Step[] };
export type Rank = { key: string; title: string; goal: string; stages: Stage[] };

export type Template = {
  slug: string;
  title: string;
  pitch: string;
  customer: string;
  /** what the first version must do, and nothing more */
  mvp: string[];
  /** a sensible way to build it; the person may choose another */
  stack: string;
  /** the AI feature or agent this project gets in the Builder rank */
  agent: string;
  /** where it goes live */
  launch: string;
};
