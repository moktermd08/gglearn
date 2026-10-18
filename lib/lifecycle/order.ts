/**
 * The order a role's learning journey is taken in. Every track has a rank; a role's journey is its tracks grouped by rank, lowest first.
 * Tracks with the same rank are parallel (take them in any order); a track is locked until every track in the stage before it has been
 * taken to UNLOCK_LEVEL. The rank is an order only: a stage is named after the tracks in it, so the same table serves a developer
 * (foundations, frontend, backend, data, testing, servers, security) and a business analyst (basics, discovery, delivery, leadership).
 *
 * Plain code with no database, so the map and the server apply exactly the same rules.
 */

/** A track must reach this level (the first certificate level) before the next stage opens. */
export const UNLOCK_LEVEL = 5;

const RANKS: [number, string[]][] = [
  [10, ["governance-compliance", "tools-business", "tools-plan-design", "communications-email", "foundations-analytics"]],
  [15, ["git-titan", "foundations-git", "foundations-github", "foundations-html", "html-titan", "foundations-css", "css-titan", "foundations-json", "foundations-oop", "foundations-npm", "foundations-xml", "foundations-restapi", "foundations-linux"]],
  [20, ["sdlc-discovery", "sdlc-requirements", "product-management-core", "brand-positioning-voice", "finance-for-leaders", "people-operations", "service-design-pricing", "payments-billing"]],
  [25, ["guru-brand-identity", "guru-design-tools", "guru-design-system", "lead-generation-titan", "linkedin-titan", "foundations-linkedin", "gglink-seo-content", "gglink-sales-support", "gglink-web-delivery", "guru-graphics-sales", "facebook-marketing-titan", "data-analytics", "delivery-management", "mhossain-content"]],
  [30, ["javascript-titan", "foundations-javascript", "foundations-typescript", "foundations-react", "react-titan", "foundations-vue", "angular-titan", "foundations-angular", "sdlc-frontend", "tech-tailwind", "bootstrap-titan", "foundations-bootstrap", "wordpress-titan", "foundations-wordpress", "tech-drupal", "foundations-jquery"]],
  [40, ["nodejs-titan", "foundations-nodejs", "foundations-expressjs", "python-titan", "foundations-python", "php-titan", "foundations-php", "laravel-titan", "foundations-laravel", "sdlc-backend", "tech-graphql"]],
  [50, ["sdlc-database", "mysql-titan", "foundations-mysql", "foundations-mongodb", "tech-data-stores"]],
  [60, ["sdlc-testing", "tech-testing"]],
  [70, ["servers-infrastructure", "foundations-apache", "foundations-docker", "foundations-aws", "tech-cloud-devops", "sdlc-devops", "tools-build-ship", "sdlc-launch", "lambda-titan", "foundations-lambda", "gglink-hosting-maintenance", "gglink-server-operations"]],
  [80, ["sdlc-security", "security-operations", "risk-resilience-leadership"]],
  [90, ["ai-llm-practice", "llm-fundamentals-titan", "llm-prompting-titan", "llm-aisearch-titan", "llm-local-titan", "chatgpt-titan", "foundations-chatgpt", "foundations-openai", "openai-titan", "claude-chatgpt-everyday-titan", "api-claude-titan", "api-copilot-titan", "api-gemini-titan", "api-openai-platform-titan", "rag-pipelines-titan", "rag-llamaindex-titan", "vec-databases-titan", "agent-automation-titan", "agent-claudecode-titan", "agent-cursor-titan", "agent-design-titan", "agent-langchain-titan", "agent-mcp-titan", "eval-llm-titan", "eval-safety-titan", "ml-sklearn-titan", "ml-pytorch-titan", "ml-tensorflow-titan", "ml-huggingface-titan", "ml-sklearn-titan", "tune-finetuning-titan", "image-diffusion-titan", "image-midjourney-titan"]],
  [100, ["sdlc-architecture", "tech-strategy-roadmap"]],
  [110, ["engineering-leadership", "executive-communication"]],
];
const RANK = new Map<string, number>(RANKS.flatMap(([n, slugs]) => slugs.map((s) => [s, n] as [string, number])));
/** A track the table does not know sits in the middle, so it never blocks the basics or waits behind leadership. */
export const rankOf = (slug: string, technical = false) => {
  const r = RANK.get(slug) ?? 50;
  // for an engineer, product and business tracks come after the core build skills, not before the first line of code
  return technical && (r === 20 || r === 25) ? r + 35 : r;
};

export type Stage = { n: number; rank: number; tracks: string[] };

/** The journey for a set of tracks: stages in order, numbered from 1. */
export function stagesOf(tracks: readonly string[], technical = false, core: ReadonlySet<string> = new Set()): Stage[] {
  const byRank = new Map<number, string[]>();
  for (const t of new Set(tracks)) {
    let r = rankOf(t, technical);
    // for a business role, its own craft (what sets the role apart) comes before the general business tracks
    if (!technical && core.has(t) && (r === 20 || r === 25)) r = 17;
    byRank.set(r, [...(byRank.get(r) ?? []), t]);
  }
  return [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([rank, ts], i) => ({ n: i + 1, rank, tracks: ts.sort() }));
}

/** What a person has done: levels passed per track slug (placement counts, so someone can test out of a stage). */
export type Passed = Record<string, number>;
/** How many levels a track can actually be taken to (tracks with fewer questions never block). */
export type Reach = Record<string, number>;

export type StageState = { stage: Stage; state: "done" | "current" | "locked"; /** tracks in the previous stage still to pass */ waitingOn: string[] };

/**
 * Each stage is done, current (every earlier stage is done) or locked, and a locked stage names what it is waiting on.
 * `inJourney` limits it to tracks the person can take at all; a track with no reachable level cannot hold anyone up.
 */
export function journeyState(stages: Stage[], passed: Passed, reach: Reach, inJourney: (slug: string) => boolean = () => true, cap: Reach = {}): StageState[] {
  // the level that counts as passing: the unlock level, or less when the ladder asks for less, or the most the track can reach
  const need = (slug: string) => Math.min(UNLOCK_LEVEL, cap[slug] ?? UNLOCK_LEVEL, reach[slug] ?? 0);
  const done = (st: Stage) => st.tracks.filter(inJourney).every((t) => need(t) === 0 || (passed[t] ?? 0) >= need(t));
  const out: StageState[] = [];
  let open = true; // every stage so far is done
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i], d = done(st);
    out.push({ stage: st, state: d ? "done" : open ? "current" : "locked", waitingOn: open ? [] : earlierUndone(stages.slice(0, i), passed, need, inJourney) });
    if (!d) open = false;
  }
  return out;
}

/** The tracks still to pass in the earliest stage that is not done: what a locked stage is waiting on. */
function earlierUndone(before: Stage[], passed: Passed, need: (s: string) => number, inJourney: (s: string) => boolean): string[] {
  for (const st of before) {
    const todo = st.tracks.filter((t) => inJourney(t) && need(t) > 0 && (passed[t] ?? 0) < need(t));
    if (todo.length) return todo;
  }
  return [];
}
