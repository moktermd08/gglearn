# E. Required paths, scopes and compliance (E-001 to E-100)

## How the engine decides (read from `lib/paths.ts`)
Required = tracks with `reach >= requiredLevel` and in scope for the person's audience, and either `tier=mandatory` or (`tier=role`, staff, roles empty or includes `jobRole` exactly, lower-cased).

## Scope rules
- E-001 ✅ Company scope implies all of that company's brands for staff.
- E-002 ✅ Shared-brand tracks (Foundations, Titan, Software Lifecycle) apply to all staff.
- E-003 ✅ Project-scope tracks need the explicit project scope.
- E-004 ✅ Customers never inherit a company's brands; they need brand/project scope.
- E-005 ✅ `inScope` blocks customers from staff-only tracks.
- E-006 ⚠️ Person in two companies gets the union of both companies' required tracks, with no cap or prioritisation.
- E-007 ⚠️ Person moves from Company A to B: new scopes add tracks, old enrolments remain and can still be overdue.
- E-008 ❌ Removing a scope does not un-enrol or hide old tracks (syncRequired only adds).
- E-009 ❌ Overdue on a track that is no longer in scope still shows as overdue? The requirement list is computed from scope, so it vanishes from the dashboard but the enrolment stays.
- E-010 ✅ Scope ids that disappear (deleted brand) show as "brand 7" in labels.
- E-011 ❌ Deleting a brand with tracks. No FK cascade logic; would orphan tracks.
- E-012 ❌ Project belongs to both a brand and a company. Both columns exist; precedence unclear.
- E-013 ⚠️ A project with no brand and no company is a shared product (GGSocial etc.): only people with explicit project scope are required.
- E-014 ❌ Everyone at the company should get the shared product automatically. They don't unless scoped.
- E-015 ❌ Scope by department/team. Only company/brand/project.
- E-016 ❌ Scope by location/country. None.
- E-017 ❌ Scope by seniority. Only job role + career level.
- E-018 ❌ Scope by customer plan/tier (free vs enterprise customer). None.
- E-019 ✅ Customer + brand scope gets customer-start tracks, but they are 0-question and so never required.
- E-020 ⚠️ A customer track becomes mandatory the moment an admin approves its questions, and all in-scope customers are enrolled with a 30-day due date retroactively counted from that day.

## Roles and tier
- E-021 ✅ `role` tier matches `jobRole` exactly after lowercasing; `developer` ≠ `full stack developer`.
- E-022 ❌ "Junior full stack developer" gets no developer role tracks unless their role string is exactly `developer`.
- E-023 ❌ Two roles on one person. Not supported.
- E-024 ❌ Role aliases (dev, engineer, software engineer). None.
- E-025 ❌ Role-specific level (juniors level 5, seniors level 10) on the same track. One `requiredLevel`.
- E-026 ❌ Role hierarchy (lead inherits developer tracks). Matching is exact.
- E-027 ✅ Mandatory ignores role.
- E-028 ✅ Growth tier never required; feeds promotion only.
- E-029 ⚠️ Changing a track from growth to role immediately enrols everyone matching.
- E-030 ❌ Warn admin how many people a policy change will affect before saving. None.
- E-031 ❌ Policy change history (who changed what, when). `policySource` only.
- E-032 ❌ Staged rollout of a new mandatory track (pilot 5 people). None.
- E-033 ❌ Effective-from date on a new policy. Immediate.
- E-034 ✅ Admin-only policy edits.
- E-035 ❌ Manager proposes a policy, admin approves. None.

## Enrolment sync timing
- E-036 ✅ Syncs at joining, on login, on scope change, on policy change, on question approval.
- E-037 ⚠️ A person who never logs in is not synced until an admin action triggers `syncEveryone`.
- E-038 ✅ Offboarded users are excluded from sync.
- E-039 ⚠️ `syncEveryone` loops all users synchronously; slow at thousands of users on SQLite.
- E-040 ❌ Sync on a schedule (nightly). None.
- E-041 ⚠️ The deadline starts at first enrolment, even if the person did not see it (admin approved questions at midnight).
- E-042 ❌ Tell the person their new deadline. No notification.
- E-043 ✅ Re-enrolment keeps the original start date (onConflictDoNothing).
- E-044 ❌ Restart the clock after a major update. None.
- E-045 ❌ Staff with active enrolment but 0 passed after 90 days flagged. Overdue only.

