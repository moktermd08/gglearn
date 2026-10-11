# C. Onboarding: day 1 to day 90 (C-001 to C-100)

## Day 0-1
- C-001 ✅ On join the person gets 5 staff checklist items (or 3 for customers) and required tracks are enrolled automatically.
- C-002 ⚠️ If nothing is required for the role, up to 6 tracks whose `roles` is empty or contains the role text are enrolled, in table order, not by relevance.
- C-003 ❌ Role text `social media manager` matches no `roles` strings, so only role-less tracks are recommended (random generic content).
- C-004 ❌ Welcome page explaining "what you must do this week". Dashboard lists requirements but no narrative.
- C-005 ❌ Day-1 schedule combining checklist, tracks and meetings. None.
- C-006 ❌ Buddy/mentor assigned. None.
- C-007 ❌ Manager assigned and visible to the learner. None.
- C-008 ❌ Equipment/tool access requests integrated with IT. Checklist text only.
- C-009 ❌ Checklist item "Get access to the tools" marked done by the new hire. Only managers can tick.
- C-010 ⚠️ Manager forgets to tick items; nothing nags them.
- C-011 ❌ Checklist progress visible on the learner's own dashboard. It lives in `/admin/people`.
- C-012 ❌ 30-60-90 plan entered and tracked. Item text only.
- C-013 ❌ Company-specific day-1 reading (brand story, moto, values). Not stored as content; the learner has to be sent a link.
- C-014 ❌ Brand moto/voice quiz at day 1. No such track for Moksy (see G).
- C-015 ❌ Day-1 safety/compliance acknowledgement with signature. None.
- C-016 ⚠️ `governance-compliance` mandatory for all staff in the shared pool; level 5 in 30 days.
- C-017 ❌ Intro to the org chart. None.
- C-018 ❌ "Who to ask" directory. None.
- C-019 ❌ Hardware issued tracking. None.
- C-020 ❌ Remote vs office onboarding variants. None.

## Required path realism
- C-021 ⚠️ A new developer receives ~18 role tracks, each "level 5 in 30 days". That is likely 100+ hours; no workload estimate.
- C-022 ❌ Prioritise: which three tracks first? Sorted by mandatory, then due date, which is the same for all.
- C-023 ❌ Sequence: learn Git before CI/CD. No prerequisites between tracks.
- C-024 ⚠️ Level unlocking is sequential inside a track, but across tracks there is no ordering.
- C-025 ❌ Staggered due dates (week 1, 3, 6, 12). One `dueDays` per track, though admins can set different values per track by hand.
- C-026 ⚠️ Tracks with insufficient questions are silently not required, so a new hire's list looks shorter than the intended path.
- C-027 ❌ Show the new hire which planned tracks are "coming soon". Only careers show that.
- C-028 ✅ Required tracks the person is already placed above (via placement) count as passed.
- C-029 ❌ Placement test offered automatically for each required track on day 1. Placement lives in the `/start` journey, not in the required path.
- C-030 ❌ Fast-track: senior hire tests out of the whole required path in one sitting. None.
- C-031 ❌ Per-role onboarding bundle (name, tracks, checklist, meetings, 30-60-90). Spread across several places.
- C-032 ❌ Onboarding "graduation" event ("you completed onboarding"). None; the checklist simply fills up.
- C-033 ❌ Probation review linked to progress. Manual.
- C-034 ❌ Manager report at day 30/60/90. Compliance snapshot only.
- C-035 ❌ New hire feedback about onboarding. None.
- C-036 ❌ Questions the new hire asks are saved as FAQ. None.
- C-037 ❌ In-app help/search for "how do I get the VPN?". None.
- C-038 ❌ Link from a question to the source doc. Questions link to knowledge items internally; not shown to learners.
- C-039 ⚠️ Study guide per level (syllabus + flashcards) exists at `/tracks/<slug>/learn/<level>`.
- C-040 ✅ 5-question instant-feedback drill exists per track.

