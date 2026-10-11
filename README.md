# gglearn — Training Academy

A training academy for our brands. Learners pick a track (subject, product, service, tool, technology or process),
set a goal, and climb 20 levels from **Novice to Titan**. Built from the TrialTest / SkillsTest exam platforms,
rebuilt as a learning product with onboarding, offboarding and a question bank that improves from real results.

## Run it

```bash
npm install
cp .env.example .env.local        # set SESSION_SECRET (openssl rand -hex 32); ANTHROPIC_API_KEY optional
npm run db:push                   # create tables in data/gglearn.db
npm run seed                      # admin user (password printed once), sample brand, TrialTest import
npm run dev
```

## Race to Titan (gamified layer)
- **Rival per subject**: `lib/rivals.ts` gives every track a stable named rival who earns XP every day (deterministic, so no jobs needed). Rival level = XP / 150. Your level = levels passed. The head-to-head is drawn on the track page and dashboard.
- **Visuals**: `components/` holds SVG avatars that evolve through 5 ranks (Initiate, Adept, Expert, Master, Titan), rank shields, race track, score rings and confetti. No image assets.
- **Daily quests** (study guide +20, 5-question instant-feedback drill +30, finish an exam +40 XP) feed streaks and badges (`lib/stats.ts`).
- **Study guides** (`lessons` table) show the level syllabus plus flip cards from that level's questions.
- **Certificates** are issued on passing levels 5, 10, 15 and 20 and verifiable at `/cert/<code>`.
- **Import from the questions repo**: `npm run import:questions -- git-titan "Git: Novice to Titan" git "GIT & GITHUB"` (repo at `../questions`, override with `QUESTIONS_DIR`). It dedupes, maps numeric/text difficulty onto 20 levels, turns `topics.json` progressions into syllabi, and lists invalid JSON files it skipped. Re-running on a track that already has questions will add duplicates at shifted levels, so clear that track's questions first.

## How it works
- **Tracks and levels**: `lib/levels.ts` defines the 20 levels. Each attempt draws 10 fresh questions for the level,
  favouring ones the learner has not yet answered correctly. 80% passes and unlocks the next level.
- **Questions**: `mcq`, `open`, `scenario`. Open answers are graded by Claude against a reference answer and rubric
  (`lib/grading.ts`). Without `ANTHROPIC_API_KEY` a coarse keyword fallback is used.
- **Knowledge first**: authored questions link to a `knowledge_items` row, the single source of truth for a track.
- **Improvement loop**: `/admin` flags questions that are nearly always failed or never failed, for review or retirement.
- **People**: `/admin/people` onboards someone (checklist + auto-enrol by job role) and offboards them
  (access ends immediately, offboarding checklist and handover notes).
- **Required learning**: `npm run seed:structure` loads companies, brands, projects and the pillar/topic map (`docs/curriculum.md`). Each person has scopes (companies, brands, projects) and an audience (staff or customer). `lib/paths.ts` turns that into their required path: tracks that are mandatory, or role-required for their job role, in their scope, with questions. They are enrolled automatically (at joining, on login, when scopes or policy change); the deadline is `dueDays` from enrolment and a track counts as done once `requiredLevel` is passed. It is a soft gate: nothing is blocked, but the dashboard shows what is due and `/admin/compliance` shows who is overdue. Admins set tier, audience, level and deadline per track at `/admin/paths`.
- **Customers**: invited like staff, with audience "customer" and the brands or projects they bought. They only ever see tracks whose audience is customer or both (enforced at enrolment, journeys, contests and the track page). Customer getting-started tracks exist but are empty until questions are authored; empty tracks are never counted as required.
- **Careers**: each job role has a promotion ladder (`career_levels`, `career_requirements`; starter ladders for developer, designer, sales and manager via `npm run seed:careers`). Level 1 is where people start; each higher level lists tracks and the level to pass. `lib/careers.ts` works out where someone stands. Promotion is a manager's decision (`/admin/careers`, recorded in `promotions`): allowed when every passable step is met and required learning is not overdue; only an admin can override, with a reason. A step whose track questions do not yet reach the level shows as "coming soon" and never blocks. Admins edit ladders on the same page.
- **Freshness** (`lib/freshness.ts`): when company knowledge changes (a brand moto, tone, policy) an admin records it at `/admin/freshness` (or adds `"changeNote"` to an item in an `import:knowledge` file). The before/after text is kept in `knowledge_changes`. A *material* change asks everyone enrolled in that track before the change to read it within 7 days (`/updates`, banner on the dashboard) and confirm (`knowledge_acks`); people who joined later are not asked, and a newer change to the same item replaces an unread older one. Wording fixes are recorded but ask nobody. `/admin/freshness` shows who has and has not read each change, and `/admin/compliance` flags unread counts. Linked exam questions are *not* changed automatically: the page tells the admin how many are linked so they can rewrite them. It is a soft gate and is not part of overdue/promotion rules.
- **Brand & voice**: `scripts/build-brand-content.mjs` authors the Moksy brand & voice track (tagline, vocabulary, colour, type, casing, tone, spelling) from the brand guidelines and lexicon in the moksy.ai repo, writing `content/brand/moksy-brand-voice.json` (`npm run import:knowledge -- content/brand/moksy-brand-voice.json`). It is a `role` track for social media manager, content writer, marketing and designer, scoped to the moksy.ai project. Questions arrive as "review"; approve them at `/admin/review/moksy-brand-voice` and the people it applies to are enrolled. When the brand changes, edit the source facts, re-run the build and import with `changeNote` set, or record the change at `/admin/freshness`.
- **Facebook & Meta Ads Marketing**: `scripts/ai/data/facebook-marketing-titan.ts` (143 cards, 35 hand-written questions, 10 marketing-maths generators in `scripts/ai/calc.ts`) builds a 2,400-question Titan Academy track with `npm run seed:ai -- facebook-marketing-titan`. It teaches durable concepts only (objectives, structure, audiences, creative, budgets, tracking with the pixel and Conversions API, delivery, policy, organic practice, running ads safely with AI agents). Interface names, prices and numbers that Meta changes often are left out. These questions go live as soon as they are seeded, so skim `npm run check:ai -- facebook-marketing-titan --sample` first.
- **Lead Generation & B2B Prospecting**: `scripts/ai/data/lead-generation-titan.ts` (161 cards, 33 hand-written questions, 9 funnel and email maths generators) builds a 2,400-question Titan Academy track with `npm run seed:ai -- lead-generation-titan`. It is general craft (targeting, channels, cold email and deliverability, qualification, CRM, metrics, UK PECR/UK GDPR/TPS principles, AI-agent safety, selling creative services) and contains nothing about any one company's offers, prices or ideal customer. Those must come from the business (see `ggleads` "D2" and the site's sales config) and belong in a company track. To make it required for the sales team, set its tier to "role" for `sales` at `/admin/paths`.
- **Claude & ChatGPT for Everyday Work**: `scripts/ai/data/claude-chatgpt-everyday-titan.ts` (134 cards, 31 hand-written questions) builds a ~2,200-question Titan Academy track for people who *use* assistants rather than code against them (the API tracks cover developers): how assistants work, prompting, everyday tasks, key features (Projects and Memory exist in both; Artifacts is Claude's; Canvas and Custom GPTs are ChatGPT's), limits and risks, checking answers, privacy, choosing between assistants, team practice. Seed with `npm run seed:ai -- claude-chatgpt-everyday-titan`. Feature names were checked against the vendors' help pages; file limits, plans, retention periods, prices and model names are left out because they change often, so re-check the feature cards every few months.
- **Customer content**: `scripts/build-customer-content.mjs` is the authoring source for the customer getting-started tracks (GGLearn, GGSocial, Moksy); it writes `content/customer/*.json`, loaded with `npm run import:knowledge -- content/customer/<file>.json`. Questions arrive as "review" and stay unpublished until an admin approves them at `/admin/review/<track>` (or from `/admin/paths`); approving enrols the customers it applies to. GGMoney is an internal tool and has no customer track; "Working with GGLink" and "Working with Guru Graphics" need real process facts before they can be written.
- **Legacy bank**: `npm run seed` imports `../trialtest.ai/database/data` (override with `LEGACY_DIR`) as the
  "Tech Foundations" brand, mapping each file's level band across the 20 levels.

