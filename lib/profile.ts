import { and, eq } from "drizzle-orm";
import { db, profileEntries, profileFields, profileSections } from "@/lib/db";

/**
 * The company and brand profile: what an organisation knows about itself so a new person can operate and contribute.
 * Sections and fields live here, not in the database, so adding a question never needs a migration. `tier` says how much it
 * matters: "core" sections must be complete before the profile counts as ready; "extra" sections are optional reference.
 * A field marked `required` is what makes a core section complete. A section that does not apply is marked "na" and stops counting.
 */
export type ProfileScope = "company" | "brand";
export type Tier = "core" | "extra";
export type Column = { key: string; label: string };
/** text: one line. long: a paragraph. table: a list of rows with named columns (KPIs, competitors), stored as JSON. custom: added by this company or brand. */
export type Field = { key: string; label: string; hint?: string; required?: boolean; long?: boolean; type?: "text" | "long" | "table"; columns?: Column[]; custom?: boolean; id?: number };
export const typeOf = (f: Field): "text" | "long" | "table" => f.type ?? (f.long ? "long" : "text");
export type Section = { key: string; label: string; why: string; tier: Tier; scopes: ProfileScope[]; fields: Field[]; staleDays: number };

const f = (key: string, label: string, required = false, hint?: string, long = false): Field => ({ key, label, required, hint, long });
const cols = (...labels: string[]): Column[] => labels.map((label) => ({ key: slug(label), label }));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
/** A list of rows with named columns. */
const t = (key: string, label: string, columns: Column[], required = false, hint?: string): Field => ({ key, label, required, hint, type: "table", columns });