## Compliance view
- E-046 ✅ `/admin/compliance` lists each active person with state: no-scope, none, ok, due, overdue.
- E-047 ✅ "no-scope" distinguishes forgotten scope assignments from "none required".
- E-048 ⚠️ State "none" for the social media manager hides that nothing is defined for them. Looks the same as "fully compliant".
- E-049 ❌ Filter by company/brand/team/role. List only.
- E-050 ❌ Export compliance as CSV for auditors. None.
- E-051 ❌ Email overdue people automatically. None.
- E-052 ❌ Escalate to managers after N days overdue. None.
- E-053 ❌ Compliance trend chart. Snapshot.
- E-054 ❌ Per-track completion rate across the company. Only per person.
- E-055 ❌ "Who is current on the new brand version?" None (see G).
- E-056 ❌ Compliance for customers (onboarded vs not). Customer rows appear but with no goals.
- E-057 ❌ Compliance for a competition cohort. Contest page only.
- E-058 ❌ Compliance score for the whole company (a single number). None.
- E-059 ❌ Sign-off statement ("As of 1 Nov, 97% completed"). None.
- E-060 ❌ Legal evidence pack per person (what they passed, when, version of content). Run history exists, versions of content do not.

## Edge in the numbers
- E-061 ✅ `done` = levelsPassed ≥ `requiredLevel`; placement counts.
- E-062 ⚠️ Raising `requiredLevel` beyond the track's `reach` removes the requirement silently.
- E-063 ⚠️ Retiring many questions drops `reach` and removes the requirement for everyone; overdue goes away.
- E-064 ⚠️ Approving questions can instantly create 400 overdue-in-30-days items for large companies.
- E-065 ❌ Pass level 5 of 20 means "knows the basics" for any track, no matter how critical.
- E-066 ✅ Overdue is `now > assignedAt + dueDays`.
- E-067 ❌ Overdue counted in business days. Calendar days.
- E-068 ❌ Different grace per tier. None.
- E-069 ❌ Count only tracks in the person's first 90 days. All.
- E-070 ❌ Mandatory tracks for managers only. Mandatory is for everyone in scope.

## Scale and performance
- E-071 ⚠️ `catalog()` loads all tracks and question counts on every call; fine at 132 tracks, slower with thousands.
- E-072 ⚠️ `complianceReport` computes `requirementsFor` per person; each calls `levelsPassed`, many queries. N+1 risk at 500+ people.
- E-073 ❌ Caching. None.
- E-074 ❌ Pagination on `/admin/compliance`. None.
- E-075 ❌ 10,000-question tracks (api-claude-titan 2,400) in review page: loads all? Probably paginated; unverified.
- E-076 ✅ SQLite WAL mode files exist (`-wal`, `-shm`), good for read concurrency.
- E-077 ❌ Writes from 200 concurrent submitters on SQLite. Lock contention likely.
- E-078 ❌ Job queue for grading. Inline.
- E-079 ❌ Metrics/health endpoint. None noted.
- E-080 ❌ Error reporting (Sentry). None.

## Policy conflicts
- E-081 ⚠️ Same track tagged `tier=role` for developers and mandatory for contractors: only one tier per track.
- E-082 ❌ Different deadlines per scope for the same track. One `dueDays`.
- E-083 ❌ Different levels per company for a shared track. One `requiredLevel`.
- E-084 ❌ Two companies disagree on a shared track's policy. Admin-wide.
- E-085 ❌ Staff vs contractor policy. None.
- E-086 ❌ New regulation introduces a mandatory track due in 7 days for all. Possible by admin setting `dueDays=7`, but then all existing assignments move too, since `dueAt` is computed live from `dueDays`.
- E-087 ⚠️ Changing `dueDays` retroactively changes everyone's deadline, including already-overdue people becoming un-overdue.
- E-088 ❌ Exempt a person (maternity leave) from a mandatory track. None.
- E-089 ❌ Mark a requirement "not applicable" with approver. None.
- E-090 ❌ Delegate: someone else completes on my behalf. Not allowed; no mechanism either.

## Customers and compliance
- E-091 ⚠️ Customer mandatory tracks have `dueDays=30`; a customer who bought yesterday and ignores it appears overdue in a month.
- E-092 ❌ Customer is a paying account with 5 users; the account's adoption score. No account concept.
- E-093 ❌ Customer success team sees customers needing help. They'd use compliance, mixed with staff.
- E-094 ❌ Customer churns; access ends. Offboard only.
- E-095 ❌ Customer data deletion request. None.
- E-096 ❌ Customer sees only their company's colleagues on leaderboards. Contests invite-based; fine.
- E-097 ❌ Customer-specific branding in the learning UI. None.
- E-098 ❌ Customer certificate for completing onboarding. Per track.
- E-099 ❌ Customer cannot see internal job-role ladders. `careerFor` returns null for non-staff.
- E-100 ✅ Careers do not apply to customers.
