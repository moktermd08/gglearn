# F. While in the company: careers, promotion, role changes (F-001 to F-100)

## Ladder mechanics (from `lib/careers.ts`, `promote` in `app/actions.ts`)
- F-001 ✅ A person's level = latest promotion for their role, or the ladder's first level.
- F-002 ✅ Promotion requires every *countable* step of the next level met and no overdue required learning.
- F-003 ✅ Only an admin may override, and a note is mandatory; recorded with `overridden = 1`.
- F-004 ✅ Nobody can promote themselves.
- F-005 ✅ Offboarded people cannot be promoted.
- F-006 ✅ A step whose track questions don't reach the needed level is "coming soon" and never blocks.
- F-007 ⚠️ If every step of the next level is uncountable, the person is held at "nothing-to-measure"; managers can't promote without admin override.
- F-008 ✅ Max 10 levels per role ladder; level 1 has no steps.
- F-009 ✅ Customers have no career.
- F-010 ⚠️ Ladders exist only for developer, designer, sales, manager. Everyone else sees nothing.
- F-011 ❌ Create a ladder for a new role from scratch: `addCareerLevel` starts one, but with no steps until an admin adds them track by track.
- F-012 ❌ Copy a ladder from another role. None.
- F-013 ❌ Branches (developer → support developer or architect). Single linear ladder per role.
- F-014 ❌ Lateral move without demotion. A change of `jobRole` has no UI.
- F-015 ❌ Promotion also changes `jobRole` (Developer → Lead Developer is the same role key; fine), but Developer → Manager needs a role change and a new ladder.
- F-016 ❌ Salary band linked to the level. None.
- F-017 ❌ Promotion requires non-learning evidence (shipped X). Learning steps only.
- F-018 ❌ Peer feedback / 360. None.
- F-019 ❌ Manager review notes stored per person. Only the promotion note.
- F-020 ❌ Demotion or level correction. No action; promotions only increase (latest row wins, so a lower level can be inserted via DB).

## Edge cases at promotion time
- F-021 ⚠️ Person meets all steps on Friday; overdue elsewhere appears on Monday; ready flips to held.
- F-022 ⚠️ Admin raises a step's required level after a person qualified. They lose "ready".
- F-023 ⚠️ Admin removes a step; others become ready en masse. No notification.
- F-024 ⚠️ Track retired or hidden (superseded by a Titan track): `ladderFor` uses the catalog, which hides superseded tracks, so the step disappears.
- F-025 ✅ Step disappears quietly rather than erroring.
- F-026 ❌ Warn admins when a ladder step references a hidden track. None.
- F-027 ❌ Two people promoted on the same click by two managers: second insert duplicates the same level.
- F-028 ❌ Backdating a promotion. `createdAt` is now.
- F-029 ❌ Promotion effective date in the future. None.
- F-030 ❌ Promotion announcement. None.
- F-031 ✅ Dashboard shows the next level and open steps (`openSteps`).
- F-032 ❌ Estimated promotion date from current pace. None.
- F-033 ❌ Team-wide readiness view ("who is promotable this quarter"). `/admin/careers` lists per person.
- F-034 ❌ Promotion cycle windows (April and October only). None.
- F-035 ❌ Budget-limited promotions. None.

## Role changes (the hard part)
- F-036 ❌ Change a person's `jobRole`. No UI/action; DB edit only.
- F-037 ⚠️ If `jobRole` is changed in the DB, promotions for the old role stay; new role starts at ladder level 1.
- F-038 ❌ Carry over credit between roles (junior dev → support dev) beyond passed tracks. Passed tracks carry; promotion level does not.
- F-039 ❌ Dual role (developer + support) simultaneous ladders. Single.
- F-040 ❌ Acting-up allowance (temporarily lead). None.
- F-041 ❌ Role requires a licence/certification renewed yearly. None.
- F-042 ❌ Re-onboarding on role change (new checklist). Checklist created at joining only.
- F-043 ❌ Re-run the required path after a role change automatically. Only `updateScopes` triggers sync; role edits via DB would sync at next login.
- F-044 ❌ Handover when changing role (notes for the old job). Handovers exist only for offboarding.
- F-045 ❌ Old role's mandatory content still counted overdue. Role-tier requirements vanish with the role.

