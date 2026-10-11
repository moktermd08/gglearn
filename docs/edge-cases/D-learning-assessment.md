# D. Learning and assessment while in the company (D-001 to D-100)

## Choosing and starting a track
- D-001 ✅ Anyone signed in can enrol in a track open to their audience (`enroll`); customers cannot enrol in staff-only tracks.
- D-002 ⚠️ Staff can enrol in any staff/both track, even outside their scope, via direct URL or the picker. Scope drives *required* learning, not *permission*.
- D-003 ✅ Enrolling twice only updates the goal text.
- D-004 ❌ Goal is free text, not a measurable target with a date.
- D-005 ❌ Unenrol from a track. No action.
- D-006 ❌ Pause a track. None.
- D-007 ⚠️ Track with 0 questions can be opened, but start returns nothing (`if (!picked.length) return`) with no message.
- D-008 ✅ Levels unlock in order: starting level N needs N-1 passed (or placed).
- D-009 ✅ An unfinished run for a level is reused rather than creating duplicates.
- D-010 ✅ Each run draws 10 questions, 7 generated where the track has generators.
- D-011 ⚠️ A track whose questions skip level 7 stops at level 6 for "reach" purposes; learner can't proceed with no explanation.
- D-012 ❌ Pick Claude vs ChatGPT by trying a taster level of each. Placement does this but costs a full quiz per track.
- D-013 ❌ Compare two tracks' progress side-by-side. None.
- D-014 ❌ "Recommended next track" based on gaps. Only role matches.
- D-015 ❌ Search tracks by skill ("Facebook ads"). Browse lists only; no search found in the code read.
- D-016 ❌ Tracks tagged by tool version (GPT-5 vs GPT-4). No versioning.
- D-017 ❌ Prerequisite warnings ("do Prompting before Agents"). None.
- D-018 ❌ Learning path object (ordered tracks + target date). None.
- D-019 ❌ Personal goal date with a daily-minutes calculator. None.
- D-020 ❌ "How many hours to Level 10?" estimate. None.

## Placement
- D-021 ✅ Placement uses a search over levels 0-15 with a `pending` batch; round and bounds stored on `journeys`.
- D-022 ✅ Placement only ever raises `placedLevel`.
- D-023 ⚠️ Placement taken on a track with few questions per level yields a noisy level.
- D-024 ❌ Retake placement after a long break. Only raises; cannot lower after skills decay.
- D-025 ❌ Detect guessing in placement. None.
- D-026 ✅ Skipping placement is allowed.
- D-027 ✅ Placement counts toward required learning: `levelsPassed` takes the higher of the best passed run and `placedLevel`.
- D-028 ❌ Placement accidentally refreshed mid-way. State is in DB so progress survives; the URL carries the slug.
- D-029 ❌ Two tabs on one placement. Second submit can conflict with `round`.
- D-030 ❌ Placement for customer onboarding. Customer tracks are empty.

## Taking an exam
- D-031 ✅ Submit is guarded against double-click re-grading with an in-process lock.
- D-032 ⚠️ The lock is per process; two PM2 workers would not share it, but the `finishedAt is null` update guard still prevents double scoring.
- D-033 ⚠️ Browser closed mid-run: run stays open and can be resumed.
- D-034 ❌ Auto-save answers as you go. Answers are only sent on submit; closing loses typed text.
- D-035 ⚠️ Answer longer than 4000 chars is truncated silently.
- D-036 ⚠️ Open answer is empty: scored 0 for that question.
- D-037 ❌ Per-question timers enforced server-side. `timeSec` is data, not enforcement.
- D-038 ❌ Whole-exam time limit. None.
- D-039 ✅ A run page and submit both check the run belongs to the signed-in user (404 otherwise).
- D-040 ✅ Scores are server-computed; the client cannot send a score.
- D-041 ✅ MCQ answers compared by option key.
- D-042 ⚠️ Without `ANTHROPIC_API_KEY`, open answers use keyword fallback: confidently wrong scores.
- D-043 ⚠️ API outage during grading: behaviour depends on `lib/grading.ts` fallback; learner sees a score from the weaker grader without being told.
- D-044 ❌ Mark an exam as "graded by fallback; will be re-graded". None.
- D-045 ❌ Cost control for Claude grading when 1,000 people submit at once. No queue or budget cap.
- D-046 ✅ Pass mark is 80% (`PASS_MARK`).
- D-047 ❌ Different pass mark for safety-critical tracks (95%). Global.
- D-048 ❌ Pass requires all "critical" questions correct. No criticality flag beyond `weight`.
- D-049 ❌ Show correct answers after fail. Review page exists at `/run/<id>`; hiding answers to prevent sharing is not configurable.
- D-050 ❌ Cooldown between attempts. None.

