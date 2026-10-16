# White-label audit: can gglearn be run for one company's team only?

First audited 2026-10-16 by reading the code, then updated the same day after the work below landed on `main`. The app was not run as part of the audit and no penetration test was done. Findings are a targeted read of schema, auth, admin pages, server actions and route handlers. `npm run check:tenancy` covers the scope rules (company-scoped reach, boards, rewards, branding, sign-off, avatars).

## Verdict
gglearn separates **what people learn**, **who can see and run it**, **how it looks** and **how people are rewarded** by company. It does not yet give each company its own **identity system**, **domain**, or **database**.

| Scenario | Ready? |
|---|---|
| One company's team only (for example Moksy) | Works now, with that company's name, logo, accent colour and certificate issuer. |
| Several companies sharing one install | Works for learning, admin, boards, branding and rewards. Not yet recommended for strangers' data: one login table, one SQLite file, isolation by code. |
| Full white-label (own domain, level names, separate accounts) | Still a real project: see "Still open". |

## What works
| Need | Status | Where |
|---|---|---|
| Company → brand → project → track hierarchy | Built | `lib/db/schema.ts` |
| Screens to create a company, brand and track | Built | `/admin/setup` |
| Learning limited to a company, brand or project | Built | `userScopes`, `lib/paths.ts` |
| Required, role-based or optional learning with pass level and deadline per track | Built | `tracks.tier`, `requiredLevel`, `dueDays` |
| Onboarding phases and manager sign-off gating later required learning | Built | `lib/onboarding.ts`, `phase_signoffs` |
| Staff versus customer audiences | Built | `users.audience`, `tracks.audience` |
| Invite-only signup tied to role and scope | Built | `invites` |
| Company-specific promotion ladders | Built | `content/careers/overlays` |
| Admin and manager reach limited to their own company | Built | `lib/tenancy.ts`, `/admin/*`, server actions |
| Company name, logo, accent colour, certificate issuer | Built | `companies.academyName`, `logo`, `accent`, `certIssuer`; `lib/brand.ts` |
| Seasons, group boards and open contests stay inside a company | Built | `lib/arena.ts` |
| Reward policy per company, brand or track | Built | `rewardRules`, `rewardAwards`, `/admin/rewards` |
| Certificates, XP, badges, streaks | Built | see Rewards |

## Admin isolation
- A manager or admin with scopes reaches only people and tracks inside their companies, brands and projects. One with no scopes is the platform owner and reaches everything. Rules live in `lib/tenancy.ts`.
- Manager server actions were reviewed for scope checks (invites, create person, role and scope changes, offboarding, track policy, sign-off, setup, branding, rewards, knowledge changes). The gaps found were closed: password reset, onboarding checklist ticks and avatar photos were not scoped, and now are.
- Career ladders are shared by every company, so only the platform-owner admin edits them.
- Route handlers: `/api/avatar/[id]` is scoped (owner, same company arena, platform owner, or a public contest). `/brand/[id]/logo` is public on purpose. `/cert/*` and `/s/*` are reachable only with an unguessable code (40 and 56 bits) and show a name and the certificate or card, not email or other company data.

## Branding
Per company: academy name (header, footer, page title), logo, accent colour (checked for readable white text) and the issuer printed on certificates. A person sees the look of their company when they belong to exactly one.

Not yet configurable: level names (Novice to Titan, `lib/levels.ts`), the rest of the colour scheme, custom domains or host-based lookup.

## Rewards
| Reward | Today |
|---|---|
| Certificate | Academy default at levels 5, 10, 15 and 20, or per-rule at any level. Verifiable at `/cert/<code>`. No expiry or signature. |
| XP | Fixed base formula in `lib/progression.ts`; a reward rule can add bonus XP at a level. The base formula cannot be changed or switched off per company. |
| Voucher | Per-rule, with a label and a required budget cap. Starts "pending"; the company marks it fulfilled. |
| Money | Per-rule, in minor units with a required cap. gglearn never holds or moves money: an award starts "pending" and the company records how it paid. |

The most specific rule wins (track, then brand, then company). Every award is a ledger row, unique per person, rule, track and level, so a retake never pays twice. The reward follows whoever owns the content, not the learner's own company.

## Browser check (2026-10-16)
Run against a scratch copy of the database with a Moksy manager and learner, a Guru manager, learner and admin (company-scoped), signed in through the real login form.

| Check | Result |
|---|---|
| Moksy manager: `/admin/people` | Lists only Moksy people; scope pickers offer only Moksy. |
| Moksy manager: compliance, careers, freshness, updates, seasons, competitions, achievements | No Guru people or company data in any page. |
| Moksy manager: matrix, paths, setup, rewards | Redirect to compliance (platform-owner or admin only). |
| Moksy manager: forged password reset for a Guru learner (hidden user id changed in the form) | Refused with "outside the companies you run"; the Guru learner's password and sessions unchanged. |
| Control: same form for a Moksy learner | Succeeds; their sessions are ended. |
| Guru admin: people, setup, rewards, paths, compliance, careers | Only Guru data; no Moksy people or entities. |
| Guru admin: forged "add brand" under Moksy's company id | Refused ("You can only add brands to a company you run"); nothing created. |

Not covered: certificate and share-card pages, the avatar route through the UI (covered by `check:tenancy`), other write actions (checklist ticks, sign-off), and any role outside the five test accounts.

## Still open
| Area | Finding | Ease |
|---|---|---|
| Accounts | One user table, globally unique emails, one login. A person can have several scopes but no separate identity per company. | Hard |
| Database | A single SQLite file with isolation by code convention only. The README already says to move to Postgres before real multi-user production. | Hard |
| Domains | No per-company domain or host-based lookup. | Medium |
| Level names and XP rules | Fixed for everyone. | Medium |
| Certificate expiry and signature | None. | Small |
| Wider browser coverage | A scoped manager and a scoped admin were exercised in a browser on 2026-10-16 (see below); other roles, mobile layouts and write actions beyond those listed were not. | Small |
| Performance with many companies in one database | Not measured. `arenaMap()` and `usersInReach()` load whole tables. | Medium |
