# Career ladder template (for every company)

Every role has one ladder, written the same way. A person sets a goal ("CTO, by October 2031"), and gglearn builds the route from their current role at `/journey`.

Based on the Career Progression guidelines (IC1 to IC6): each level has a theme and is described in three measures.

| Measure | What it covers |
|---|---|
| Knowledge | Breadth and depth of knowledge; how their expertise develops over time |
| Delivery | What they are expected to deliver and how they go about it |
| Communication & leadership | How they communicate and lead people and/or projects across the business |

Sub-levels are computed, never stored: of the next level's passable steps, fewer than half met is `.0` (new to the level), half or more is `.1` (established, can take half of the next level), three quarters or more is `.2` (pushing for the next level). Shown as `L2.1`.

## Files (`content/careers/`)

| File | What it is |
|---|---|
| `framework.json` | The shared framework: level themes and the three measures. Same for every company. |
| `_template.json` | Annotated blank. Copy it to start a role. |
| `roles/<role>.json` | One ladder: rungs, each with title, summary, the three measures and steps; plus `bridges` into the ladder. |
| `overlays/<company>.json` | Steps one company adds to the shared ladders for its own tracks. |

`npm run seed:careers` creates ladders that do not exist yet, and fills blank wording on existing ones. `npm run seed:careers -- --add-steps` also adds missing steps and overlay steps to existing ladders. Nothing an admin edited at `/admin/careers` is overwritten or removed. Seed or import the tracks first (a step on an unknown track is skipped with a warning; a step on a track whose questions do not reach that level shows as "coming soon" and never blocks).

## Adding a role for your company

1. Copy `_template.json` to `roles/<role>.json`. `role` is the job role exactly as on people, lower case.
2. Write 4 to 6 rungs. Rung 1 is where people start and has no steps. For each rung write what you would *see* someone do under knowledge, delivery and leadership.
3. Steps are `[track slug, level to pass]`. Typical: level 2 → 5, level 3 → 8, level 4 → 10 to 12, level 5 → 12 to 16.
4. Add `bridges` so people can reach the ladder from elsewhere: `{ "from": "developer", "fromLevel": 4, "toLevel": 1 }` means anyone who has reached level 4 or above on the developer ladder can step in at level 1 of this one. A route can chain bridges.
5. Keep company-specific tracks out of shared role files; put them in `overlays/<company>.json`: `{ "role": "social media manager", "rung": 2, "slug": "moksy-brand-voice", "level": 5 }`. A person who cannot see a track (outside the company's scope) is not asked to pass it on their journey.
6. Run `npm run seed:careers -- --add-steps`.

## Roles shipped

Architect, Engineer, Frontend Developer, Backend Developer, Content, Interaction Designer, Graphics Designer, Video Editor, Tester, Product Designer, Project Manager, Delivery Manager, Marketing, Social Media Manager, Sales, Accounting, Security, DevOps, Admin, Data Analyst, Account Manager, HR Manager, CTO, CEO, plus the original Developer, Designer and Manager ladders.

Example route (Junior Developer → CTO): Developer → Senior Developer → Lead Developer, then a bridge into the CTO ladder: Engineering Manager → Head of Engineering → VP Engineering → CTO.

## What the journey does and does not do

- Finds the fewest-moves route (own ladder up one level at a time, plus bridges) and lists each level's steps with Start or Continue.
- Spreads the learning across the goal date in proportion to the levels each stage needs, counting a track needed twice only once.
- Compares the pace needed with the levels passed in the last four weeks: on track, behind, not started, or past the date.
- Does not promote anyone and does not measure knowledge, delivery or leadership beyond the learning steps; those wordings are what a manager judges against. Steps still being written are shown and not counted.