## Content quality
- D-051 ✅ AI-written questions land as `review` and are invisible until approved.
- D-052 ✅ A second blind pass audits each AI answer key during generation.
- D-053 ⚠️ A subtle factual error survives both passes. Admin review is the only human check, as one bulk "activate".
- D-054 ❌ Subject-matter-expert sign-off per question. None.
- D-055 ❌ Source citation shown with each question. Not exposed.
- D-056 ❌ Learner can flag "this is outdated". None.
- D-057 ✅ Questions failed nearly always or never failed are flagged to admins.
- D-058 ❌ Difficulty recalibration from real pass rates. Flags only, no auto-move between levels.
- D-059 ❌ Duplicate questions across tracks. Dedupe is per track+level+prompt.
- D-060 ⚠️ Dynamic questions are checked by `npm run check:dynamic`; some families only structurally.
- D-061 ❌ Plagiarised or copyrighted legacy questions (TrialTest/SkillsTest import). Provenance recorded in `source`, no licence check.
- D-062 ❌ Localisation of questions. English only.
- D-063 ❌ Image-based questions (design, social posts). `code` and text only; no image field.
- D-064 ❌ Practical tasks (write a Facebook ad, upload a screenshot). Types are mcq/open/scenario only.
- D-065 ❌ Peer review of open answers. None.
- D-066 ❌ Manager review of a scenario answer. None.
- D-067 ❌ Live practical assessment (role play a sales call). None.
- D-068 ❌ Assessment of AI-agent use (did the person prompt well?). Scenario Qs approximate.
- D-069 ❌ On-the-job evidence (shipped a post) counted toward a level. None.
- D-070 ❌ External course certificate imported. None.

## Drill, study guide, spaced repetition
- D-071 ✅ Study guide shows the syllabus and flip cards from that level's questions.
- D-072 ✅ Drill: 5 instant-feedback questions.
- D-073 ❌ Spaced repetition: resurface what you got wrong a week later. None.
- D-074 ❌ Knowledge decay: a pass from 18 months ago equals a pass from yesterday.
- D-075 ❌ Quick daily "micro-quiz" delivered by email/Slack. None.
- D-076 ❌ Offline use. None.
- D-077 ❌ Mobile app. Responsive web only.
- D-078 ❌ Audio/video lessons. None.
- D-079 ❌ Learner notes. None.
- D-080 ❌ Bookmarks. None.

## Progress, XP and rivals
- D-081 ✅ XP and levels are derived; rival XP is deterministic per subject and day.
- D-082 ⚠️ A rival is fake. A learner may feel cheated if they discover it; it's labelled as a rival, not as a colleague.
- D-083 ✅ Rank emblems: Initiate, Adept, Expert, Master, Titan.
- D-084 ❌ Streak freeze for holidays. None.
- D-085 ❌ Daily quests earned twice via two tabs. Unique index per user/track/day/kind prevents it.
- D-086 ✅ Certificate for a level is unique per user/track/level.
- D-087 ❌ Certificate expiry. Never expires.
- D-088 ❌ Certificate revoked when someone is offboarded or cheats. No revoke; `/cert/<code>` remains valid.
- D-089 ❌ Certificate shows the company's name. Tied to track only.
- D-090 ❌ LinkedIn add-to-profile button. None.

## Bad-day situations
- D-091 ❌ Learner's connection drops after submit; the redirect to results fails. Refresh shows the finished run; safe.
- D-092 ❌ Learner submits while another tab submits the same run: `finishedAt` guard.
- D-093 ❌ Question deleted after being drawn into a run. Questions are retired not deleted; the draw still shows it.
- D-094 ❌ Question edited (answer key changed) mid-run. Version bump isn't tied to existing runs.
- D-095 ❌ Question has two correct options due to authoring error; all choose differently. Flag only after volume.
- D-096 ❌ Track renamed during someone's run. Safe; ids are used.
- D-097 ❌ Timezone: a quest at 23:59 UTC counted for the wrong day for a local learner. UTC days.
- D-098 ❌ Daylight savings. UTC unaffected.
- D-099 ❌ Server clock wrong. Session and invites would misbehave.
- D-100 ❌ Learner finds questions online / shares answers. Dynamic generation mitigates but stored questions can leak.