export const SECTIONS: Section[] = [
  { key: "identity", label: "Identity", why: "Why we exist and how we sound. Everything else is judged against it.", tier: "core", scopes: ["company", "brand"], staleDays: 365, fields: [
    f("mission", "Mission", true, "One sentence: what we do and for whom.", true), f("vision", "Vision", false, "Where we want to be in five years.", true),
    f("values", "Values", true, "Three to six, each with what it looks like in daily work.", true), f("positioning", "Positioning", true, "Why customers pick us over the alternatives.", true),
    f("voice", "Brand voice", true, "How we write and speak: tone, words we use, words we never use.", true), f("visual_identity", "Visual identity", false, "Where logos, colours and fonts live, and the rules for using them."),
  ] },
  { key: "goals", label: "Goals and KPIs", why: "What good looks like this year, and how we will know.", tier: "core", scopes: ["company", "brand"], staleDays: 120, fields: [
    t("annual_goals", "Goals this year", cols("Goal", "Owner", "Due date"), true), t("kpis", "KPIs", cols("KPI", "Target", "Where it comes from", "Owner"), true, "The numbers we watch."),
    f("review_cadence", "How often goals are reviewed", true), f("non_goals", "What we are deliberately not doing", false, undefined, true),
  ] },
  { key: "organisation", label: "People and structure", why: "Who does what, who decides, and who to ask.", tier: "core", scopes: ["company", "brand"], staleDays: 180, fields: [
    t("structure", "Teams and who leads them", cols("Team", "Lead", "What it is for"), true), t("roles", "Roles and responsibilities", cols("Role", "Responsibilities", "Reports to"), true),
    f("decision_rights", "Who decides what", true, "Spending, hiring, releases, customer exceptions.", true), f("escalation", "Escalation path", true, undefined, true),
    f("hiring", "How we hire", false, undefined, true), f("promotion_policy", "How promotion and demotion work", true, "Criteria, who decides, how it is recorded.", true),
    f("performance", "How performance is reviewed", true, undefined, true), f("leave_conduct", "Leave, working hours and conduct", true, undefined, true),
  ] },
  { key: "offerings", label: "Products and services", why: "What we sell, to whom, for how much, and how it is delivered.", tier: "core", scopes: ["company", "brand"], staleDays: 120, fields: [
    f("catalogue", "What we offer", true, undefined, true), f("pricing", "Pricing and discount rules", true, undefined, true),
    f("delivery", "How work is delivered", true, "Stages, handovers, definition of done.", true), f("roadmap", "Roadmap", false, undefined, true), f("platforms", "Platforms and stack", false, undefined, true),
  ] },
  { key: "customers", label: "Customers and market", why: "Who we serve and who we compete with.", tier: "core", scopes: ["company", "brand"], staleDays: 180, fields: [
    f("segments", "Customer segments", true, undefined, true), f("journey", "Customer journey", false, "From first contact to renewal.", true),
    t("competitors", "Competitors", cols("Competitor", "Website", "How we differ"), true), f("support_model", "How support works", true, "Channels, hours, response times, escalation.", true), f("feedback", "How feedback is collected and used", false, undefined, true),
  ] },
  { key: "legal", label: "Legal and compliance", why: "What we are bound by, and what we must never do.", tier: "core", scopes: ["company"], staleDays: 365, fields: [
    f("entity", "Legal entity, registration and jurisdictions", true, undefined, true), f("regulations", "Regulations that apply", true, "GDPR, sector rules, accessibility law.", true),
    f("data_handling", "Data handling and retention", true, undefined, true), f("contracts", "Where contracts are kept and who signs", true), f("ip_licences", "IP and licences", false, undefined, true), f("insurance", "Insurance", false),
  ] },
  { key: "finance", label: "Finance", why: "How money moves and who may spend it.", tier: "core", scopes: ["company"], staleDays: 180, fields: [
    f("budget_process", "Budget process", true, undefined, true), f("spend_limits", "Spending limits and approvals", true, undefined, true),
    f("invoicing", "Invoicing and payments", true, undefined, true), f("reporting", "Financial reporting", false, undefined, true),
  ] },
  { key: "tools", label: "Tools and access", why: "The systems we run on. Detail lives in the tool access register.", tier: "core", scopes: ["company", "brand"], staleDays: 90, fields: [
    f("access_policy", "Access policy", true, "Who may grant access, how it is requested, how often it is reviewed.", true), f("onboarding_access", "What a new joiner gets on day one", true, undefined, true),
    f("offboarding_access", "What is revoked first when someone leaves", true, undefined, true), f("shared_accounts", "Shared accounts and where their secrets are kept", false, undefined, true),
  ] },
  { key: "ways_of_working", label: "Ways of working", why: "Meetings, communication and how we run delivery.", tier: "core", scopes: ["company", "brand"], staleDays: 180, fields: [
    f("channels", "Which channel for what", true, undefined, true), f("meetings", "Standing meetings and their purpose", true, undefined, true),
    f("process", "Delivery process", true, "Sprints, reviews, release steps.", true), f("retros", "How we review and improve", false, undefined, true), f("documentation", "Where documentation lives and who owns it", true),
  ] },
  { key: "risk", label: "Risk and emergencies", why: "What goes wrong, and what to do when it does.", tier: "core", scopes: ["company", "brand"], staleDays: 180, fields: [
    t("risk_register", "Top risks and owners", cols("Risk", "Owner", "What we do about it"), true), f("incident_response", "Incident response", true, "Who is called, in what order.", true),
    f("continuity", "Business continuity and backups", false, undefined, true), f("crisis_comms", "Crisis communication", false, undefined, true),
  ] },
  { key: "communications", label: "PR and communications", why: "Who speaks for us, and what we say.", tier: "extra", scopes: ["company", "brand"], staleDays: 365, fields: [
    f("spokespeople", "Who may speak publicly", false), f("media", "Press and media approach", false, undefined, true), f("social", "Social accounts and approval flow", false, undefined, true),
  ] },
  { key: "investors", label: "Investors and funding", why: "Who backs us and what we owe them.", tier: "extra", scopes: ["company"], staleDays: 180, fields: [
    f("funding", "Funding stage and sources", false, undefined, true), f("reporting", "Investor reporting", false, undefined, true), f("obligations", "Obligations and consent rights", false, undefined, true),
  ] },
  { key: "custom", label: "Our own questions", why: "Anything only we need to record. Add questions to any section, or here.", tier: "extra", scopes: ["company", "brand"], staleDays: 365, fields: [] },
  { key: "expansion", label: "Expansion", why: "Where we are heading next.", tier: "extra", scopes: ["company", "brand"], staleDays: 180, fields: [
    f("markets", "New markets or products", false, undefined, true), f("localisation", "Localisation needs", false, undefined, true), f("capacity", "What must be true before we grow", false, undefined, true),
  ] },
];