## Dynamic questions (never the same exam twice)
- `lib/dynamic/` holds ~70 question *families*: seeded generators that build a fresh multiple-choice question every time (new numbers, code, names, tables, snippets) and work out the right answer in code. Each level exam draws 7 of its 10 questions from them (`DYNAMIC_PER_RUN` in `lib/dynamic/store.ts`; the rest come from the stored bank), and a learner is never shown the same generated prompt twice on a track.
- `lib/dynamic/tags.ts` maps each track to families (the first tag is the track's own subject and is drawn about twice as often). A track with no tags uses stored questions only.
- A generated question is saved as a one-off snapshot row (`source = dynamic`, `status = generated`), so grading, the review page and certificates work unchanged. These rows never enter the stored pools, drills or placement.
- `npm run check:dynamic [familyPrefix] [samples]` re-derives answers by really running node, python, php, sqlite, git, npm semver and the TypeScript compiler, and fails on any mismatch. Families without an executable oracle (CSS maths, REST, cloud/marketing maths, framework rules) are checked for structure only; review them by hand when you change them.
- `npm run coverage [-- --min 100 --fail]` counts, for every track and level, stored questions plus distinct generatable prompts, and lists the levels still under 100.
- Subjects that are company knowledge rather than computable (the `sdlc-*`, `gglink-*`, `moksy-*`... curriculum tracks) cannot be generated. `npm run generate:bank -- --track <slug>` authors them with Claude from the track's knowledge items, has a second blind pass audit every answer key, and saves them as `review` (add `--activate` to publish). It needs `ANTHROPIC_API_KEY`.

## Known gaps
- Legacy bank is thin at levels 16–20 and has no brand-specific content. Real brand knowledge must be authored.
- `git-extreme.json`, `google-cloud-expert.json`, `google-cloud-intermediate.json` are invalid JSON and were skipped.
- SQLite for local dev. Move to Postgres before multi-user production use.
- Email/password auth only. No password reset, rate limiting or SSO yet.

## Deploy
Production: https://gglearn.gglink.co.uk — Apache (TLS via certbot) reverse-proxies to a PM2 app `gglearn-web` on 127.0.0.1:3400.
Server uses Node 20, so avoid Node 21+ APIs (e.g. `Map.groupBy`) and keep `better-sqlite3` on a version with a Linux Node 20 prebuild (12.9.0).
`deploy/deploy.sh` syncs, installs, builds, pushes the schema and reloads PM2. `deploy/*.conf` is the Apache vhost.

### Auto-deploy (GitHub Actions)

`.github/workflows/deploy.yml` runs `deploy/deploy.sh` on every push to `main` (or manually via "Run workflow"). Required repo secrets: `DEPLOY_SSH_KEY` (private key authorised on the server), `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan <host>`), and optionally `DEPLOY_PORT`.
