# Plan: a GGSocial-style admin for gglearn, with Master, Company and Brand layers

Written 2026-10-17 after reading the GGSocial admin (`/Users/mokterhossain/projects/ggsocial`) and the current gglearn admin. **Phase 1 is built (section 8).** Phases 2 to 6 are not. Section 7 records the decisions: 1 and 2 are made, 3 to 5 are still open.

## 1. What the GGSocial admin does

**The frame**
- One app shell: a fixed side nav with the app mark, a **scope switcher** at the top, grouped links with counts, and the signed-in person at the bottom. The groups are the same across the GG apps: Work, Content, Plan, Measure, Setup.
- The shell comes from a shared UI kit, `@gg/ui`, which is *copied* into each app from GGLeads (`packages/ui`) and must not be edited in place (`src/gg-ui/SOURCE.md`).

**The scope switcher**
- One cookie (`ggs_brand`) holds `master`, `all` or a brand id. `getScope()` turns it into `{ isMaster, activeBrand, brandIds }`.
- The nav does **not** change with the scope. Each page decides what the scope means: a Master scope shows the master copies, a brand scope shows that brand's, "All" shows everything the person can see across brands. Pages with no master layer treat Master as All.

**How master and brand are layered (three patterns)**
1. **Linked copy with a snapshot** (posts, campaigns, templates, the brand book, ideas). A master row has no brand. A brand row points at it (`masterId`) and keeps a `masterSnapshot` of the master's values at the last sync. Per field the app can then say *customised* (the brand changed it), *pending* (the master moved on) or *following*. A master edit flows to fields that are still following; customised fields are offered, not forced. Locked states (approved, published) never change behind someone's back. One small library (`lib/masters.ts`) does this for every type.
2. **Override rows** (the Playbook). Master rules in one table, per-brand overrides in another, and `effectiveRule()` resolves the two. Brands can *propose* a change, an approver decides, and every change is logged with who, why and the numbers behind it.
3. **Master assets** (media). A file with no brand is a master asset; a brand's own version stands in for it in that brand.

**People and rights**: per-brand memberships with roles (`memberships`), plus a separate "can edit master" right. Master pages say so ("Master templates", "in Master").

## 2. Where gglearn is today

gglearn already has the hierarchy and part of the layering.

