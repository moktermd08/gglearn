# Question mix and bank depth

Every role is examined across seven domains, in different proportions, and the proportions move as people climb the ladder.

| Domain | What it is | Examples |
|---|---|---|
| technology | languages, frameworks, data stores, cloud, AI engineering | `html-titan`, `react-titan`, `tech-data-stores` |
| tool | software people operate | `tools-build-ship`, `tools-business` |
| process | how work is done safely | `sdlc-*`, `governance-compliance`, `security-operations` |
| product | what the company ships | `moksy-product`, `product-management-core` |
| service | what the company sells and delivers | `gglink-*`, `service-design-pricing` |
| brand | identity, voice, positioning | `brand-positioning-voice`, `guru-brand-identity` |
| leadership | strategy, people, money, risk, communication | `tech-strategy-roadmap`, `engineering-leadership`, `finance-for-leaders` |

## Where it lives

- `content/blueprints/roles.json`: per role a `start` mix and a `top` mix (whole percentages, each sums to 100). Rungs in between are interpolated and rounded by largest remainder (`lib/blueprint.ts`).
- `content/blueprints/domains.json`: which domain a track belongs to (its `kind` decides unless overridden).
- `content/cards/<slug>.json`: concept cards the engine expands into 1000+ questions per track (see `content/cards/AUTHORING.md`). `npm run check:cards`, then `npm run seed:cards`.

Example (top rung): CTO is 29% leadership, 20% process, 15% product, 12% technology, 10% service, 10% brand. Full stack developer is 42% technology, 22% process, 12% tools, 10% product, 6% leadership.

## Fitting a ladder

`npm run fit:blueprint` (dry run) shows how far each ladder is from its blueprint; `-- --write` rewrites `content/careers/roles/*.json` and `-- --write --apply` updates the database too, only for roles whose database steps still equal the file (nothing edited in the app is overwritten; overlay steps are untouched). It chooses from the tracks in `content/blueprints/pools.json`, keeps levels at 20 or below, and makes every rung ask for something new. After adding tracks or changing a mix, run it again.

## Checks

`npm run check:blueprint` compares each ladder's required levels with its blueprint (drift in percentage points) and checks every track has 1000+ questions and 50+ on every level. `-- --role cto` shows one role rung by rung (fast); `-- --list` lists short tracks.

`/journey` shows the mix for the next step under "What you will be asked".

## Role check

`/journey` offers a **role check**: one exam drawn across the tracks of the person's path in the proportions of their role's mix (`lib/roleExam.ts`, `/role-exam/[id]`). It is stored apart from track runs (`role_exams`, `role_exam_answers`) so it never counts as passing a single track, and the result is broken down by domain. Run `npm run db:push` to create the tables.
