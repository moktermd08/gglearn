# A. Company setup, goals and time (A-001 to A-100)

✅ works today · ⚠️ partial/manual · ❌ gap. Statuses come from reading the code, not from running each case.

## Creating the company
- A-001 ⚠️ A new company arrives with no companies/brands/projects rows. Only `scripts/seed-structure.ts` creates them; no admin UI. Fix: "New company" wizard.
- A-002 ❌ Two companies pick the same slug. Slugs are unique, so the second fails with a raw DB error, not a friendly message.
- A-003 ❌ Company name changes after launch (rebrand). No rename UI; slug stays old.
- A-004 ❌ Company has no brands, only a website. Tracks require a brand, so one must be invented.
- A-005 ⚠️ Company owns three brands with different voices. Brands exist, but "brand voice" is not a first-class field.
- A-006 ❌ Company is a single freelancer. Works only via a `personal` brand; no solo-company template.
- A-007 ❌ Company operates in two countries with different compliance rules. No region on scope.
- A-008 ❌ Two unrelated companies share one gglearn install. Managers are not scoped to a company, so they would see each other's people. Real multi-tenant gap.
- A-009 ❌ Company wants its own domain/white-label. Single hostname, single theme.
- A-010 ❌ Company wants its own admins who cannot see other companies. Roles are global: admin, manager, learner.
- A-011 ❌ Company imports its employees from a CSV. No bulk import; one invite per person.
- A-012 ❌ Company imports from Google Workspace/Microsoft 365/HR system. No SSO or directory sync.
- A-013 ❌ Company deletes itself (churn). No company deletion or export.
- A-014 ❌ Company merges with another. No merge of companies, brands or people.
- A-015 ❌ Company splits a brand into two. Tracks cannot be moved between brands in the UI.
- A-016 ⚠️ A project is moved from one brand to another. Row can be edited in DB; scopes keep pointing at the id, so learners keep access, but nothing re-syncs.
- A-017 ❌ Company wants a free trial period. No billing or plan concept.
- A-018 ❌ Company wants to cap seats. No seat limit; any manager can invite unlimited.
- A-019 ⚠️ Company is in a sandbox/demo mode. `seed-demo-user.ts` exists; no demo flag that blocks real invites.
- A-020 ❌ Company wants to start from an industry template (agency, SaaS, retail). No templates.

## Goals
- A-021 ⚠️ Company goal "everyone passes security basics in 30 days". Achieved by a mandatory track + `dueDays`, set by admin per track, but global to all companies.
- A-022 ❌ Goal expressed in business terms ("raise lead conversion 10%"). No goal object linking outcomes to tracks.
- A-023 ❌ Goal for a team rather than the company. No Team.
- A-024 ❌ Goal for a role (all sales reach lead-gen level 8). Only per-track policy; per-role goal not modelled.
- A-025 ❌ Goal with a fixed calendar date ("by 31 March"). Deadlines are `dueDays` from enrolment, not absolute dates.
- A-026 ❌ Two goals conflict (finish product training vs finish security training in the same week). No load balancing or ordering.
- A-027 ❌ Goal is revised mid-way. Changing `requiredLevel` applies to all, no history of the old goal.
- A-028 ⚠️ Goal level raised from 5 to 8: people who were "done" become not done. Allowed and immediate, but unannounced.
- A-029 ⚠️ Goal level lowered: people are suddenly done; overdue vanishes. No record that it happened.
- A-030 ❌ Goal progress over time (trend line). Only a current snapshot in compliance.
- A-031 ❌ Goal owner. Nobody is recorded as accountable for a goal.
- A-032 ❌ Goal has a budget (hours per week allowed). No time-budget concept.
- A-033 ❌ Goal for customers (80% activate product in 14 days). Customer tracks are mandatory but have no goal metric.
- A-034 ❌ Different goals for new hires vs existing staff. Same policy applies to both.
- A-035 ❌ Goal for a contractor with a 3-month contract. No contract end date on a user.

## Time
- A-036 ⚠️ Default 30-day deadline per track; admin can set 1-365. Clamped by validation.
- A-037 ⚠️ A person gets 18 required tracks all due in 30 days. No staggering; all share one start.
- A-038 ❌ Deadline should pause during leave. No pause.
- A-039 ❌ Deadline should exclude weekends/holidays. Calendar days only.
- A-040 ❌ Staff in different timezones; quests use UTC days, so "today" flips at odd hours for some.
- A-041 ❌ Company working hours for learning (e.g. Friday 2-4pm). No protected-time scheduling.
- A-042 ⚠️ Daily quests exist (study, drill, exam) for streaks, but are not tied to company time budgets.
- A-043 ❌ Calendar invite for learning blocks. No calendar integration.
- A-044 ✅ Server-side session lifetime is 30 days regardless of cookie settings.
- A-045 ❌ Deadline extension for one person with a reason. Only global dueDays; no per-person extension.
- A-046 ❌ Grace period before "overdue" turns red. None.
- A-047 ⚠️ Enrolment date is the clock start. If a track is enrolled late, deadline is late too, which hides slow admin work.
- A-048 ❌ Quarter/half-year learning cycles. No recurring cycle.
- A-049 ❌ Annual refresher (compliance re-certification). Once passed, always passed.
- A-050 ❌ Learning time actually spent per person. Runs have start/finish times but time is not rolled up.

