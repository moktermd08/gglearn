import { and, eq } from "drizzle-orm";
import { db, profileFields, profileSections } from "@/lib/db";
import { type ProfileScope, profileOf, sectionOf } from "@/lib/profile";
import { type FieldSpec, MAX_CUSTOM, canEditProfile, createField } from "@/lib/profileAdmin";
import type { SetupState } from "@/lib/setup";

/**
 * Starter templates by type of organisation. A template does two things and no more: it adds the questions that type of organisation
 * usually has to answer (as the company's own questions, so it can change or remove them), and marks sections that rarely apply as "does
 * not apply". It never fills in an answer and never touches a section that already has answers: what the organisation says is its own.
 */
type Q = FieldSpec & { section: string };
export type Template = { key: string; label: string; blurb: string; questions: Q[]; notApplicable: string[] };

const q = (section: string, label: string, kind: FieldSpec["kind"], o: { columns?: string; hint?: string; required?: boolean } = {}): Q =>
  ({ section, label, kind, columns: o.columns?.split(","), hint: o.hint, required: o.required });

export const TEMPLATES: Template[] = [
  {
    key: "agency", label: "Agency or client-services business", blurb: "Sells time and expertise to clients: design, marketing, development, consulting.", notApplicable: [],
    questions: [
      q("offerings", "Service lines", "table", { columns: "Service, What the client gets, Price or range, Typical lead time", required: true }),
      q("offerings", "How a new client is onboarded", "long"),
      q("offerings", "How a change of scope is handled", "long", { required: true, hint: "Who agrees it, how it is priced, how it is recorded." }),
      q("customers", "Key clients", "table", { columns: "Client, Since, Main contact, Renewal date" }),
      q("customers", "Client reporting", "long", { hint: "What is reported, how often, and by whom." }),
      q("ways_of_working", "Project stages and sign-offs", "long", { required: true }),
      q("ways_of_working", "Time tracking and utilisation", "long"),
      q("finance", "Billing model", "long", { required: true, hint: "Retainer, fixed price, time and materials, and when invoices go out." }),
      q("finance", "Rate card", "table", { columns: "Role, Rate, Unit" }),
      q("legal", "Who owns the work delivered", "long", { required: true, hint: "IP ownership and licences, and what a client may reuse." }),
      q("legal", "Contract terms we always include", "long"),
      q("risk", "Reliance on a few clients or people", "long"),
    ],
  },
  {
    key: "software", label: "Software product or SaaS", blurb: "Sells a product people use, usually on subscription.", notApplicable: [],
    questions: [
      q("offerings", "Plans and pricing", "table", { columns: "Plan, Price, Limits, Who it is for", required: true }),
      q("offerings", "Product areas and who owns each", "table", { columns: "Area, Owner, Status" }),
      q("customers", "Support tiers and response times", "table", { columns: "Tier, Response time, Hours, Channel", required: true }),
      q("customers", "Why customers leave", "long", { hint: "Reasons we track, and what we do about them." }),
      q("ways_of_working", "How a release goes out", "long", { required: true, hint: "Review, testing, deployment, rollback, announcement." }),
      q("ways_of_working", "On-call and incident rota", "long", { required: true }),
      q("ways_of_working", "Environments", "long", { hint: "What exists besides production, and who may change each." }),
      q("legal", "Where the terms of service and privacy policy are", "text", { required: true }),
      q("legal", "Sub-processors and data processing terms", "long", { required: true }),
      q("risk", "Security certifications and audits", "long"),
      q("finance", "Who watches cloud and tooling costs", "long"),
    ],
  },
  {
    key: "retail", label: "Retail or e-commerce", blurb: "Sells physical goods, in a shop, online, or both.", notApplicable: [],
    questions: [
      q("offerings", "Product categories", "table", { columns: "Category, Margin target, Main supplier, Stock policy", required: true }),
      q("offerings", "Delivery options", "table", { columns: "Option, Carrier, Cost, Time", required: true }),
      q("offerings", "Returns and refunds", "long", { required: true, hint: "The rule, the time limit, who pays the return." }),
      q("customers", "Promotions and loyalty rules", "long"),
      q("ways_of_working", "Stock ordering and reorder points", "long", { required: true }),
      q("ways_of_working", "Peak-season plan", "long"),
      q("finance", "Payment providers and when money arrives", "long", { required: true }),
      q("finance", "Stock counts and write-offs", "long"),
      q("legal", "Consumer rights we must follow", "long", { required: true }),
      q("legal", "Product safety and labelling", "long"),
      q("risk", "What happens if a main supplier fails", "long"),
    ],
  },
  {
    key: "solo", label: "Solo freelancer or consultant", blurb: "One person selling their own work. Fewer sections apply; the risks are different.", notApplicable: ["investors", "expansion"],
    questions: [
      q("offerings", "Services and rates", "table", { columns: "Service, Rate, Minimum engagement", required: true }),
      q("offerings", "How I take on a client", "long"),
      q("customers", "Clients and status", "table", { columns: "Client, Work, Status, Next step" }),
      q("ways_of_working", "A normal week", "long"),
      q("ways_of_working", "Who can pick up my work if I am unavailable", "long", { required: true, hint: "A named person, where the files and logins are, and what they would do first." }),
      q("finance", "Tax and VAT set-up", "long", { required: true }),
      q("finance", "Invoice terms and what happens when payment is late", "long", { required: true }),
      q("legal", "Where my contract template is", "text", { required: true }),
      q("risk", "Single points of failure", "long", { hint: "Illness, a lost laptop, one client making up most of the income." }),
    ],
  },
];

