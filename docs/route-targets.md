# Adding a job to "My route"

Every file in `content/targets/` is a job people can check themselves against at `/route`. Nothing needs listing in code: drop in `<slug>.json` (the `slug` must match the file name) and it appears. Files starting with `_`, files that do not parse, and files with no `areas` are skipped.

| Field | What it is |
|---|---|
| `slug`, `title`, `short`, `summary` | Name and one-paragraph description shown on `/route`. |
| `kind` | Optional. `entry` (default) asks about education, paid work and unpaid experience. `promotion` is for someone already in work (for example AO to EO) and skips those questions. |
| `areas` | One per skill area: `trackSlug` (an existing track), `target` level to reach, `hoursPerLevel`, `stage`, `priority` (1 = matters most), optional `confidence` (`digital` or `writing`, a self-rating that slows the plan). |
| `stages` | The phases the plan moves through (`n`, `label`, `blurb`). |
| `actions` | Real-world tasks that sit beside the learning (`stage`, `hours`, `priority`). |
| `apply` | The closing "start applying" advice. |
| `rightToWork` | Optional. Only for jobs tied to a country: the question (`ask`, `why`) and the warnings for "no" and "unsure". Leave it out and the question is not asked. |

Examples: `uk-civil-service-ao.json`, `junior-data-analyst.json`. A track with too few questions for the target level shows as "not available" and never blocks the check. After adding one, run `npm run check:route`.

## Civil Service grades

`content/careers/roles/civil-service.json` is the grade ladder (AO, EO, HEO, SEO, Grade 7, Grade 6) and `senior-civil-servant.json` continues it (SCS1 to SCS3), joined by a bridge from Grade 6. `/journey` plans a route along them. The promotion routes in `content/targets/` (`civil-service-ao-to-eo`, `civil-service-eo-to-heo`, `civil-service-g7-to-g6`) build the skills and evidence for one move. Steps on Civil Service tracks show as "coming soon" until the track has live questions at that level. Run `npm run seed:careers -- --add-steps` after changing a ladder.

## Any role

`/route/role` lets anyone pick any career ladder (the files in `content/careers/roles/`, or what an admin edited at `/admin/careers`) and a level to aim for. The route is made from the ladder when it is opened: nothing is written to a file. Its slug is `role--<role>--<level>` (for example `role--civil-service--6`), each track the ladder asks for up to that level becomes an area aimed at the highest level any rung needs, and each rung becomes a stage. It is a `promotion` route, so it does not ask about education or work history. Add a role or change a ladder and its route changes with it. Check: `npm run check:routerole`.
