# J. Security, privacy, operations and odd corners (J-001 to J-100)

## Authentication and sessions (read from `lib/auth.ts`, `app/actions.ts`)
- J-001 ✅ Session = userId.issuedAt.sessionVersion.HMAC; compared with `timingSafeEqual`.
- J-002 ✅ 30-day lifetime enforced server-side; cookie age is only a hint.
- J-003 ✅ Future-dated `iat` rejected.
- J-004 ✅ Offboarded, or version-mismatched, users are signed out on the next request.
- J-005 ✅ Login timing equalised for unknown/offboarded emails.
- J-006 ✅ Login errors are identical for wrong password and unknown email.
- J-007 ⚠️ Rate limiter is in-memory per process.
- J-008 ⚠️ `clientIp()` trusts proxy headers set by Apache; if misconfigured, everyone shares one bucket or an attacker spoofs IPs.
- J-009 ❌ CSRF tokens. Next.js server actions have built-in origin checks; custom assumptions unverified.
- J-010 ❌ Session rotation at privilege changes (manager promoted). Version unchanged.
- J-011 ❌ Admin actions require re-authentication. None.
- J-012 ❌ MFA for admins. None.
- J-013 ❌ Password reset (documented gap).
- J-014 ❌ Account lockout notification. None.
- J-015 ❌ Suspicious-login alert. None.
- J-016 ✅ `docs/security/auth-review.md` exists with a review record.
- J-017 ❌ Penetration test. None.
- J-018 ❌ Dependency scanning in CI. Not seen in the deploy workflow.
- J-019 ❌ Secrets in the repo. `.env.example` pattern used; DB under `data/` should be gitignored (verify).
- J-020 ❌ Backup encryption. None.

## Authorisation
- J-021 ✅ `requireManager` guards admin pages and actions; `updateTrackPolicy` additionally requires admin.
- J-022 ✅ `promote` and offboard enforce extra rules inside the action, not just on the page.
- J-023 ⚠️ `toggleChecklist` fetches `me` and then ignores it (`void me`): any manager can tick any person's item, including their own.
- J-024 ⚠️ Managers can view every person, across companies (no tenancy).
- J-025 ⚠️ Manager can issue invites to any scope, including companies they don't belong to.
- J-026 ⚠️ Manager can grant `staff` audience to anyone, exposing all staff-only content.
- J-027 ❌ Prevent a manager from inviting someone at a higher privilege. Invites always create learners, which is safe.
- J-028 ❌ Role escalation path to admin is DB-only. Safe but manual.
- J-029 ✅ Learners are redirected from admin pages.
- J-030 ✅ Customers cannot reach staff-only tracks via enrolment or contests.
- J-031 ⚠️ Direct URL access to `/tracks/<slug>` for a staff-only track by a customer: README says enforced at the track page; worth a test.
- J-032 ❌ Authorisation tests in CI. Not seen.
- J-033 ❌ IDOR: `startRun` checks enrolment; `submitRun` checks ownership; `markStudied`/`drillCheck` check enrolment. Good, but `drillCheck(questionId)` may reveal answers for any question id to any signed-in user (verify).
- J-034 ❌ Rate limit on drills. None, enabling answer harvesting for stored questions.
- J-035 ❌ Rate limit on exams per day. None.
- J-036 ✅ Avatar route `/api/avatar/<id>` is a read of an optional photo; whether it is public is a privacy choice to confirm.
- J-037 ❌ Image upload validation (type, size, malware). `lib/image.ts` exists; limits unverified.
- J-038 ❌ XSS in names/titles. React escapes by default; any `dangerouslySetInnerHTML` use unverified.
- J-039 ❌ Markdown/HTML in knowledge items rendered unsafely. Unverified.
- J-040 ❌ SQL injection. Drizzle parameterises; raw `sql` fragments are static in the code read.

## Privacy
- J-041 ❌ Privacy policy link. None.
- J-042 ❌ Cookie banner. One functional cookie only; not needed but undocumented.
- J-043 ❌ DPA for sending open answers to Anthropic for grading. Answers are sent to a third party; not disclosed in-app.
- J-044 ❌ Opt-out of AI grading (human review). None.
- J-045 ❌ PII in open answers (customer names) is sent to the model. None filtered.
- J-046 ❌ Data residency. SQLite on one server.
- J-047 ❌ Access log of who viewed whose scores. None.
- J-048 ❌ Employees can see what the company sees about them. Own dashboard only.
- J-049 ❌ Works-council or union consultation features. N/A.
- J-050 ❌ Children's data. N/A.