| Area | Master (academy-wide) | Company | Brand | Mechanism today |
|---|---|---|---|---|
| Who runs what | platform owner (admin with no scopes) | company manager/admin | via scope | `lib/tenancy.ts` reach |
| Content tracks | "shared" brands (Tech Foundations, Titan Academy, Software Lifecycle) | company's brands own tracks | tracks belong to a brand | `brands.kind`, `tracks.brandId` |
| Questions | the bank of shared tracks | none of their own | per track | questions belong to one track |
| Required learning | defaults + role×pillar matrix (platform only) | per-track policy | per-track | `tracks.tier/requiredLevel/dueDays`, `policySource` |
| Rewards | academy default certificate | rule | rule | **already a cascade**: track > brand > company > default |
| Branding, certificate policy | gglearn look | name, logo, colour, issuer, validity, signatory | none | `companies` columns |
| Careers | the framework ladders | company overlays | none | `content/careers/overlays` |
| Boards and contests | open arena | company arena | none | `lib/arena.ts` |
| Exam settings (10 questions, 80% pass, certificate levels, level names, XP) | fixed in code | none | none | `lib/levels.ts`, `lib/progression.ts` |
| Competitions and campaigns | platform campaigns | none (the creator's arena decides) | none | `competitions.createdBy`, `content/campaigns` |
| Journeys | generated per person | none | none | `journeys` is a per-person placement flow, not a template |
| Onboarding phases | fixed list | none | per-track deadline | `lib/onboarding.ts` |

So the work is mostly: **(a)** the shell and switcher, **(b)** a general "setting with layers" mechanism for the flat rows (exam settings, phases, competitions, journeys), **(c)** letting a company or brand add to or hide master content (questions, tracks), and **(d)** per-scope roles.

## 3. The target

**Scope** is one of: **Master** (the academy's general layer), **All companies** (platform owner or a manager of several), **a company**, **a brand**. It is held in a cookie like GGSocial's, but resolved *through reach*: you can only pick scopes you run, and the platform owner is the only one who can enter Master.

**Rule for every feature**: *Master defines the default. A company can follow it, tune it, or add its own. A brand can do the same under its company.* Resolution order is brand, then company, then master, then the built-in default.

Each feature uses one of GGSocial's three patterns:

| Feature | Pattern | What a company or brand can do |
|---|---|---|
| Exam settings (questions per run, pass mark, time limit, which levels give certificates, level names) | 2, overrides | tune any value; leaving it blank follows master |
| Onboarding phases and the sign-off gate | 2, overrides | rename phases, change the window, switch gates off |
| Reward policy, branding, certificate policy | already layered | add brand level to branding; show them on the same page |
| Question bank | 1+3, linked + additions | add their own questions to a master track; hide a master question for them; see "master changed" |
| Tracks | 1, linked copy | follow a master track, or copy and customise; "N changes from master" badge |
| Required learning (paths) | 2, overrides | already per-track; surface master default vs override |
| Competitions and campaigns | 1, linked copy | master publishes a contest template; a company adopts it with its own dates, prizes and arena |
| Journeys (new: path templates) | 1, linked copy | master defines role/onboarding journeys (ordered tracks with level goals); a company edits its copy |
| Careers | 2, overlays | already there; move the overlay files into the database so they can be edited in the screen |
| Freshness and knowledge updates | follows the track | an update to a master track is announced to companies that follow it |

## 4. The new admin shell

A side nav in the same five groups, with the scope switcher on top and counts on the links.

| Group | Pages | Master scope shows | Company or brand scope shows |
|---|---|---|---|
| **Work** | Dashboard, People and onboarding, Sign-offs, Compliance, Certificates | academy-wide totals (platform owner) | that company's people and queues |
| **Content** | Tracks and questions, Review queue, Knowledge updates | the master library, with "N companies follow" | what the company follows, adds and hides |
| **Plan** | Required learning, Journeys, Careers, Onboarding phases, Rewards | master defaults | overrides, with "follows master" or "customised" per row |
| **Compete** | Competitions, Campaigns, Seasons | master templates | the company's contests and arena |
| **Measure** | Question quality, Learning analytics | whole academy | scoped |
| **Setup** | Companies and brands, Branding and certificates, Access and roles, Exam settings | all companies | the one company |

Every page shows its layer in the header ("Master" or "Moksy · customised") and a badge on rows that are behind the master, exactly like GGSocial's templates page.

The learner site (header, footer, dashboard) stays as it is. Only `/admin` gets the new frame.

## 5. Data model changes

1. **`scope_settings`** — `scope` (master, company, brand), `refId`, `key`, `value` (JSON), `updatedBy`, `updatedAt`. One resolver, `settingFor(key, {brandId, companyId})`, walks brand, company, master, default. Exam settings, phases, level names, XP rules and feature switches all use it. Every change is written to a `setting_changes` log (who, before, after, why), like the Playbook's change log.
2. **Question ownership** — `questions.ownerScope` and `ownerId` (null = master), plus `question_hides(scope, refId, questionId)`. A company's view of a master track is master questions minus hidden plus its own. Counting and drawing questions go through one function that takes the scope.
3. **Track links** — `tracks.masterTrackId` and `masterSnapshot` for a customised copy of a master track, using a port of GGSocial's `lib/masters.ts` (`inheritState`, `planSync`).
4. **Contest and journey templates** — `competitions.ownerScope/ownerId` and `masterId`; a `path_templates` table with `masterId` for company copies.
5. **Per-scope roles** — `memberships(userId, scopeKind, refId, role)` so one person can be admin of one company and a learner in another; a separate `canEditMaster` flag for the platform owner. Reach keeps working on top of it.
6. **Scope cookie and resolver** — `lib/scope.ts` with `getScope()`, built on `reachOf()` so a scope the person does not run is refused.

All of this is additive: columns with nullable defaults, new tables. Use the nullable-integer form for new numeric columns, not `NOT NULL DEFAULT 0` (see `docs/performance.md` on `db:push`).

## 6. Phases

Each phase ships on its own, behind the existing pages, and extends `npm run check:tenancy`.

| # | Phase | Delivers | Size |
|---|---|---|---|
| 1 | **Shell and switcher** | `/admin` in its own frame with the five groups, the scope cookie and switcher, scope shown in every page header; existing pages moved under it unchanged | 3–5 days |
| 2 | **Settings layer** | `scope_settings` + resolver + change log; an **Exam settings** page and an **Onboarding phases** page, master then company then brand | 4–6 days |
| 3 | **Master and company questions** | ownership, hides, scoped counts and draws, a Content page with "follows master / own / hidden", and the review queue per scope | 1–2 weeks |
| 4 | **Tracks and paths follow master** | linked copies with the customised/pending badges, "N companies follow" counts, knowledge updates reaching followers | 1–2 weeks |
| 5 | **Competitions and journeys** | contest templates adopted per company, `path_templates` for journeys and onboarding, careers overlays editable in the screen | 1–2 weeks |
| 6 | **Per-scope roles** | memberships, master-edit right, access page | 1 week |

Cross-cutting checks in every phase: scoped pages read a page at a time (see `docs/performance.md`), every server action checks reach, and a browser pass as a company manager and a platform owner.

## 7. Decisions

1. **Look and feel. Decided: use the `@gg/ui` kit**, copied from GGLeads for `/admin` only; the learner site keeps its own look.
2. **Layout mechanics. Decided: route groups**, a `(site)` group for the learner pages and an `(admin)` group with its own root layout. That is what keeps the kit's CSS out of the learner site (the kit and gglearn both define `.btn`).
3. **Who edits Master.** Only the platform owner, or a named "master editor" role as in GGSocial?
4. **Granularity.** Do brands need their own settings and questions, or is company level enough for exam settings and phases? Brands add a layer to every resolver.
5. **Which phase next.** Phase 2 (the settings layer) once you have judged the layout.

## 8. Phase 1: what was built

- **The kit.** `src/gg-ui` is a copy of GGLeads' `packages/ui`, made with `node scripts/sync-ui.mjs ../gglearn` run in GGLeads. Do not edit it; change the kit in GGLeads and copy it again (`--check` in GGLeads catches a hand edit or a stale copy). `@gg/ui` is an alias in `tsconfig.json`.
- **Two root layouts.** `app/(site)` is the learner site exactly as before (header, footer, Tailwind and gglearn's styles). `app/(admin)` is the admin: its own `<html>`, the kit's `styles.css` on top of gglearn's, light theme. Moving between them is a full page load. `app/api`, `app/brand`, `app/actions.ts` and `globals.css` stay at the top. Unmatched addresses use `app/global-not-found.tsx` (`experimental.globalNotFound`), and the admin has its own `not-found.tsx`.
- **The frame.** `components/admin/AdminNav.tsx` is the kit's `SideNav` with the groups Work, Content, Plan and Setup, a count on Certificates, and the person at the bottom. Links to pages only an admin or only the platform owner may open are left out for everyone else.
- **The scope switcher.** `lib/adminScope.ts` and the `ggl_admin_scope` cookie. Values: `master`, `all`, `company:<id>`, `brand:<id>`. The cookie is never trusted: `resolveScope` checks it against what the person runs (`lib/tenancy.ts`), so a forged value falls back to "all". Only the platform owner can enter Master. `reachFor()` in tenancy builds the narrowed reach.
- **Pages follow the scope.** People, Compliance, Certificates, Careers, Freshness, Required learning, Rewards and Set up read the scope's reach instead of the person's full reach. Server actions keep the full reach, so choosing a scope can narrow what is shown but never widens what can be changed. The panel counts and the sign-off list take an optional reach.
- **A new Overview** at `/admin` (tiles, "needs your attention", how scopes work). The old question-bank page moved to `/admin/bank`.
- **Every page shows its scope** in a strip at the top: the kind, the name and one line on what is shown. In Master, pages with no master layer yet say they show the whole academy.
- **Checks.** 13 new cases in `npm run check:tenancy`: who can enter master, in-reach and out-of-reach companies and brands, forged and malformed values, and what the switcher offers.

Known limits: the existing pages keep gglearn's look inside the new frame until they are rebuilt with kit components; the nav counts other than Certificates arrive once the list pages are cheap enough to count on every page (see `docs/performance.md`); the admin is light only.
