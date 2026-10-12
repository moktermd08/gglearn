# Seasons

Page: `/seasons`. Logic: `lib/seasons.ts`. A fresh leaderboard every week (Monday to Sunday) and every month, in UTC.

## Points
- **100 per level gained**: a level passed in the season that is above the level the person already held in that subject when the season began (the same growth rule as contests, so beginners and experts race fairly). Each level counts once. Re-passing a level you already had, and failed exams, earn nothing.
- **10 per active day**: any day with a finished exam or a daily quest.
- Ranking: points, then levels gained, then who reached their total first.

## What is stored
- Live standings are computed on read from `runs` and `daily_quests`.
- When a season has ended, `settle()` writes its final standings once (`season_results`, marked by `season_closed`), so a finished season never changes. It runs when anyone opens `/seasons` or a progression page.
- Badges (group "Seasons" in `lib/progression.ts`) read `season_results`: first season, 5 seasons, top 3, top 3 five times, first place.

## Privacy
- Boards are per audience: staff see staff, customers see customers.
- Only first name and initial are shown, with a generated face, never a photo or email.
- People can opt out on their profile (`users.season_board`). Hidden people disappear from live and past boards and stop earning results. Past boards keep the original ranks, so hiding leaves a gap rather than renumbering others.

## Team, company and role boards
`/seasons?view=teams|companies|roles` (staff only; customers see only the people board). Logic: `lib/groups.ts`.
- **Teams** are the brands and projects people are assigned to (`user_scopes`; shared and personal brands are not teams). **Companies** come from company scopes, plus the company of any brand or project a person belongs to. **Roles** group people by job role.
- Groups are ranked by **average points per member**, so size does not decide it. Members with no points count as zero. A group needs 2+ members to be ranked; smaller ones are listed unranked.
- Opening a group shows its members ranked by points. Hidden people (`season_board = hide`) are not members of any group and add no points.
- Group boards are computed on read from the individual standings. Past seasons use today's membership, since scope changes are not versioned.
- Groups only exist once an admin assigns people to a company, brand or project; until then Teams and Companies say so.

## Limits
- Ranks are among everyone in the audience; there are no team, region or subject-specific history boards (a subject filter exists for the live or past view of the subjects you study, computed on read).
- No prizes are attached. Medals and badges only.

Run `npm run db:push` to add `users.season_board`, `season_results` and `season_closed`.
