/**
 * Seeds the company structure (companies -> brands -> projects) and the pillar/topic map, then tags the
 * existing tracks with scope, project, pillar and tier. Safe to re-run: existing rows are updated in place,
 * nothing is deleted.
 *   npm run seed:structure
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { brands, companies, db, pillars, projects, topics, tracks } from "../lib/db";

const COMPANIES: [slug: string, name: string, tagline: string][] = [
  ["guru-graphics-limited", "Guru Graphics Limited", "Design, web and products"],
  ["moksy-limited", "Moksy Limited", "AI that turns ideas into build-ready plans"],
];

// brand slug -> owning company slug. Brands missing here (shared academy content, M Hossain) have no company.
const BRAND_COMPANY: Record<string, string> = {
  gglink: "guru-graphics-limited",
  "guru-graphics": "guru-graphics-limited",
  "moksy-ai": "moksy-limited",
};

const PROJECTS: [slug: string, name: string, kind: "website" | "product" | "internal", url: string, brand: string | null, description: string][] = [
  ["gglink-co-uk", "gglink.co.uk", "website", "https://gglink.co.uk", "gglink", "GGLink company site"],
  ["gurugraphics-co-uk", "gurugraphics.co.uk", "website", "https://gurugraphics.co.uk", "guru-graphics", "Guru Graphics company site"],
  ["moksy-ai-site", "moksy.ai", "website", "https://moksy.ai", "moksy-ai", "Moksy AI website and platform"],
  ["mhossain-uk", "mhossain.uk", "website", "https://mhossain.uk", "mhossain", "Personal site and founder content"],
  ["ggsocial", "GGSocial", "product", "", null, "Manages social media for every company and brand (Guru Graphics, Moksy AI and others)"],
  ["ggmoney", "GGMoney", "product", "", null, "Shared money product used across the companies and brands"],
  ["gglearn", "GGLearn", "internal", "https://gglearn.gglink.co.uk", null, "This academy, used by every company and brand"],
];

// track slug -> project slug (these tracks teach one project, so scope = project)
const TRACK_PROJECT: Record<string, string> = {
  "moksy-product": "moksy-ai-site",
  "moksy-platform-services": "moksy-ai-site",
  "moksy-patterns-automation": "moksy-ai-site",
  "ggsocial-product": "ggsocial",
  "ggmoney-product": "ggmoney",
  "gglearn-product": "gglearn",
  "mhossain-content": "mhossain-uk",
};

// track slug -> pillar slug
const TRACK_PILLAR: Record<string, string> = {
  "sdlc-discovery": "strategy", "sdlc-requirements": "strategy", "sdlc-architecture": "architecture",
  "sdlc-frontend": "code", "sdlc-backend": "code", "sdlc-database": "database", "sdlc-security": "security",
  "sdlc-testing": "testing", "sdlc-devops": "deployment", "sdlc-launch": "deployment",
  "governance-compliance": "compliance", "security-operations": "security", "servers-infrastructure": "hardware",
  "ai-llm-practice": "pattern", "data-analytics": "database", "payments-billing": "finance",
  "communications-email": "content", "delivery-management": "strategy", "people-operations": "actors",
  "guru-brand-identity": "experience", "guru-design-system": "experience", "guru-design-tools": "experience",
  "gglink-web-delivery": "implementation", "gglink-hosting-maintenance": "maintenance", "gglink-seo-content": "content",
  "gglink-ai-automation": "integration", "gglink-sales-support": "sales", "mhossain-content": "marketing",
  "tech-data-stores": "database", "tech-cloud-devops": "deployment", "tech-testing": "testing",
};

// company-wide policy that everyone in scope must pass
const MANDATORY = new Set(["governance-compliance"]);
// shared academy content: applies to every staff member, not tied to one company
const SHARED_BRANDS = new Set(["foundations", "titan-academy", "software-lifecycle", "sample-brand"]);
const PERSONAL_BRANDS = new Set(["mhossain"]);
// brands whose tracks with a job role set are required for that role (the rest stay optional growth tracks)
const ROLE_REQUIRED_BRANDS = new Set(["gglink", "guru-graphics", "moksy-ai", "software-lifecycle"]);

// What a new customer learns first. Empty until questions are authored, so nobody is required to pass an empty exam.
// [slug, name, brand, project, description]
const CUSTOMER_TRACKS: [string, string, string, string | null, string][] = [
  ["moksy-customer-start", "Getting started with Moksy", "moksy-ai", "moksy-ai-site", "Turn your first idea into a build-ready plan."],
  ["ggsocial-customer-start", "Getting started with GGSocial", "gglink", "ggsocial", "Connect your accounts and plan your first posts."],
  ["ggmoney-customer-start", "Getting started with GGMoney", "gglink", "ggmoney", "Set up payments and understand your statements."],
  ["gglearn-customer-start", "Getting started with GGLearn", "gglink", "gglearn", "Find your path, take your first exam, earn your first certificate."],
  ["gglink-customer-start", "Working with GGLink", "gglink", null, "How a GGLink project runs, what we need from you and how to reach us."],
  ["guru-customer-start", "Working with Guru Graphics", "guru-graphics", null, "How design and brand work runs, from brief to handover."],
];

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const counts = { companies: 0, projects: 0, pillars: 0, topics: 0, tracks: 0, customerTracks: 0 };

for (const [slug, name, tagline] of COMPANIES) {
  if (!db.select().from(companies).where(eq(companies.slug, slug)).get()) {
    db.insert(companies).values({ slug, name, tagline }).run();
    counts.companies++;
  }
}
const companyId = (slug: string) => db.select().from(companies).where(eq(companies.slug, slug)).get()!.id;

for (const [brandSlug, companySlug] of Object.entries(BRAND_COMPANY)) {
  db.update(brands).set({ companyId: companyId(companySlug), kind: "company" }).where(eq(brands.slug, brandSlug)).run();
}
for (const slug of SHARED_BRANDS) db.update(brands).set({ kind: "shared" }).where(eq(brands.slug, slug)).run();
for (const slug of PERSONAL_BRANDS) db.update(brands).set({ kind: "personal" }).where(eq(brands.slug, slug)).run();

for (const [slug, name, kind, url, brandSlug, description] of PROJECTS) {
  // no brand = a shared product that serves every company and brand (GGSocial, GGMoney, GGLearn)
  const brand = brandSlug ? db.select().from(brands).where(eq(brands.slug, brandSlug)).get() : null;
  if (brandSlug && !brand) throw new Error(`brand ${brandSlug} missing, run npm run seed:curriculum first`);
  const values = { name, kind, url, description, brandId: brand?.id ?? null, companyId: brand?.companyId ?? null };
  if (db.select().from(projects).where(eq(projects.slug, slug)).get()) {
    db.update(projects).set(values).where(eq(projects.slug, slug)).run();
  } else {
    db.insert(projects).values({ slug, ...values }).run();
    counts.projects++;
  }
}

type PillarFile = { slug: string; name: string; topics: string[] }[];
const file: PillarFile = JSON.parse(readFileSync(path.join(process.cwd(), "content/structure/pillars.json"), "utf8"));
file.forEach((p, i) => {
  let row = db.select().from(pillars).where(eq(pillars.slug, p.slug)).get();
  if (row) db.update(pillars).set({ name: p.name, sort: i + 1 }).where(eq(pillars.id, row.id)).run();
  else { row = db.insert(pillars).values({ slug: p.slug, name: p.name, sort: i + 1 }).returning().get(); counts.pillars++; }
  p.topics.forEach((name, j) => {
    const slug = `${p.slug}-${slugify(name)}`;
    if (db.select().from(topics).where(eq(topics.slug, slug)).get()) {
      db.update(topics).set({ name, sort: j + 1, pillarId: row!.id }).where(eq(topics.slug, slug)).run();
    } else {
      db.insert(topics).values({ pillarId: row!.id, slug, name, sort: j + 1 }).run();
      counts.topics++;
    }
  });
});

const brandById = new Map(db.select().from(brands).all().map((b) => [b.id, b]));
for (const t of db.select().from(tracks).all()) {
  const projSlug = TRACK_PROJECT[t.slug];
  const proj = projSlug ? db.select().from(projects).where(eq(projects.slug, projSlug)).get() : undefined;
  const pillar = TRACK_PILLAR[t.slug] ? db.select().from(pillars).where(eq(pillars.slug, TRACK_PILLAR[t.slug])).get() : undefined;
  const brand = brandById.get(t.brandId);
  const scope = proj ? "project" : brand?.kind === "shared" ? "company" : "brand";
  // an admin's choices win: once the policy is edited in the app, the seed only keeps the structure tags fresh
  const tier = t.policySource === "admin" || t.audience === "customer" ? t.tier
    : MANDATORY.has(t.slug) ? "mandatory"
    : t.roles && brand && ROLE_REQUIRED_BRANDS.has(brand.slug) ? "role" : "growth";
  db.update(tracks).set({ scope, projectId: proj?.id ?? null, pillarId: pillar?.id ?? t.pillarId, tier }).where(eq(tracks.id, t.id)).run();
  counts.tracks++;
}

const implementation = db.select().from(pillars).where(eq(pillars.slug, "implementation")).get();
for (const [slug, name, brandSlug, projSlug, description] of CUSTOMER_TRACKS) {
  const brand = db.select().from(brands).where(eq(brands.slug, brandSlug)).get();
  if (!brand) throw new Error(`brand ${brandSlug} missing`);
  const proj = projSlug ? db.select().from(projects).where(eq(projects.slug, projSlug)).get() : undefined;
  const base = { brandId: brand.id, name, kind: "product" as const, description, scope: proj ? ("project" as const) : ("brand" as const), projectId: proj?.id ?? null, pillarId: implementation?.id ?? null };
  const have = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  if (have) db.update(tracks).set(base).where(eq(tracks.id, have.id)).run();
  else { db.insert(tracks).values({ slug, ...base, audience: "customer", tier: "mandatory" }).run(); counts.customerTracks++; }
}

console.log(`structure seeded: +${counts.companies} companies, +${counts.projects} projects, +${counts.pillars} pillars, +${counts.topics} topics, ${counts.tracks} tracks tagged, +${counts.customerTracks} customer tracks`);