export const sectionsFor = (scope: ProfileScope) => SECTIONS.filter((s) => s.scopes.includes(scope));
export const sectionOf = (key: string) => SECTIONS.find((s) => s.key === key);
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

// ---- values: a table is a list of rows, kept as JSON text ----
export type Row = Record<string, string>;
const MAX_ROWS = 200, MAX_CELL = 500;
/** The rows of a table answer. Plain text saved before the field became a table is shown as one row, in its first column. */
export function rowsOf(f: Field, value: string): Row[] {
  const cols = f.columns ?? [];
  if (!value.trim() || !cols.length) return [];
  try {
    const v = JSON.parse(value);
    if (Array.isArray(v)) return v.filter((r): r is Row => !!r && typeof r === "object").map((r) => Object.fromEntries(cols.map((c) => [c.key, typeof r[c.key] === "string" ? r[c.key] : ""]))).filter((r) => cols.some((c) => r[c.key].trim()));
  } catch { /* not JSON: legacy text */ }
  return [{ ...Object.fromEntries(cols.map((c) => [c.key, ""])), [cols[0].key]: value.trim() }];
}
/** Is this answered? A table needs a row with something in it. */
export const isAnswered = (f: Field, value: string | undefined) => !!value && (typeOf(f) === "table" ? rowsOf(f, value).length > 0 : !!value.trim());
/** The text taught and printed for an answer: a table becomes one line per row. */
export function showValue(f: Field, value: string): string {
  if (typeOf(f) !== "table") return value;
  const cols = f.columns ?? [];
  return rowsOf(f, value).map((r) => "- " + cols.map((c) => (r[c.key].trim() ? c.label + ": " + r[c.key].trim() : "")).filter(Boolean).join("; ")).join("\n");
}
/** What is stored for an answer: text trimmed; a table cleaned to its own columns, empty rows dropped, sizes capped. */
export function cleanValue(f: Field, raw: string): string {
  if (typeOf(f) !== "table") return raw.trim().slice(0, 8000);
  const rows = rowsOf(f, raw).slice(0, MAX_ROWS).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.trim().slice(0, MAX_CELL)])));
  return rows.length ? JSON.stringify(rows) : "";
}

export type SectionState = {
  section: Section;
  fields: Field[]; // the built-in ones plus this company's own, in that order
  status: "open" | "na";
  ownerId: number | null;
  answers: Record<string, string>;
  missing: Field[]; // required fields still empty
  filled: number;
  total: number; // fields counted
  complete: boolean; // nothing required is missing (a section with no required field is complete once anything is answered)
  stale: boolean; // not reviewed within staleDays
  reviewedAt: number | null;
};

/** This company or brand's own questions, by section (retired ones left out), as fields. */
function customFields(scope: ProfileScope, refId: number): Map<string, Field[]> {
  const out = new Map<string, Field[]>();
  for (const r of db.select().from(profileFields).where(and(eq(profileFields.scope, scope), eq(profileFields.refId, refId), eq(profileFields.retired, "no"))).orderBy(profileFields.id).all()) {
    let columns: Column[] | undefined;
    if (r.kind === "table") { try { columns = JSON.parse(r.columns) as Column[]; } catch { columns = undefined; } if (!columns?.length) continue; }
    out.set(r.section, [...(out.get(r.section) ?? []), { key: r.key, label: r.label, hint: r.hint || undefined, required: r.required === "yes", type: r.kind, columns, custom: true, id: r.id }]);
  }
  return out;
}
/** The fields of one section for one company or brand, or null if the section does not exist for that scope. */
export function fieldsFor(scope: ProfileScope, refId: number, section: string): Field[] | null {
  const s = sectionOf(section);
  return s?.scopes.includes(scope) ? [...s.fields, ...(customFields(scope, refId).get(section) ?? [])] : null;
}

