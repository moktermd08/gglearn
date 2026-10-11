# H. Teams, competitions and keeping the workforce hyper-active (H-001 to H-100)

## Teams (no Team object exists; closest is a private competition)
- H-001 ❌ Create a team "Guru Graphics Sales" with 4 members. No Team table.
- H-002 ⚠️ Workaround: a private competition on one track, goal N levels, invite 4 emails. Gives leaderboard and deadline, but only for one track.
- H-003 ❌ Team goal across several tracks. Contest is per track.
- H-004 ❌ Team manager sees only their team. Managers see all people.
- H-005 ❌ Team dashboard (who is blocked, who is ahead). None.
- H-006 ❌ Team streak. None.
- H-007 ❌ Team onboarding batch (5 hires same day, same cohort). Individual invites.
- H-008 ❌ Cohort start date and cohort deadlines. None.
- H-009 ❌ Team-wide announcements. None.
- H-010 ❌ Team chat. Out of scope.
- H-011 ⚠️ Team member leaves: contest membership remains until status changes; offboard does not touch competition rows.
- H-012 ❌ New team member inherits the team's tracks and goal. Scope + role do this partially.
- H-013 ❌ Move a person between teams. N/A.
- H-014 ❌ Team of mixed roles with a shared outcome. N/A.
- H-015 ❌ Team-level certificate. None.

## Competition rules (read from `app/competitions/actions.ts`, `lib/contests.ts`)
- H-016 ✅ Any signed-in user can create a contest, not only managers.
- H-017 ⚠️ Learners can attach cash prizes; gglearn only records that the organiser paid (`prizePaidAt`).
- H-018 ⚠️ A learner could invite outside email addresses; invitations are only for people with accounts, and wording is identical either way (no probing).
- H-019 ✅ Max 20 humans by default, enforced inside the join transaction.
- H-020 ✅ Joining a finished or cancelled contest is blocked.
- H-021 ✅ Public contests require consent to be seen.
- H-022 ✅ `makePrivate` is one-way so no one is exposed after agreeing to something else.
- H-023 ✅ Organiser cannot leave; they cancel (organiser or admin can).
- H-024 ✅ A person at max level on the track cannot join.
- H-025 ✅ Invites are rate limited to 20/hour/organiser.
- H-026 ⚠️ Contest ends: champion/finisher certificates by claim.
- H-027 ❌ Contest results sent to the team automatically. None.
- H-028 ⚠️ Bot rivals can be added (casual/steady/fierce) so a solo or tiny team has competition.
- H-029 ❌ Bots mislead a manager into thinking the team is ahead. Standings mix bots and humans; labelled as bots.
- H-030 ❌ Hide bots in a team-only contest. Counts configurable (zero is possible).
- H-031 ❌ A prize payable in a currency unsupported by the company. Free text currency (default USD).
- H-032 ❌ Tax reporting. Out of scope.
- H-033 ❌ Anti-collusion (two people trading answers). None.
- H-034 ❌ Late joiners start with a baseline; baseline logic handles it (`baselineLevel`).
- H-035 ❌ Contest on a track that gets retired mid-way. Keeps working because rows remain.

## Daily habits
- H-036 ✅ Quests and streaks reward a daily habit.
- H-037 ❌ Habit reminders at the person's chosen time. None.
- H-038 ❌ Manager "learning hour" blocks on shared calendars. None.
- H-039 ❌ Company-wide challenge week. Contest could do it for one track.
- H-040 ❌ Learning in the flow of work (bot in Slack asking 1 question). None.
- H-041 ❌ Push notifications. None.
- H-042 ❌ Weekly leaderboard reset. XP is cumulative.
- H-043 ❌ League system with promotion/relegation. None.
- H-044 ❌ Points for helping others. None.
- H-045 ❌ Quiet mode / do not disturb. N/A.

