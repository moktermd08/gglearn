# Player level, streak and badges

Page: `/achievements` (also summarised on `/dashboard` and `/profile`). Logic: `lib/progression.ts`.

- **XP** is the same XP shown everywhere: every finished exam (score x 100, plus 50 if passed) and every daily quest, on any subject.
- **Player level** (1 to 100) is a function of total XP: `xpToReach(L) = 50 * L * (L - 1)`, so level 2 is 100 XP, level 10 is 4,500, level 50 is 122,500. The title changes every ten levels (Rookie ... Legend). This is separate from the 20 levels inside each subject.
- **Streak**: consecutive UTC days with at least one finished exam or daily quest, on any subject. It stays alive until the day ends (shown as "at risk" once the previous day was active and today is not yet). There is no streak freeze.
- **Badges**: 33 badges in six groups (Streaks, XP, Levels, Mastery, Contests, Seasons), each with a target and a progress bar. Rules are code (`BADGES`), computed from exams, quests, certificates and contests. The only stored fact is when a badge was first earned (`user_badges`, one row per person and badge). Badges are recorded on page views and after each exam, so people who had already met a rule before this shipped get today's date as "earned".
- The older per-subject badges on `/tracks/<slug>` are unchanged.

Run `npm run db:push` to create `user_badges`.
