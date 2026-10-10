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
- **Legacy bank**: `npm run seed` imports `../trialtest.ai/database/data` (override with `LEGACY_DIR`) as the
  "Tech Foundations" brand, mapping each file's level band across the 20 levels.

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