## Making people "hyper-active" without burning out
- H-046 ❌ Recommended weekly minutes per person. None.
- H-047 ❌ Detect overload (18 required tracks, 4 overdue). Compliance shows overdue only.
- H-048 ❌ Auto re-plan deadlines for overloaded people. None.
- H-049 ❌ Different cadence for different roles (sales: 15 min daily). None.
- H-050 ❌ Learning time counted as work time. Not measured.
- H-051 ❌ Manager approval of study time. None.
- H-052 ❌ Reward consistency over speed. Streak partly.
- H-053 ❌ Mentors' recognition. None.
- H-054 ❌ Skills passport portable to the next employer. Certificates are public by code.
- H-055 ❌ Negative effects of public leaderboards on junior staff. No opt-out.

## Role-play the five scenarios as teams/engagement
- H-056 ⚠️ **Sales team of 4**: private contest on one lead-gen track with a prize and a weekly goal is the best fit once the track exists.
- H-057 ❌ **Social media manager** works solo; no team features required but needs approval workflow knowledge.
- H-058 ❌ **Individual** with a personal goal date. None.
- H-059 ❌ **Junior full-stack** with a mentor. None.
- H-060 ❌ **Brand-update**: company-wide "refresh week". Contest is per track only.

## Communication
- H-061 ❌ In-app inbox. None.
- H-062 ❌ Email at all. No mailer.
- H-063 ❌ Webhook for events (invite used, level passed, overdue). None.
- H-064 ❌ Slack/Teams app. None.
- H-065 ❌ SMS/WhatsApp. None.
- H-066 ❌ iCal feed of deadlines. None.
- H-067 ❌ RSS of new content. None.
- H-068 ❌ Public API for HR systems. None.
- H-069 ❌ Zapier/n8n/Moksy connector. None.
- H-070 ❌ Embeddable widgets in the intranet. None.

## Access to a shared leaderboard and the privacy trade-off
- H-071 ✅ Avatars optional, generated faces by default; photo uploads opt-in.
- H-072 ❌ Initials only display for privacy. Names shown on standings for joined members.
- H-073 ❌ Per-person visibility settings. None.
- H-074 ❌ Customers appear on staff leaderboards. Contest is invite-based; staff contests invite staff.
- H-075 ❌ Competitors outside the company see inner standings in a public contest. By design with consent.

## Leadership dashboards
- H-076 ❌ Company-wide completion %. None.
- H-077 ❌ Cost per person of Claude grading. None.
- H-078 ❌ Active learners this week. None.
- H-079 ❌ Median time to pass level 5. None.
- H-080 ❌ Weakest topics across the company. Only per question.
- H-081 ❌ Question-level analytics by team. None.
- H-082 ❌ Correlation with business KPIs. None.
- H-083 ❌ Board-ready PDF. None.
- H-084 ❌ Benchmark against other companies. None.
- H-085 ❌ Forecast "we will hit the goal by X". None.

## Misuse and fairness
- H-086 ❌ A manager creating contests to pressure juniors. No guardrails.
- H-087 ❌ Using bots to inflate results. Bots clearly labelled.
- H-088 ❌ Cheating on contest XP via repeated easy tracks. Contest gains levels, hard to cheat, but small tracks may be easy.
- H-089 ❌ Ties: tie-break rules. `standings` orders; ties details unverified.
- H-090 ❌ Dispute resolution. None.
- H-091 ❌ Prize paid late. Manual.
- H-092 ❌ Prize recorded paid but not actually paid. No evidence.
- H-093 ❌ Winner offboarded before payout. Contest continues; no flag.
- H-094 ❌ Contest of one human only. Allowed with bots.
- H-095 ❌ Contest with 0 humans after leavers. Remains.
- H-096 ❌ Contest with a goal of 20 levels in 1 day. Allowed within validation.
- H-097 ❌ Competition slug unguessable; leak via screenshots. Public contests are visible by design.
- H-098 ❌ Delete a contest. Cancel only.
- H-099 ❌ Copy a contest for next quarter. None.
- H-100 ❌ Recurring contests. None.