export const templateOf = (key: string) => TEMPLATES.find((t) => t.key === key);

export type TemplatePreview = {
  add: Q[]; // questions that would be added
  have: number; // already there, left alone
  skipped: number; // for a section that does not apply to a brand
  markNa: string[]; // section labels that would be marked as not applying
  room: number; // how many more own questions this company or brand may keep
};

/** What applying a template would do, without doing it. */
export function previewTemplate(scope: ProfileScope, refId: number, key: string): TemplatePreview | null {
  const t = templateOf(key);
  if (!t) return null;
  const mine = db.select().from(profileFields).where(and(eq(profileFields.scope, scope), eq(profileFields.refId, refId), eq(profileFields.retired, "no"))).all();
  const add: Q[] = [];
  let have = 0, skipped = 0;
  for (const x of t.questions) {
    if (!sectionOf(x.section)?.scopes.includes(scope)) { skipped++; continue; }
    if (mine.some((m) => m.section === x.section && m.label === x.label)) have++; else add.push(x);
  }
  const states = new Map(profileOf(scope, refId).map((s) => [s.section.key, s]));
  const markNa = t.notApplicable.filter((k) => { const s = states.get(k); return s && s.status === "open" && s.filled === 0; }).map((k) => sectionOf(k)!.label);
  return { add, have, skipped, markNa, room: MAX_CUSTOM - mine.length };
}

export function applyTemplate(me: { id: number; role: "admin" | "manager" | "learner" }, scope: ProfileScope, refId: number, key: string): SetupState {
  if (!canEditProfile(me, scope, refId)) return { error: "You do not run this company or brand." };
  const t = templateOf(key), pv = previewTemplate(scope, refId, key);
  if (!t || !pv) return { error: "Pick a template." };
  if (pv.add.length > pv.room) return { error: `This would add ${pv.add.length} questions but there is room for ${pv.room}. Remove some of your own questions first.` };
  let added = 0;
  try {
    db.transaction(() => { // all or nothing: a template is never half applied
      for (const x of pv.add) { const e = createField(scope, refId, x.section, x, me.id); if (e) throw new Error(e); added++; }
    });
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not apply the template." }; }
  const na = new Set(pv.markNa);
  for (const k of t.notApplicable) {
    const s = sectionOf(k);
    if (s && na.has(s.label)) db.insert(profileSections).values({ scope, refId, section: k, status: "na" }).onConflictDoUpdate({ target: [profileSections.scope, profileSections.refId, profileSections.section], set: { status: "na" } }).run();
  }
  return { done: `${t.label}: added ${added} question${added === 1 ? "" : "s"}${pv.have ? `, ${pv.have} already there` : ""}${pv.markNa.length ? `, marked ${pv.markNa.join(" and ")} as not applying` : ""}.` };
}
