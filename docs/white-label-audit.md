# White-label audit: can gglearn be run for one company's team only?

Audited 2026-10-16 by reading the code (schema, auth, admin pages, progression, competitions, theme). The app was not run and no security test was done, so treat findings as a targeted read, not an exhaustive review.

## Verdict
gglearn already separates **what people learn** by company, brand and project. It does not yet separate **who can see and run it**, **how it looks**, or **how people are rewarded**.

| Scenario | Ready? |
|---|---|
| One company's team only (for example Moksy) | Works now. Create the company, scope the people, set the required tracks. Branding is still "gglearn". |
| Several companies sharing one install | Not safe yet: admin visibility and shared leaderboards leak across companies. |
| Full white-label (own look, domain, rewards) | A real project. |

## What already works
| Need | Status | Where |
|---|---|---|
| Company → brand → project → track hierarchy | Built | `lib/db/schema.ts` |
| Learning limited to a company, brand or project | Built | `userScopes`, `lib/paths.ts` |
| Required, role-based or optional learning with pass level and deadline per track | Built | `tracks.tier`, `requiredLevel`, `dueDays` |
| Staff versus customer audiences | Built | `users.audience`, `tracks.audience` |
| Invite-only signup tied to role and scope | Built | `invites` |
| Company-specific promotion ladders | Built | `content/careers/overlays` |
| Certificates, XP, badges, streaks | Built, one global style | see Rewards |
| Contest cash prizes | Recorded only; gglearn never holds or moves money | `competitions.prize*` |

## Gaps that block white-labelling
| Area | Finding | Ease of fixing |
|---|---|---|
| Admin isolation | `users.role` (admin, manager, learner) is global. `/admin/people`, compliance, careers, review and freshness read the whole `users` table with no company filter. A manager at one company would see another company's staff. | Medium |
| Setting up a company | Companies, brands, projects and tracks are created only by seed scripts (`scripts/seed-structure.ts`, `seed-curriculum.ts`). No screen exists. | Medium |
| Branding | "gglearn" is hard-coded in `SiteHeader`, `SiteFooter`, `CertFrame` and the page title in `app/layout.tsx`. Colours are fixed in `app/globals.css`. No logo, per-company domain or host-based lookup. Level names (Novice to Titan) are fixed in `lib/levels.ts`. | Medium |
| Shared spaces | Seasons, leaderboards, rivals and competitions span all users, so one company's people can appear on another's boards. | Medium |
| Accounts | One user table, globally unique emails, one login. A person can have several scopes but no separate identity per company. | Hard |
| Database | A single SQLite file with isolation by code convention only. The README already says to move to Postgres before real multi-user production. | Hard |

## Rewards: certification, XP, voucher, money
| Reward | Today | Gap |
|---|---|---|
| Certification | Issued at levels 5, 10, 15 and 20, verifiable by code at `/cert/<code>`. | Reads "gglearn academy"; no company issuer, signature or expiry; levels not configurable. |
| XP | Fixed formula in `lib/progression.ts`. | A company cannot change the rules or switch it off. |
| Voucher | Does not exist. | Build from scratch. |
| Money | Only the contest prize that an organiser pays and records. | No payments, no ledger, no per-track payout rules. |

Missing piece: a reward policy per company, brand or track, for example "pass level 10 → certificate + 500 XP + £20 voucher", with an award ledger so every reward is traceable and cannot be granted twice.

## Suggested order
1. **Company-scoped admin.** Admins and managers see only their company's people; a super-admin stays global. Add screens to create a company, brand and track.
2. **Branding.** Per-company name, logo, colours, level names and certificate issuer. Add a company filter to boards, seasons and competitions.
3. **Reward policy.** Per-track setting for certificate, XP, voucher or money, backed by an award ledger. Move to Postgres, and add custom domains if needed.

Steps 1 and 2 are roughly a few days to two weeks each; step 3 is the large piece.

## Not checked
- Whether API routes under `app/api` enforce scope.
- Whether public pages (`/cert`, `/share`, `/s`) reveal company data.
- Performance with many companies in one database.
