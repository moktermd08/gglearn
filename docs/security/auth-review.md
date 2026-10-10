# Auth differential review

Scope: `lib/auth.ts`, `lib/password.ts`, auth and authorization paths in `app/actions.ts`, `app/login/page.tsx`, `deploy/gglearn.gglink.co.uk.conf`.
Diff basis: the committed auth code (`9f6a092`) is unchanged since the initial commit, so there was nothing to diff. I reviewed it as a baseline, and reviewed the **uncommitted** `app/actions.ts` and `lib/db/schema.ts` changes as the diff.
Strategy: SMALL codebase, DEEP. HIGH risk (auth, authorization, assessment integrity).
Limits: static read only. Not read: `lib/stats.ts`, `lib/grading.ts`, `components/*` beyond `Drill.tsx`. Nothing was executed. The repo has no tests, so no changed code has coverage.

## Findings

### H1. `drillCheck` leaks exam answers (new, uncommitted) — `app/actions.ts:140`
Any signed-in user can call `drillCheck(questionId, key)` for **any** question id. It returns `q.answer` and the hint. It checks neither enrolment, unlocked level, nor whether the question is part of an open run.
Attack: a learner loops ids 1..N, reads every MCQ answer, then retakes runs until 80% (`startRun` has no cooldown). Level progression and `CERT_LEVELS` certificates become meaningless.
Fix: only return the answer for questions in a drill the user is enrolled in at a level ≤ their unlocked level, and never for questions in an unfinished exam run. Better, pick the drill question set server-side and hold the answer key there.

### H2. No rate limiting and blocking password hashing — `app/actions.ts` `login`/`signup`, `lib/password.ts`
There is no throttle on login or signup. `scryptSync` blocks the Node event loop (~50-100 ms each), so a modest request flood stalls the whole app, and passwords can be guessed at wire speed. Signup is open and unthrottled, so it can also be used to fill the DB.
Fix: per-IP and per-email attempt limiter (a small table, or in-memory for a single PM2 process), and use async `scrypt`.

### M1. Open self-signup into an internal academy — `signup`
Anyone on the internet can create an account and read tracks and questions. If the academy is internal, this is the biggest exposure after H1. Decide deliberately: invite-only, an email-domain allowlist, or an admin switch.

### M2. A manager can offboard an admin — `offboard`, `app/actions.ts`
`offboard` only blocks self-offboarding. A `manager` can set any user, including an `admin`, to `offboarded`, locking them out. Same pattern: `toggleChecklist`, `addHandover` and `retireQuestion` accept any id with no ownership or role-level check (acceptable if single-tenant, but worth stating).
Fix: reject when `target.role` outranks or equals the caller's, except admin on manager.

### M3. Sessions cannot be revoked and carry no expiry — `lib/auth.ts`
The cookie is `userId.HMAC(userId)`. The 30-day limit is only the cookie `maxAge`, which the client controls. A stolen cookie works until `SESSION_SECRET` is rotated, and `logout` only deletes the browser's copy. Offboarding is handled well because status is rechecked every request. There is no way to log out other devices or force re-login after a password change (and no password change exists).
Fix: sign `userId.issuedAt` and reject tokens older than 30 days, plus a per-user `sessionVersion` in the DB that is bumped on logout-all, password change and offboarding.

### M4. Account enumeration — `signup`, `login`
`signup` says "That email is already registered." `login` skips scrypt when the user does not exist, so response time reveals which emails have accounts. Fix: run a dummy `verifyPassword` against a fixed hash when the user is missing, and make signup's message generic or email-verified.

### L1. Password storage has no parameter versioning — `lib/password.ts`
Format is `salt:hash` with Node's scrypt defaults. It is sound today (random 16-byte salt, `timingSafeEqual`), but cost parameters cannot be raised later without a format change. Store `scrypt$N$r$p$salt$hash`. No password length minimum beyond 8, no breached-password check.

### L2. `finishDrill` grants XP on the client's word — `finishDrill`
It does not verify a drill was completed. Daily uniqueness caps the abuse at one grant per kind per day, so it only affects leaderboards (`lib/rivals.ts`).

### L3. Duplicate-submit race in `submitRun`
The `finishedAt` check and the final update are separated by awaited AI grading, so two concurrent submits both grade and both call `completeQuest`/certificate insert. Inserts are idempotent (`onConflictDoNothing`), so impact is cosmetic plus double AI cost. Fix: claim the run with `update … where finishedAt is null` before grading.

### L4. Deployment notes
- `deploy/gglearn.gglink.co.uk.conf` sets `X-Forwarded-Proto "http"`. Cookies use `secure` from `NODE_ENV`, so they are fine, but confirm certbot's generated `:443` vhost sends `https`.
- `ProxyPreserveHost On` is present, which keeps Next's server-action Origin/Host CSRF check working. Keep it. Cookies are `sameSite: lax`, which is good.
- `.env.example` leaves `SESSION_SECRET` empty with a 16-character minimum. Generate 32+ bytes.

## What looks right
- HMAC-SHA256 with `timingSafeEqual` and a length check before comparing.
- `httpOnly`, `sameSite=lax`, `secure` in production.
- Authorization is re-read from the DB on every request, so offboarded users and role changes take effect immediately.
- `startRun`/`submitRun` check ownership (`runs.userId`) and enforce level unlock order server-side.
- Input is validated with zod and bounded (`slice`, `max`). Queries are parameterised through Drizzle.
- `createPerson` cannot set `role`, so privilege escalation through the form is not possible.

## Blast radius
`currentUser`/`requireUser` is called by every page and action, so any change to `lib/auth.ts` affects the whole app. `drillCheck` has one caller (`components/Drill.tsx`).

## Test coverage
None. No test directory or test script exists. Highest value first: `drillCheck` authorization, `offboard` role rule, session tamper and expiry cases.

## Suggested order
H1, H2, M2, M1, then M3 and M4.

## Status
- H1 `drillCheck` leak: fixed (`lib/drill.ts`). Residual: level 1 answers are readable by a learner who has not yet passed level 1.
- H2 rate limiting and blocking hashing: fixed (`lib/rate-limit.ts`, async `lib/password.ts`). In-memory, single process.
- M2 manager can offboard admin: fixed.
- M4 login timing enumeration: fixed (the "already registered" signup message went away with open signup).
- M1 open signup: fixed. Signup is invite-only (`lib/invites.ts`, `/join/[token]`); the old `signup` action is removed.
- M3 sessions: fixed. Cookie is `userId.issuedAt.version.mac`; the server enforces a 30-day lifetime and `users.session_version` revokes older sessions ("Sign out everywhere", offboarding). Existing cookies were invalidated once.
- Open: L1-L3.