## The five example people
- F-046 ❌ **Social media manager**: no ladder; manual process only.
- F-047 ⚠️ **Junior full-stack → support full-stack for GGLink**: ladder gets them to Developer level 2 on generic tracks; GGLink-specific support skills have no questions.
- F-048 ⚠️ **Sales team of 4 for Guru Graphics**: Sales Associate → Executive steps use product tracks, not lead gen.
- F-049 ❌ **Individual learner** (Facebook marketing): no ladder, no employment.
- F-050 ❌ **Brand-update currency**: not a career concept at all.

## Manager's view
- F-051 ✅ `/admin/careers` shows readiness and lets managers promote or admins override.
- F-052 ❌ Managers see only their team. They see everyone.
- F-053 ❌ Skills matrix (people × skills). None.
- F-054 ❌ Succession planning. None.
- F-055 ❌ Training needs analysis for the team (top 5 weak topics). Question flags exist only per question.
- F-056 ❌ Heatmap of weak topics by team. Not available.
- F-057 ❌ Time-to-promotion statistics. None.
- F-058 ❌ Learning budget requests. None.
- F-059 ❌ External course approvals. None.
- F-060 ❌ Mentoring assignments. None.

## Employee types
- F-061 ❌ Part-time ladders. None.
- F-062 ❌ Contractors with no promotion path. Role exists; ladder is optional, so `careerFor` returns null if no ladder; OK.
- F-063 ❌ People returning from parental leave. Deadlines continue unless extended in the DB.
- F-064 ❌ Long-term sick leave. Same.
- F-065 ❌ Sabbatical. Same.
- F-066 ❌ Secondment to another company in the group. Scope changes are possible.
- F-067 ❌ Dual employment across two group companies. Union of scopes.
- F-068 ❌ Intern → full-time conversion (keeps history). Same account, role change needed.
- F-069 ❌ Founder doubles as admin and learner. Works.
- F-070 ❌ Admin who is also a learner can't promote themselves; needs another admin.

## Data integrity around careers
- F-071 ✅ Unique index on (jobRole, level) and (careerLevelId, trackId).
- F-072 ⚠️ Adding a step upserts the required level; duplicates not possible.
- F-073 ✅ Adding a step to level 1 is refused.
- F-074 ❌ Delete a career level. Not supported; titles can be edited only.
- F-075 ❌ Reorder levels. Not supported.
- F-076 ❌ Archive an old ladder version while keeping history. None.
- F-077 ❌ Ladder versions by effective date. None.
- F-078 ⚠️ Role keys are lower-cased; `Sales` and `sales` unify. Spaces or hyphens differ (`social-media-manager` vs `social media manager`).
- F-079 ⚠️ Role text typo (`develper`): no ladder, no role tracks, silently empty.
- F-080 ❌ Admin UI shows "roles in use" with a count and ladder coverage. Only roles with ladders list.

## Recognition and retention
- F-081 ❌ Public leaderboard of promoted people. None.
- F-082 ❌ Rewards/bonus tied to certification. Competition prizes are recorded not paid (`prizePaidAt`).
- F-083 ✅ Competitions may carry a cash prize; gglearn never holds money, organiser pays and records it.
- F-084 ❌ Tax/payroll handling of prizes. Out of scope.
- F-085 ❌ Skill gaps feeding hiring plans. None.
- F-086 ❌ Alumni network after leaving. None.
- F-087 ❌ Exit interview data link. None.
- F-088 ❌ Retention risk (low engagement) alerts. None.
- F-089 ❌ Engagement survey. None.
- F-090 ❌ Burnout (too many hours of study). None.

## Small but real
- F-091 ✅ Promotion note is limited to 1000 characters.
- F-092 ✅ Level titles ≤ 80 chars, summaries ≤ 300 chars.
- F-093 ⚠️ A ladder step requires a track that has 1,000+ questions but only 8 in level 8: countable depends on `reach`, which is level continuity, not volume.
- F-094 ❌ Minimum number of questions per level for a "countable" step (e.g. ≥ 20). `reach` just needs ≥ 1 per level.
- F-095 ❌ Warn when a required level has fewer questions than a run draws (10). Runs just draw fewer.
- F-096 ❌ Question exposure control (same few questions asked all the time). Dynamic mitigates; stored don't.
- F-097 ❌ Required-level pass based on one attempt. A single 80% counts.
- F-098 ❌ Require two passes on different days. None.
- F-099 ❌ Retain level passed if content changes. `levelsPassed` reads runs, so content updates never revoke.
- F-100 ❌ Promotion record export. None.
