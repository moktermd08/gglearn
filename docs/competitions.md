# Competitions

Learn any track head-to-head: against simulated bots, against people, or both. Pages: `/competitions` (list),
`/competitions/new`, `/competitions/<slug>` (live leaderboard), `/profile` (optional photo).

## Rules
- **Goal**: gain N levels (1-20) in one track before the deadline (1-90 days, optional delayed start).
- **Progress is growth, not absolute level.** A person's baseline is the highest level they had passed before they started
  racing; only levels newly passed after that count. Beginners and experts can race fairly. People who are within N levels of
  Titan have a reduced target, shown on the leaderboard.
- **Ranking**: reached the goal first (earliest time wins) > levels gained > XP in the window. Results come from real exams
  (`runs`), so they use the same grading, pass mark and question draw as everywhere else.
- **Finished contests never change.** Standings are computed on read and clamped to `endsAt`; bot personas and paces are stored
  on the member row, not re-derived.
- Practice XP (study guide, drill) is counted by UTC day, so it can include same-day activity from before the start time.

## Time records, rankings and coming back to beat them
Every live or finished contest page has a **Time to beat** section (`lib/records.ts`, `app/competitions/[slug]/time-board.tsx`). Nothing is stored
for it except record attempts: times, ranks, percentiles, splits and badges are read from real exams (`runs`) on every view.
- **Finish time**: from when you started racing (contest start, or when you joined if later) to the exam pass that reached the goal.
- **Hall of Fame**: fastest first, best time per person. "Beats X%" is the share of the *other* people on the board who were slower.
  The header shows the record, how many raced, how many finished (completion rate) and the median time. A histogram shows where you sit in the pool.
- **Splits**: your time for each level gained next to the record holder’s.
- **Pace projection** (live, still racing): a straight-line estimate of your finish time and how it would rank. Shown as an estimate.
- **Fastest single exam per level**: start-to-finish time of one passing exam (needs two or more people at that level). Question draws differ between people, so close times are ties.
- **Exam clock**: the exam page ticks up from when the exam started and, in a live contest you race in, shows the level record to beat. The result page shows time taken, rank and % beaten, and celebrates a new level record.
- **Come back and beat it** (after the contest ends): anyone who can see the contest starts a record attempt (table `contest_attempts`): the same goal, from wherever they stand now
  (levels already passed do not count again), with their own clock and as long as the contest lasted. A ghost bar shows the record holder’s pace. A finished attempt goes on the same board;
  retrying is allowed, the best time counts. Public contests ask a non-member to consent to appearing on the board.
- **Badges** (derived, never awarded by hand): Record holder, Podium, Top 10% / Top 25% (five or more finishers), Finisher, Record breaker (beat the contest’s time after it ended),
  Beat their own time, Speed demon (fastest exam on a level), Flawless (a 100% pass), Steady (five or more practice days).
- Limits: the exam clock includes grading time and any idle time with the tab open; a different question draw can make one exam easier than another. Times compare people who race the *growth* of N levels, not identical levels.

## Bots are simulated, and say so
A bot does not study or answer questions. It follows a fixed daily XP schedule (`lib/bots.ts`) on the same scale as people
(150 XP = 1 level). Tiers set the pace (casual 45, steady 75, fierce 120 XP/day); five styles shape the schedule (steady,
sprinter, crammer, weekender, perfectionist). Name, style and look differ per bot (8 designs, own colours). The leaderboard labels
every bot "Bot, simulated" and the page lists each bot's schedule. Pace numbers are design choices, not measured human data.

## Faces
People use their own photo if they uploaded one (JPEG/PNG/WebP, 300 KB, type checked from the bytes, SVG rejected),
otherwise a generated face. Colleagues who are signed in can see photos; a signed-out visitor sees a photo only if that person
plays in a public contest.

## Visibility and privacy
- **Private**: only the organiser, invited people and members can open it; anyone else gets a 404 (existence is not revealed),
  and the page title is generic.
- **Public**: anyone can watch without signing in. Joining requires ticking a consent box (name, photo, progress become public).
  Public can be switched to private later, never the other way round.
- Invitations never reveal whether an address has an account.

## Why it is built this way (and its limits)
- Exams and drills are retrieval practice: testing yourself beats re-reading (Roediger & Karpicke 2006; Dunlosky et al. 2013).
- Practice spread over days beats cramming (Cepeda et al. 2006), so the leaderboard shows practice days and longer contests are suggested.
- Graded levels with reviewed answers follow deliberate practice (Ericsson et al. 1993).
- Competition motivates some people and discourages others, so private, bot-only and friend contests are all first-class.
- Soft skills are tested with written scenario questions marked against a rubric (AI-graded, approximate). That measures judgement
  and knowledge, not live behaviour. The question bank currently holds almost only technical tracks; soft-skill tracks need authored content.