/** Every section that applies to this company or brand, with what is answered and what is missing. */
export function profileOf(scope: ProfileScope, refId: number): SectionState[] {
  const entries = db.select().from(profileEntries).where(and(eq(profileEntries.scope, scope), eq(profileEntries.refId, refId))).all();
  const metas = new Map(db.select().from(profileSections).where(and(eq(profileSections.scope, scope), eq(profileSections.refId, refId))).all().map((m) => [m.section, m]));
  const own = customFields(scope, refId);
  return sectionsFor(scope).map((section) => {
    const fields = [...section.fields, ...(own.get(section.key) ?? [])];
    const answers: Record<string, string> = {};
    for (const e of entries) if (e.section === section.key && e.value.trim()) answers[e.field] = e.value;
    const meta = metas.get(section.key);
    const missing = fields.filter((fl) => fl.required && !isAnswered(fl, answers[fl.key]));
    const filled = fields.filter((fl) => isAnswered(fl, answers[fl.key])).length;
    const hasRequired = fields.some((fl) => fl.required);
    const reviewedAt = meta?.reviewedAt ?? null;
    return {
      section, fields, status: meta?.status ?? "open", ownerId: meta?.ownerId ?? null, answers, missing, filled, total: fields.length,
      complete: hasRequired ? !missing.length : filled > 0, stale: reviewedAt == null || now() - reviewedAt > section.staleDays * DAY, reviewedAt,
    };
  });
}

export type Completeness = { percent: number; ready: boolean; core: { done: number; total: number }; extra: { done: number; total: number }; incomplete: SectionState[]; stale: SectionState[] };

/** Percent counts required fields of core sections only (extras never hold anyone back). Ready = every core section complete or marked not applicable. */
export function completenessOf(states: SectionState[]): Completeness {
  const live = states.filter((s) => s.status === "open");
  const core = live.filter((s) => s.section.tier === "core"), extra = live.filter((s) => s.section.tier === "extra");
  const req = core.reduce((n, s) => n + s.fields.filter((fl) => fl.required).length, 0);
  const got = core.reduce((n, s) => n + s.fields.filter((fl) => fl.required).length - s.missing.length, 0);
  return {
    percent: req ? Math.round((got / req) * 100) : 100,
    ready: core.every((s) => s.complete),
    core: { done: core.filter((s) => s.complete).length, total: core.length },
    extra: { done: extra.filter((s) => s.complete).length, total: extra.length },
    incomplete: core.filter((s) => !s.complete),
    stale: live.filter((s) => s.complete && s.stale),
  };
}

/** Save one answer. Returns false for a section or field that does not exist for this company or brand. Caller checks the user may edit it. */
export function saveAnswer(scope: ProfileScope, refId: number, section: string, field: string, value: string, userId: number): boolean {
  const fl = fieldsFor(scope, refId, section)?.find((x) => x.key === field);
  if (!fl) return false;
  const v = cleanValue(fl, value), at = now();
  db.insert(profileEntries).values({ scope, refId, section, field, value: v, updatedBy: userId, updatedAt: at })
    .onConflictDoUpdate({ target: [profileEntries.scope, profileEntries.refId, profileEntries.section, profileEntries.field], set: { value: v, updatedBy: userId, updatedAt: at } }).run();
  return true;
}

/** Mark a section reviewed (still true), not applicable, or applicable again; optionally name its owner. */
export function saveSectionMeta(scope: ProfileScope, refId: number, section: string, userId: number, opts: { status?: "open" | "na"; ownerId?: number | null; reviewed?: boolean }): boolean {
  if (!sectionOf(section)?.scopes.includes(scope)) return false;
  const set: Partial<typeof profileSections.$inferInsert> = {};
  if (opts.status) set.status = opts.status;
  if (opts.ownerId !== undefined) set.ownerId = opts.ownerId;
  if (opts.reviewed) { set.reviewedAt = now(); set.reviewedBy = userId; }
  if (!Object.keys(set).length) return true; // nothing to change; an empty update is a SQL error
  db.insert(profileSections).values({ scope, refId, section, ...set }).onConflictDoUpdate({ target: [profileSections.scope, profileSections.refId, profileSections.section], set }).run();
  return true;
}
