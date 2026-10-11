# GGLearn end-to-end journeys (as the system works today)

Written from the code and the live `data/gglearn.db` (2026-10-11). Legend: ✅ works today · ⚠️ works but manual or thin · ❌ missing.
Not run in a browser; every claim below is read from `app/actions.ts`, `lib/paths.ts`, `lib/careers.ts`, `lib/db/schema.ts` and the DB.

## Facts that shape every journey

1. **Signup is invite-only.** A manager/admin issues a single-use link bound to one email, valid 7 days (`createInvite`, `lib/invites.ts`). Nobody can self-register. ⚠️
2. **No email is ever sent** (no mailer in the code). The admin copies the `/join/<token>` link and delivers it themselves. ⚠️
3. **Scope decides what you see.** Company → brand → project, set at invite time. Shared brands (Tech Foundations, Titan Academy, Software Lifecycle) are visible to all staff.
4. **Required learning** = tracks with tier `mandatory`, or tier `role` matching `users.job_role` exactly, in scope, *and with questions reaching `requiredLevel`* (default level 5, due in 30 days). Empty tracks are silently never required.
5. **Soft gate only.** Nothing blocks work. `/admin/compliance` shows who is overdue. No reminders are sent.
6. **Job roles are free text** (`developer`, `sales`, ...). Ladders exist only for developer, designer, sales, manager.
7. **Content reality today:** Claude/OpenAI/ChatGPT Titan tracks have 2,400/2,400/330 questions. Company tracks for GGLink, Guru Graphics and Moksy brand/sales/support are mostly **0 questions**. There is **no** social media, Facebook marketing, lead generation or full-stack track.

---

## Journey 1: "Claude or ChatGPT: which should I learn?"

| Step | Where | What happens | Status |
|---|---|---|---|
| 1 | Admin | Invites you as `staff` with scope on a shared or personal brand (e.g. M Hossain). Titan tracks are shared, so you see them. Customers would *not*. | ⚠️ needs an admin; no self-signup |
| 2 | `/join/<token>` | Set name + password, auto-signed in. Onboarding checklist created (5 manual items). Up to 6 recommended tracks auto-enrolled if nothing is required. | ✅ |
| 3 | `/start` | Pick topic **api-claude-titan**. Choose *solo*. | ✅ |
| 4 | Placement check | Binary-search quiz finds your level (lo/hi over 0..15), or skip. Sets `placedLevel`. | ✅ |
| 5 | Finish line | Pick a goal level and date; solo launches a private contest with simulated rivals. | ✅ |
| 6 | Repeat 3-5 | Do the same for **chatgpt-titan** / **api-openai-platform-titan**. | ✅ |
| 7 | Compare | `/dashboard` shows both tracks, your placed level and the rival race. The *placement level on each* is your comparison. | ⚠️ no side-by-side view |
| 8 | Decide | Keep the one where you place higher / progress faster; the other stays enrolled but costs nothing. | ⚠️ no "decision summary" |

**Gap:** a one-screen "compare two tracks" (placement, pace, questions answered, pass rate) and a "Claude vs ChatGPT: which fits my job" intro track. Also note `foundations-chatgpt` is hidden (superseded by `chatgpt-titan`).

---

## Journey 2: Onboard as Social Media Manager for Moksy AI

| Step | Where | What happens | Status |
|---|---|---|---|
| 1 | Admin | Invite: job role `social media manager`, scope = company *Moksy AI* + project *moksy.ai*. | ⚠️ role string is free text |
| 2 | Join | Account + checklist (read brand story, 30-60-90 goals, tool access, pass level 3, shadow a teammate). Checklist items are plain text; **ticking is done by a manager** (`toggleChecklist` needs manager), not the new hire. | ⚠️ |
| 3 | Required path | `syncRequired`: only `governance-compliance` is mandatory for staff today. Role tracks match `developer`/`sales`/`designer`/`manager` only, so **a social media manager has no role-required tracks**. | ❌ |
| 4 | Recommended | Fallback enrols up to 6 tracks whose `roles` is empty or contains the role text. Mostly generic Foundations/Titan tracks, not social. | ⚠️ |
| 5 | Brand knowledge | `moksy-product` (40 q) is the only Moksy staff track with questions. No brand voice, moto, tone, do/don't, approval-flow track. | ❌ |
| 6 | Career | No `social media manager` ladder, so no promotion path. | ❌ |
| 7 | Manager sign-off | `/admin/compliance` shows done/overdue; manager ticks the checklist. | ✅ |

**What to build to make this real (smallest set):**
1. Tracks (tier `role`, roles `social media manager`, scope project/brand Moksy): *Moksy brand & voice*, *Moksy product for social*, *Content calendar & approval flow*, *Platform playbooks (Facebook/LinkedIn/X/Instagram)*, *Crisis & community replies*.
2. Author knowledge items → `npm run generate:bank -- --track <slug>` → approve at `/admin/review/<slug>`.
3. Seed a `social media manager` ladder (`scripts/seed-careers.ts`).
4. Let the new hire tick their own non-manager checklist items.

---

## Journey 3: Individual learning Facebook Marketing with AI agents

*(Read as "using AI agents to do Facebook marketing". If you meant "against" as in agency vs agent, say so.)*

