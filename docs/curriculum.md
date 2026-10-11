# GGLearn curriculum map

Draft for review. Sources: `moksy-mvp/data/lifecycle.js` (10 SDLC phases), `moksy.ai/wt-earning-gaps/foundation/*` (29 platform services), `docs/MOKSY_1000_INTEGRATIONS.md` (tool families), `docs/MOKSY_PATTERN_ARCHITECTURE.md` (patterns, 1:99), plus the tracks already seeded in `data/gglearn.db`.

## How it maps onto the existing schema

No schema change is needed. The existing tables already fit:

| Learning layer | Schema | Notes |
|---|---|---|
| Company / Brand | `brands` row | One per company. Tracks hang off it. |
| Products | `tracks.kind = "product"` | |
| Services | `tracks.kind = "service"` | |
| Tools | `tracks.kind = "tool"` | |
| Technologies | `tracks.kind = "technology"` | Already 35 `foundations-*` + 19 `*-titan` tracks. |
| Lifecycle / governance / security / ops / design / automation | `tracks.kind = "process"` | One track per lifecycle area. |
| Cross-cutting subjects (OOP, networking, algorithms) | `tracks.kind = "subject"` | |

Each track keeps the 20-level ladder. A learner's path is picked by `tracks.roles`.

## 1. Companies / brands (`brands`)

| Slug | Name | Role in the group |
|---|---|---|
| `gglink` | GGLink | Parent / agency umbrella |
| `guru-graphics` | Guru Graphics | Design and branding |
| `moksy-ai` | Moksy AI | AI platform that automates the lifecycle |
| `mhossain` | M Hossain | Personal brand / founder content |
| `foundations` | Tech Foundations | Exists. Generic technology skills. |
| `titan-academy` | Titan Academy | Exists. Advanced technology tracks. |

Each brand also gets company tracks: who we are, brand voice, how we sell, how we support, how we deliver.

## 2. Products

| Product | Brand | What to learn |
|---|---|---|
| Moksy | Moksy AI | Journeys, reviewer/customer/staff roles, MXP/MOX, patterns, reports, 1:99 |
| GGSocial | GGLink | Features, admin, content moderation, support playbook |
| GGMoney | GGLink | Money flows, ledger, compliance, support |
| GGLearn | GGLink | Admin, tracks, competitions, certificates, deploy |

For each product: purpose, user journeys, architecture, data model, admin tasks, support runbook, release notes, roadmap.

## 3. Services

Web design and build, branding and identity, SEO and content, WordPress/Drupal/Laravel delivery, hosting and maintenance, AI automation, integrations, training. Each service track covers: scoping, pricing tiers (free / semi-free / paid / custom / enterprise), delivery steps, QA checklist, handover.

## 4. Tools, grouped by lifecycle phase

Taken from the Moksy integration families, regrouped:

| Phase | Tool families |
|---|---|
| Plan and requirements | Product management and roadmaps, user research and feedback, docs and wikis, notes |
| Design | Design and prototyping, diagrams and whiteboards, presentations |
| Build | Code hosting and CI, developer tools and issue trackers, no-code and site builders, CMS, AI assistants and agents |
| Data | Databases and spreadsheets, data pipelines and ETL, analytics |
| Test and quality | Security and quality, accessibility checkers, performance testing |
| Ship and run | Cloud and hosting, monitoring and incidents, identity and SSO, file storage |
| Business | CRM and sales, support and helpdesk, payments and billing, finance, HR, legal and e-signature, e-commerce |
| Grow | Marketing automation, social and community, email and calendar, scheduling, meetings, localisation |
| Work together | Team chat, project management, office suites, automation hubs, ERP |

## 5. Technologies

Already seeded: HTML, CSS, JavaScript, TypeScript, React, Next.js, Vue, Angular, Node.js, Express, PHP, Laravel, Python, WordPress, MySQL, MongoDB, Git, GitHub, Docker, Linux, Apache, AWS, Lambda, REST API, JSON, XML, npm, OOP, OpenAI, ChatGPT.

Gaps to add: PostgreSQL, Redis, SQLite/Drizzle, GraphQL, Kubernetes, Terraform, Nginx, CI/CD (GitHub Actions), Playwright/Jest, Tailwind, Drupal, Qdrant/vector DBs, LLM APIs and agents, MCP.

## 6. Software lifecycle (process tracks)

The 10 Moksy phases are the spine. Every other area below attaches to one or more of them.

