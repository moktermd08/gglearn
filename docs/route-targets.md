# Adding a job to "My route"

Every file in `content/targets/` is a job people can check themselves against at `/route`. Nothing needs listing in code: drop in `<slug>.json` (the `slug` must match the file name) and it appears. Files starting with `_`, files that do not parse, and files with no `areas` are skipped.

| Field | What it is |
|---|---|
| `slug`, `title`, `short`, `summary` | Name and one-paragraph description shown on `/route`. |
| `areas` | One per skill area: `trackSlug` (an existing track), `target` level to reach, `hoursPerLevel`, `stage`, `priority` (1 = matters most), optional `confidence` (`digital` or `writing`, a self-rating that slows the plan). |
| `stages` | The phases the plan moves through (`n`, `label`, `blurb`). |
| `actions` | Real-world tasks that sit beside the learning (`stage`, `hours`, `priority`). |
| `apply` | The closing "start applying" advice. |
| `rightToWork` | Optional. Only for jobs tied to a country: the question (`ask`, `why`) and the warnings for "no" and "unsure". Leave it out and the question is not asked. |

Examples: `uk-civil-service-ao.json`, `junior-data-analyst.json`. A track with too few questions for the target level shows as "not available" and never blocks the check. After adding one, run `npm run check:route`.
