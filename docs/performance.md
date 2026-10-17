# Performance at scale

Measured 2026-10-16 on a synthetic academy: 20 companies, 10,003 people, about 140,000 enrolments, 300,000 exam passes, 20,000 certificates, 50,000 notifications, on top of the real content (149 tracks, 221,000 questions). SQLite, one process. The numbers are from a laptop; read them as relative, not as promises.

## How to measure
```bash
sqlite3 data/gglearn.db ".backup /tmp/perf.db"      # never the real file: the seed refuses data/gglearn.db
DATABASE_FILE=/tmp/perf.db npm run db:push          # drizzle.config.ts reads DATABASE_FILE too
DATABASE_FILE=/tmp/perf.db npm run perf:seed        # PERF_COMPANIES=20 PERF_PEOPLE=500 by default
DATABASE_FILE=/tmp/perf.db npm run perf             # PERF_ONLY="standings|dashboard" times just those rows
```
`scripts/perf/measure.ts` times what a page load does (the root layout, the learner dashboard, a company manager's dashboard and the whole-academy views), each row printed as it finishes.

## What was slow, and what it is now
Before: the same functions on a 1,003-person database with the old code (the full 10,000 never finished). After: the new code on 10,003 people.

| What | Before (1,003 people) | After (10,003 people) |
|---|---|---|
| `catalog()`, asked for by almost every page, several times on the dashboard | 396 ms every call | 0 ms (kept 30 s); 22 ms cold |
| Required learning for one person without a catalogue passed | 388 ms | 0.7 ms |
| Onboarding status for one person | 423 ms | 1.1 ms |
| Everyone a manager runs (`usersInReach`) | 409 ms | 57 ms |
| Compliance report, one company's people | 31,384 ms (whole academy) | 112 ms |
| Compliance report, whole academy | 31,384 ms | 783 ms |
| Phases waiting for sign-off | about 400 s (one catalogue build per person) | 66 ms |
| Manager's dashboard panel | did not finish | 184 ms (kept 30 s) |
| Platform owner's dashboard panel | did not finish | 642 ms (kept 30 s) |
| Season board for one company | read every user | 118 ms |

Pages, production build, `curl`, 10,003 people:

| Page | Company manager | Platform owner |
|---|---|---|
| Dashboard | 0.24 s | 0.21 s (1.1 s the first time in 30 s) |
| People (a page of 50, search, paging) | 0.22–0.33 s | 0.26–0.29 s |
| Who is up to date | 0.14 s | 0.65 s |
| Seasons | 0.15 s | |
| Certificates | 0.17 s | 0.14 s |

## What changed
- **Indexes** that did not exist: `runs(user_id, track_id)`, `runs(finished_at)`, `answers(run_id)`, `checklist_items(user_id)`, `certificates(expires_at)`, and `questions(status, track_id, level)`. Every "this person's passes in this subject" scanned the whole runs table.
- **`catalog()`** counts questions in one pass over the new index instead of two scans, and is kept for 30 seconds (`CATALOG_TTL_MS`). Anything in this process that changes tracks or questions drops it at once (`resetCatalogCache`).
- **Lists of people** load enrolments and best levels for everyone in two queries (`loadProgress`) instead of several queries each, and work out the required tracks once per company, role and audience.
- **Onboarding** does nothing for anyone past the 90-day gate window, and the sign-off list is worked out together.
- **Reach** (`usersInReach`) reads the brand and project tables once, not once per person; a person's own look reads only their brands and projects.
- **The dashboard panel and compliance** count only the viewer's own people, not the whole academy.
- **Season boards** for a company start from that company's people, and the dashboard's "this week" rank uses the person's company arena like the Seasons page (it ranked against everyone before).
- **People and Who is up to date** are read a page at a time with search and filters. The people page rendered every person in the academy, each with its own copy of the role list and a form per checklist item.
- A season board spread a whole week's runs into `push(...rows)`, which overflows the call stack past about 100,000 rows; it appends in a loop now.

## The admin frame
The admin (`app/(admin)`) works out its scope and the Certificates badge on every page. Both are cheap: resolving the scope and the switcher takes a few milliseconds, and the badge (`expiryWatchFor`) reads the certificates inside the watch window through the expiry-date index. With a few (up to 150) it looks up only their holders, which costs next to nothing; with more it builds the set of everyone in reach once (150 to 250 ms at 10,000 people, and about 12,000 certificates in the window in the synthetic data). The Overview counts for a company take about 0.5 s the first time in each 30 seconds and 2 ms after; the sign-off list about 0.25 s.

## Not done, and where it will bite next
- Everything is still one SQLite file in one process; the reach and arena maps are read whole (tens of ms at 10,000 people, linear after that).
- A platform owner's dashboard panel is 0.6 s the first time in each 30 seconds at 10,000 people. At 100,000 it would be seconds; the next step is storing per-person compliance instead of working it out on read.
- `settle()` for a finished season still runs one board per arena and audience.