## Reliability and operations
- J-051 ✅ Deploy script syncs, installs, builds, pushes schema and reloads PM2; GitHub Action runs it on every push to main.
- J-052 ⚠️ Every push to `main` deploys with `drizzle-kit push`, which can drop data if a column is renamed.
- J-053 ❌ Staging environment before production.
- J-054 ❌ Rollback script. None.
- J-055 ❌ Zero-downtime deploy: PM2 reload fine for one process.
- J-056 ❌ DB backups before schema push. None.
- J-057 ❌ Restore drills. None.
- J-058 ❌ Monitoring/uptime check. None.
- J-059 ❌ Alert when the Claude API fails/rate limits. Falls back silently.
- J-060 ❌ Per-day AI cost cap. None.
- J-061 ⚠️ Server uses Node 20; Node 21+ APIs break production (README).
- J-062 ⚠️ `better-sqlite3` pinned for Linux prebuilds.
- J-063 ❌ Cron jobs: none exist; "no jobs needed" for rivals by design.
- J-064 ❌ Scheduled tasks (reminders, nightly sync, stale-pass sweep) require a scheduler. None.
- J-065 ❌ Time zone of the server for "today". UTC.
- J-066 ❌ Multiple instances for HA. Rate limiter, grading lock are per-process.
- J-067 ❌ Large uploads. Only avatars.
- J-068 ❌ Disk full. SQLite write fails; no alert.
- J-069 ❌ Long-running import blocking the site. Scripts run separately.
- J-070 ❌ Database migrations tracked. `push` rather than versioned migrations.

## Odd corners of the model
- J-071 ❌ Two users with emails differing only in dots/plus tags. Treated as different.
- J-072 ❌ Unicode homograph names. Allowed.
- J-073 ❌ Extremely long names/goals. Truncated by validation.
- J-074 ❌ Empty `roles` on a role-tier track = applies to all staff in scope. Intentional but surprising when set accidentally.
- J-075 ❌ A track with `scope = project` and `projectId = null`: `has("project", null)` is false, so nobody is required; track is hidden from scope; silent.
- J-076 ❌ A brand with `companyId = null` and kind `company`: nobody gets it by company.
- J-077 ❌ A track whose brand is deleted. Orphan.
- J-078 ❌ Same person has the same scope twice. Unique index prevents.
- J-079 ❌ Scope row points at a deleted project. Shows "project 12".
- J-080 ❌ Two tracks with the same name in different brands. Slug is unique; names are not.
- J-081 ❌ Level 20 reached; what next? Max level; maybe new tracks.
- J-082 ❌ Questions with `weight = 0`. Score division guarded by `possible ? ... : 0`.
- J-083 ❌ Run with all questions retired mid-way. Answers remain; scoring still works.
- J-084 ❌ Dynamic question generation fails for a family. Unknown fallback.
- J-085 ❌ A learner's draw runs out of unseen dynamic prompts. Seeded families are large; behaviour at exhaustion unverified.
- J-086 ❌ Track `kind = subject` vs `technology` filters. Display only.
- J-087 ❌ Leap-second/year boundaries. UTC dates.
- J-088 ❌ Certificate code collision (5 random bytes = 10 hex chars). Unique index; insert would fail silently with `onConflictDoNothing` and issue no certificate. Very unlikely.
- J-089 ❌ Concurrent certificate and promotion. Independent.
- J-090 ❌ Learner changes their name; old certificates. Stored by user id, displayed with the current name probably.

## Customer-specific
- J-091 ✅ Customers have no careers, no admin access.
- J-092 ❌ Customer success managers (staff) see customers only through the shared compliance list.
- J-093 ❌ Customer-visible announcements. None.
- J-094 ❌ Customer feedback form. None.
- J-095 ❌ Customer billing tie-in. None.
- J-096 ❌ Customers inviting their own colleagues (self-serve seats). Invite-only by managers.
- J-097 ❌ Customer sandbox for practice. N/A.
- J-098 ❌ Trial to paid upgrade access change. Scope edit.
- J-099 ❌ White-label tracks per customer. None.
- J-100 ❌ Customer-visible roadmap quizzes. None.