| Step | What exists | Status |
|---|---|---|
| Account | Admin invites you under a personal brand (`mhossain`) or as staff. | ⚠️ |
| Track | **None named Facebook Marketing.** Nearest: `agent-automation-titan`, `agent-design-titan`, `agent-claudecode-titan`, `llm-prompting-titan`, `data-analytics` (16 q), `gglink-seo-content` (0 q). | ❌ |
| Path | You would enrol in 3-4 of those and self-direct. No ordering across tracks. | ⚠️ |
| Practice | Open and scenario questions graded by Claude (needs `ANTHROPIC_API_KEY`; otherwise a coarse keyword fallback). | ⚠️ |
| Proof | Certificates at levels 5/10/15/20 per track, public at `/cert/<code>`. | ✅ |

**Needed:** a `facebook-marketing` technology track (pixel, campaign structure, audiences, creative, budgets, reporting, policy) and a `marketing-ai-agents` track (agent workflows for copy, A/B, reporting, guardrails). The `generate:bank` + review flow supports both. A multi-track **learning path** object (ordered tracks + target date) does not exist; the person's own `enrollments.goal` text is the only goal.

---

## Journey 4: 4-person sales team, lead generation for Guru Graphics Limited

| Step | What happens | Status |
|---|---|---|
| 1 | Admin invites 4 people, role `sales`, scope company *Guru Graphics Limited* (+ brand Guru Graphics). Four separate invites; no bulk import/CSV. | ⚠️ |
| 2 | Role-required tracks for `sales` in scope: `gglink-sales-support` is role-tier but has **0 questions** → never required. `sample-brand-sales-basics` (4 q) is optional. | ❌ |
| 3 | Sales ladder (Associate → Exec → Senior → Head) exists, but its steps point at GGLink/Moksy/GGSocial products, not lead generation. | ⚠️ |
| 4 | Team goal and date: **no team object.** Closest tool: a private *competition* with `goalLevels` and `endsAt`, invite all four by email. Gives a team leaderboard and deadline. | ⚠️ |
| 5 | Manager oversight: `/admin/compliance` lists everyone, not "my team". | ⚠️ |

**Needed:** a `lead-generation` process track (ICP, outbound, inbound, qualification, CRM hygiene, follow-up cadence, objections, Guru Graphics offers & pricing), tier `role`, roles `sales`, scope brand Guru Graphics; a **Team** (name, members, goal, deadline, manager) with a team progress page; bulk invite.

---

## Journey 5: Junior full-stack developer → support full-stack developer for GGLink

| Step | What happens | Status |
|---|---|---|
| 1 | Invite as `developer`, scope company GGLink + projects gglink.co.uk, GGSocial, GGMoney. | ✅ |
| 2 | Required path: ~18 developer `role` tracks (SDLC, Drupal, GraphQL, Tailwind, DevOps...) plus mandatory governance, 30 days each. GGLink-specific ones (`gglink-hosting-maintenance`, `gglink-ai-automation`) have **0 questions**. | ⚠️ |
| 3 | Career: *Junior Developer → Developer* needs git-titan L8, javascript-titan L8, sdlc-backend/security/testing L5, governance L5. Dashboard shows steps met; manager promotes at `/admin/careers`. | ✅ |
| 4 | "Support" specialism: no *support* ladder, no on-call, incident, runbook or GGLink-system tracks. | ❌ |
| 5 | Promotion is blocked while any required learning is overdue; only admin can override with a reason. | ✅ |

**Needed:** GGLink support runbook tracks (hosting, incident response, client sites, deploy), a `support developer` ladder branching from Developer 2, a note on how "specialism" differs from "promotion".

---

## Journey 6: Moksy AI updated brand details and moto: am I up to date?

This is the biggest structural gap. Today:
- `knowledge_items` has `version` and `updatedAt`, and questions link to a knowledge item, **but nothing compares a learner's last pass to the item's `updatedAt`.** ❌
- Editing a knowledge item does not re-flag its questions, notify anyone, or reopen a requirement. ❌
- A learner who passed level 5 last year still shows "done".

**Design (small, fits current schema):**
1. When a knowledge item changes, bump `version` and mark its linked questions `review`.
2. Add `tracks.refreshedAt` (or per-item) and compute `stale = lastPassAt < refreshedAt`.
3. In `requirementsFor`, a stale pass becomes "refresh needed" with a short deadline (e.g. 7 days) and a mini-exam of only the changed items.
4. `/admin/compliance` gains a "brand pulse" column: % of in-scope staff current on the latest version.
5. Dashboard banner: "Moksy brand v4 changed 3 items: re-check (5 min)".

---

## Verdict: what to build first, in order

1. **Knowledge versioning + refresh (Journey 6).** Highest leverage for a company that keeps changing.
2. **Role coverage:** allow any job role to have tracks/ladders (social, support, lead-gen) and warn admins when a role has none.
3. **Team object** (members, goal, deadline, manager) and team progress page.
4. **Notifications:** email/webhook for invites, due soon, overdue, promotion ready, offboarding.
5. **Content:** Facebook marketing, marketing AI agents, lead generation, Moksy brand & voice, GGLink support tracks.
6. **Reactivation / rehire, password reset, self-tick checklists, bulk invite.**

See `docs/edge-cases.md` for the 1,000 cases.
