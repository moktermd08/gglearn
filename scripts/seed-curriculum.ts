/**
 * Seeds the curriculum map in docs/curriculum.md: company brands and empty tracks
 * (no questions yet). Safe to re-run: existing brands and tracks are left as they are.
 *   npm run seed:curriculum
 */
import { db, brands, tracks } from "../lib/db";
import { eq } from "drizzle-orm";

type Kind = "subject" | "product" | "service" | "tool" | "technology" | "process";
type T = [slug: string, name: string, kind: Kind, roles: string, description: string];

const BRANDS: [slug: string, name: string, tagline: string][] = [
  ["gglink", "GGLink", "Agency umbrella: web, products and services"],
  ["guru-graphics", "Guru Graphics", "Design and branding"],
  ["moksy-ai", "Moksy AI", "AI platform that automates the software lifecycle"],
  ["mhossain", "M Hossain", "Founder content and personal brand"],
  ["software-lifecycle", "Software Lifecycle", "End-to-end delivery: plan, build, secure, ship, run"],
];

const TRACKS: Record<string, T[]> = {
  "moksy-ai": [
    ["moksy-product", "Moksy", "product", "", "Journeys, reviewer/customer/staff roles, MXP/MOX, patterns, reports, the 1:99 goal."],
    ["moksy-meta-marketing", "Moksy on Meta", "process", "social media manager,marketing", "Using Facebook and Instagram ads in line with Moksy's documented economics, positioning, content motion, brand rules and claims."],
    ["moksy-support", "Moksy support", "process", "support,customer success", "Answering Moksy customers from its own published pages: contact routes, plans and limits, MOX and refunds, reviews, error messages, trust and the terms."],
    ["moksy-brand-voice", "Moksy brand & voice", "process", "social media manager,content writer,marketing,designer", "How Moksy names things, looks and sounds: tagline, vocabulary, colour, type, tone and spelling."],
    ["moksy-platform-services", "Moksy platform services", "subject", "developer", "The foundation services: gateway, auth, permissions, projects, requirements, payments, events, jobs, audit."],
    ["moksy-patterns-automation", "Patterns and automation", "process", "developer", "Decisions as patterns, flows, and measuring the machine share."],
  ],
  gglink: [
    ["ggsocial-product", "GGSocial", "product", "", "Features, admin, moderation, support playbook."],
    ["ggmoney-product", "GGMoney", "product", "", "Money flows, ledger, compliance, support."],
    ["gglearn-product", "GGLearn", "product", "", "Tracks, levels, competitions, certificates, admin and deploy."],
    ["gglink-web-delivery", "Web design and build", "service", "", "Scoping, pricing tiers, delivery steps, QA checklist, handover."],
    ["gglink-hosting-maintenance", "Hosting and maintenance", "service", "developer", "Hosting, backups, SSL, updates, uptime and support."],
    ["gglink-server-operations", "GGLink server operations", "process", "developer", "How GGLink's own apps are hosted, deployed, backed up and kept healthy: Apache, Cloudflare, pm2, Docker, deploy scripts and their traps."],
    ["gglink-seo-content", "SEO and content", "service", "", "Content operations, SEO, localisation."],
    ["gglink-ai-automation", "AI automation and integrations", "service", "developer", "Automating client workflows and connecting their tools."],
    ["gglink-sales-support", "Sales and support", "process", "sales", "Discovery calls, quoting, support runbooks."],
  ],
  "guru-graphics": [
    ["guru-graphics-sales", "Selling Guru Graphics", "process", "sales", "Who Guru Graphics serves, what it sells and how: brand identity engagements for enterprise and the public sector, scoped and quoted by proposal."],
    ["guru-brand-identity", "Brand identity", "service", "designer", "Logo, voice, palette, guidelines."],
    ["guru-design-system", "Design systems and UI/UX", "process", "designer", "Components, accessibility, responsive design."],
    ["guru-design-tools", "Design and prototyping tools", "tool", "designer", "Figma, Canva, diagrams and presentations."],
  ],
  mhossain: [
    ["mhossain-content", "Founder content", "process", "", "Voice, post formats and the approve-then-post workflow."],
  ],
  "software-lifecycle": [
    ["sdlc-discovery", "1. Discovery and planning", "process", "", "Problem, audience, goals, scope, budget, timeline."],
    ["sdlc-requirements", "2. Requirements analysis", "process", "", "Functional and non-functional requirements, roles, compliance, integrations."],
    ["sdlc-architecture", "3. System design and architecture", "process", "developer", "Stack, components, data flow, hosting, scaling, API style."],
    ["sdlc-frontend", "4. Frontend development", "process", "developer", "UI framework, design system, responsive, accessibility, theming."],
    ["sdlc-backend", "5. Backend development", "process", "developer", "APIs, business logic, jobs, queues, caching, search, storage."],
    ["sdlc-database", "6. Database design", "process", "developer", "Modelling, indexing, migrations, backups, archival."],
    ["sdlc-security", "7. Security and authentication", "process", "developer", "Auth flows, encryption, RBAC, MFA, audit logging, privacy."],
    ["sdlc-testing", "8. Testing and QA", "process", "developer", "Strategy, unit and e2e tests, coverage, performance, accessibility."],
    ["sdlc-devops", "9. CI/CD and DevOps", "process", "developer", "Pipelines, environments, containers, monitoring, alerting."],
    ["sdlc-launch", "10. Launch and post-launch", "process", "", "Go-live checklist, support model, feedback loop, analytics, versioning."],
    ["governance-compliance", "Governance and compliance", "process", "", "Policies, approvals, audit trails, GDPR/HIPAA/PCI/FERPA, risk scoring."],
    ["security-operations", "Security operations", "process", "developer", "Identity, secrets, threat modelling, incident response."],
    ["servers-infrastructure", "Servers and infrastructure", "process", "developer", "Linux, web servers, Docker, backups, SSL, deploys, health checks."],
    ["ai-llm-practice", "AI and LLM practice", "process", "developer", "Prompts, memory, evaluation, policy, agents, MCP."],
    ["data-analytics", "Data and analytics", "process", "", "Event data, usage metering, reporting, dashboards."],
    ["payments-billing", "Payments and subscriptions", "process", "", "Billing, ledger, subscriptions, refunds."],
    ["communications-email", "Communications and email", "process", "", "Notifications, templates, deliverability."],
    ["delivery-management", "Project delivery management", "process", "manager", "Estimates, handover, client continuity."],
    ["people-operations", "People and operations", "process", "manager", "Roles, onboarding, staff operations."],
    ["tools-plan-design", "Tools: plan and design", "tool", "", "Roadmaps, research, docs, wikis, diagrams, prototyping."],
    ["tools-build-ship", "Tools: build and ship", "tool", "developer", "Code hosting, CI, issue trackers, cloud, monitoring, identity."],
    ["tools-business", "Tools: business and growth", "tool", "", "CRM, helpdesk, billing, marketing, scheduling, team chat, automation hubs."],
    ["tech-data-stores", "Technologies: data stores", "technology", "developer", "PostgreSQL, Redis, SQLite and Drizzle, vector databases."],
    ["tech-cloud-devops", "Technologies: cloud and DevOps", "technology", "developer", "Kubernetes, Terraform, Nginx, GitHub Actions."],
    ["tech-testing", "Technologies: testing", "technology", "developer", "Playwright, Jest, test strategy."],
    ["tech-graphql", "Technologies: GraphQL", "technology", "developer", "GraphQL schemas, queries, mutations, and when to choose it over REST."],
    ["tech-tailwind", "Technologies: Tailwind CSS", "technology", "developer", "Utility-first styling as used in GGLearn and GGSocial."],
    ["tech-drupal", "Technologies: Drupal", "technology", "developer", "Drupal as a CMS option for client builds."],
  ],
};

let newBrands = 0, newTracks = 0;
for (const [slug, name, tagline] of BRANDS) {
  if (!db.select().from(brands).where(eq(brands.slug, slug)).get()) {
    db.insert(brands).values({ slug, name, tagline }).run();
    newBrands++;
  }
}
for (const [brandSlug, list] of Object.entries(TRACKS)) {
  const brand = db.select().from(brands).where(eq(brands.slug, brandSlug)).get();
  if (!brand) throw new Error(`brand missing: ${brandSlug}`);
  for (const [slug, name, kind, roles, description] of list) {
    if (db.select().from(tracks).where(eq(tracks.slug, slug)).get()) continue;
    db.insert(tracks).values({ brandId: brand.id, slug, name, kind, roles, description }).run();
    newTracks++;
  }
}
console.log(`curriculum seeded: ${newBrands} new brands, ${newTracks} new tracks`);