## Role-specific first weeks
- C-041 ❌ **Social media manager (Moksy AI)**: no role tracks, no ladder, no brand voice track. Biggest hole.
- C-042 ⚠️ **Developer**: strongest coverage (18 role tracks, ladder).
- C-043 ❌ **Sales (Guru Graphics Limited)**: role track `gglink-sales-support` has 0 questions, so not required.
- C-044 ⚠️ **Designer**: three Guru role tracks all have 0 questions.
- C-045 ✅ **Manager**: `delivery-management` and `people-operations` have questions.
- C-046 ❌ **Support agent**: no role, no ladder.
- C-047 ❌ **Accountant/finance**: no role, ggmoney internal track absent.
- C-048 ❌ **Content writer**: `gglink-seo-content` and `mhossain-content` have 0 questions.
- C-049 ❌ **Customer success**: only customer-side tracks exist.
- C-050 ❌ **Intern**: no reduced path.
- C-051 ❌ **Founder/CEO**: no executive path; manager ladder is the closest.
- C-052 ❌ **Freelancer/contractor** per project. Scope can be a single project, but no contract end.
- C-053 ❌ **Agency client's staff** learning the client's brand. Needs customer audience with brand-level tracks (guru-customer-start has 0 questions).
- C-054 ❌ **Ambassador/affiliate**. No audience.
- C-055 ❌ **Reviewer** (Moksy reviewer ladder). No such role.
- C-056 ❌ **Part-time moderator**. No role.
- C-057 ❌ **Data analyst**. `data-analytics` (16 q) exists, no ladder.
- C-058 ❌ **DevOps/SRE**. Tracks exist, no ladder.
- C-059 ❌ **QA tester**. `sdlc-testing` exists, no ladder.
- C-060 ❌ **Product owner**. No role.

## Engagement in the first month
- C-061 ✅ Daily quests (study +20, drill +30, exam +40 XP) give streaks and badges.
- C-062 ⚠️ Rival per subject is simulated; it motivates but is not tied to real colleagues.
- C-063 ✅ Competitions let a manager create a private contest with a goal and an end date.
- C-064 ❌ Nudges when a streak is about to break. No notifications.
- C-065 ❌ Daily summary email. None.
- C-066 ❌ Slack/Teams digest. None.
- C-067 ❌ Weekly manager digest of new-hire progress. None.
- C-068 ❌ Automatic "you're behind" warnings before overdue. None; only a dashboard colour.
- C-069 ❌ Celebrate completing onboarding publicly (company feed). None.
- C-070 ✅ Certificates at levels 5/10/15/20, publicly verifiable.
- C-071 ❌ Certificates cover a role-path (e.g. "Moksy Social Media Manager"). Per track only.
- C-072 ❌ Badge for completing the onboarding checklist. Badges come from stats only.
- C-073 ❌ Onboarding speed leaderboard. Competitions are per track.
- C-074 ⚠️ A customer who joins an open public contest on a staff-only track gets a leaderboard row but no enrolment (`enrol` checks audience), so they appear but cannot play.
- C-075 ❌ Hide the leaderboard for people who find it stressful. No opt-out.

## Failure and struggle
- C-076 ✅ Fail a level: score below 80%; try again with fresh questions favouring ones not yet answered correctly.
- C-077 ✅ Dynamic questions never repeat the same prompt for a person on a track.
- C-078 ❌ Unlimited retakes allow brute-forcing. No cooldown between attempts at a level.
- C-079 ❌ Detect someone clicking randomly. No time-per-question heuristics.
- C-080 ❌ Detect cheating via AI assistants. None; exams are untimed overall except `timeSec` per question, which is not enforced server-side as far as read.
- C-081 ❌ Alert the manager that someone failed level 3 five times. None.
- C-082 ❌ Offer remedial material automatically after repeated fails. Study guide only.
- C-083 ❌ Ask for help (message the manager) from within an exam. None.
- C-084 ⚠️ Open answers graded by Claude may disagree with a human; no appeal. Admin can retire a question but cannot re-grade an answer.
- C-085 ❌ Appeal a score. None.
- C-086 ❌ Report a wrong question from inside the exam. Not in learner UI; admin finds nearly-always-failed questions.
- C-087 ✅ Admin dashboard flags questions that are almost always failed/never failed.
- C-088 ⚠️ A bad question retired after someone failed because of it: past scores stay.
- C-089 ❌ Recompute scores after retiring a question. None.
- C-090 ❌ Graded answer privacy (the open answer text is stored plain in `answers`). Consider retention.

## Probation end
- C-091 ❌ "Is this person ready to be confirmed?" report. Closest: compliance + checklist.
- C-092 ❌ Probation extended: deadlines do not move.
- C-093 ❌ New hire resigns in week 2: offboarding creates the generic checklist. See I-category.
- C-094 ❌ New hire never logs in after invite accepted. Compliance shows overdue after 30 days, no earlier flag.
- C-095 ❌ New hire logs in once and goes inactive. No "inactive for 7 days" signal.
- C-096 ❌ Inactive-for-30-days auto-lock. None.
- C-097 ❌ Learner's login history. Not stored.
- C-098 ❌ Time-to-first-pass metric for onboarding quality. Not computed.
- C-099 ❌ Time-to-productivity metric. Not computed.
- C-100 ❌ Compare cohorts (Jan hires vs Feb hires). Not computed.