| # | Phase (Moksy) | Track contents |
|---|---|---|
| 1 | Discovery and planning | Problem framing, audience, goals, scope, budget, timeline |
| 2 | Requirements analysis | Functional and non-functional requirements, roles, compliance, integrations |
| 3 | System design and architecture | Stack choice, components, data flow, hosting, scaling, API style |
| 4 | Frontend development | UI framework, design system, responsive, accessibility, PWA, theming |
| 5 | Backend development | API design, business logic, jobs, queues, caching, search, storage |
| 6 | Database design | Modelling, indexing, migrations, backups, archival |
| 7 | Security and authentication | Auth flows, encryption, RBAC, MFA, audit logging, GDPR |
| 8 | Testing and QA | Strategy, unit, e2e, coverage, performance, accessibility testing |
| 9 | CI/CD and DevOps | Pipelines, environments, containers, monitoring, alerting |
| 10 | Launch and post-launch | Go-live checklist, support model, feedback loop, analytics, versioning |

### Cross-cutting areas (from Moksy's platform services and pillars)

| Area | Covers | Moksy source |
|---|---|---|
| Governance and compliance | Policies, approvals, audit trails, GDPR/HIPAA/PCI/FERPA, risk score | `audit`, `ai-policy`, `permissions` |
| Security | Identity, secrets, API keys, MFA, threat modelling, incident response | `auth`, `permissions` |
| Servers and infrastructure | Linux, Apache/Nginx, Docker, K8s, backups, SSL, deploy, health checks | `deploy/`, hosting |
| Design and branding | Identity, design system, UI/UX, accessibility, content style | Guru Graphics, `brand/` |
| Automation | Workflows, jobs, events, webhooks, Zapier/n8n, 1:99 patterns | `jobs`, `events`, `orchestrator`, `patterns` |
| AI | LLM use, memory, prompts, evaluation, policy, agents, MCP | `ai-llm`, `ai-memory`, `ai-nlp`, `mcp-server` |
| Data and analytics | Event data, usage metering, reporting, dashboards | `usage`, `reporting`, `dashboard` |
| Payments and subscriptions | Billing, ledger, subscriptions, refunds | `payments`, `subscriptions` |
| Communications | Email, notifications, templates, deliverability | `communications`, `notifications` |
| Project and delivery management | Requirements, estimates, handover, client continuity | `projects`, `requirements` |
| Quality | Review, scoring, learning signals, audits | `progression`, `registry` |
| Content and SEO | CMS, content ops, SEO, localisation | `dictionary`, `downloads`, `storage` |
| Hardware and devices | Dev machines, networking, peripherals | Moksy pillar "Hardware" |
| People and operations | Roles, onboarding, staff ops, reviewer ladder | `users`, `MOKSY_STAFF_OPERATIONS` |
| Sales and support | Discovery calls, quoting, support runbooks | existing sample track |

### The 11 lenses to apply per phase

Moksy's own pillar grid (rows: Strategy, Experience, Code, Database, Content, Hardware, Pattern; columns below). Each track should answer these for its topic:

Technologies, Skills, Cost, Time, Tools, Prompts, Research, Tips, Risk score, Integration, Agent.

## 7. Suggested build order

1. Create the four brands and the four product tracks. Product knowledge is the highest value for new hires.
2. Add the 10 lifecycle tracks as `process`, then governance, security and servers.
3. Add tool tracks for the stack you actually run (Next.js, SQLite, PM2, GitHub, deploy).
4. Fill technology gaps from section 5.
5. Write knowledge items first, then generate questions from them (the `knowledge_items` to `questions` link already exists).

## Structure (decided)

Learning scope runs **company -> brand -> project** (`npm run seed:structure`, `scripts/seed-structure.ts`).

- Guru Graphics Limited owns GGLink and Guru Graphics. Moksy Limited owns Moksy AI.
- M Hossain is a personal brand with no company. Shared academy brands (Tech Foundations, Titan Academy, Software Lifecycle) also have none.
- Projects: gglink.co.uk, gurugraphics.co.uk, moksy.ai, mhossain.uk, plus GGSocial, GGMoney and GGLearn. Those three have no brand or company: they serve every company and brand.
- `pillars` and `topics` hold the 28-pillar capability map (`content/structure/pillars.json`). Documentation, Supply Chain Security and MLOps were merged into their parent pillars.
- Tracks carry `scope`, `projectId`, `pillarId` and `tier` (mandatory, role, growth). Tiers, deadlines and per-person paths come in step 2.