## Roles, access and admin experience
- A-051 ✅ Roles: admin, manager, learner. Managers can open admin pages; learners are redirected to dashboard.
- A-052 ✅ A manager cannot offboard another manager/admin; only admin can.
- A-053 ✅ Nobody can promote themselves; nobody can offboard themselves.
- A-054 ⚠️ Only the first admin exists from seed. No UI to make someone a manager/admin; needs DB.
- A-055 ❌ Last admin leaves/offboarded. Nothing prevents the only admin from being offboarded by another admin (there is none), but a second admin could remove them leaving zero.
- A-056 ❌ Admin forgets password. No reset flow.
- A-057 ❌ Ownership transfer of the company account. None.
- A-058 ❌ Delegated admin for one brand only. None.
- A-059 ❌ Read-only auditor role. None.
- A-060 ❌ HR role that can see onboarding/offboarding but not scores. None.
- A-061 ⚠️ Admin sees a track list at `/admin/paths`, but cannot create a track there; tracks come from import scripts.
- A-062 ❌ Create a new track from the UI. None; scripts only.
- A-063 ❌ Clone a track for another brand. None.
- A-064 ❌ Archive a track. Questions can be retired; track hiding is code-based (`hiddenTrackIds`).
- A-065 ❌ Rename a track. No UI.
- A-066 ❌ Track ownership (who maintains Moksy brand content). None.
- A-067 ⚠️ Review queue for AI-written questions exists at `/admin/review/<slug>`, admin approves all at once; no partial approve by reviewer.
- A-068 ❌ Two reviewers sign off. Single admin approval.
- A-069 ❌ Reject with comment and send back. Can retire, not comment.
- A-070 ❌ Review SLA reminders. None.

## First-day setup flow (what an admin must do today)
- A-071 ⚠️ Step order for a new company: seed structure → import knowledge → generate questions → approve → set policy → invite. Six steps across CLI and UI; no checklist guiding them.
- A-072 ❌ Setup progress indicator for the admin ("3 of 8 steps done"). None.
- A-073 ❌ Admin sets goal + date in one screen and sees projected completion. None.
- A-074 ❌ Warning when a role has people but no required tracks (social media manager today). None.
- A-075 ⚠️ `/admin/compliance` lists required tracks that have too few questions to be enforced; no warning in `/admin/paths` or at invite time.
- A-076 ❌ Warning when a scope has no tracks. None.
- A-077 ❌ Dry-run: "if I invite a sales person to Guru Graphics, what will they be required to do?" None; admin must invite and look.
- A-078 ❌ Preview a new hire's dashboard. None.
- A-079 ❌ Copy settings from an existing similar person ("same as Sam"). None.
- A-080 ❌ Saved onboarding templates per role. Checklist text is hard-coded in `app/actions.ts`.
- A-081 ❌ Edit the onboarding checklist text per company. Hard-coded.
- A-082 ❌ Add due dates to checklist items. None.
- A-083 ❌ Assign checklist items to different owners (IT, manager, HR). None; managers tick everything.
- A-084 ❌ Checklist item that unlocks automatically when a track is passed ("Pass level 3"). Manual tick.
- A-085 ❌ Checklist item with evidence upload. None.
- A-086 ⚠️ Customer onboarding checklist differs from staff (3 items). Good, but not editable.
- A-087 ❌ Contractor-specific checklist. Only staff or customer.
- A-088 ❌ Partner/reseller audience. Only staff or customer.
- A-089 ❌ Volunteer or intern with a limited scope. Handled only as staff with narrow scope.
- A-090 ❌ Trial learners (prospective hires) with limited access. None.
- A-091 ✅ Passwords stored hashed with rehash on login when parameters are weaker.
- A-092 ✅ Invite tokens stored only as a SHA-256 hash; shown once.
- A-093 ⚠️ Session secret missing at boot: `SESSION_SECRET must be set` is thrown at first use, not at startup.
- A-094 ⚠️ `ANTHROPIC_API_KEY` missing: open answers fall back to keyword grading, which can mis-score fairly.
- A-095 ⚠️ SQLite for production; README says move to Postgres before multi-user scale.
- A-096 ⚠️ Rate limiting is in-process memory; restart clears it, and multiple PM2 instances would not share it.
- A-097 ❌ Backups of `data/gglearn.db`. Not in deploy script.
- A-098 ❌ Staging vs production environments for content changes. Single DB.
- A-099 ❌ Seed re-run overwriting admin policy: `policySource = admin` protects policy, but other seeded fields can still change.
- A-100 ❌ Company wants to export all its data. None.
