/**
 * Loads the vocabulary card files (content/cards/<slug>.json) into the term bank, so a super admin can edit them in the app.
 *   npm run import:terms
 *
 * Safe to run again: a bank or a term that already exists is left exactly as it is (an admin may have edited it); only missing ones are added.
 * Each card becomes one term: the subject, its first "says" line as the meaning ("It ..."), its tier, its group heading and its "like" list.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, termBanks, terms } from "@/lib/db";

type Card = { group: string; subject: string; tier: number; says: string[]; like?: string[] };
type Spec = { slug: string; cards: Card[] };

const BANKS: { slug: string; name: string; description: string; roles: string; headings: Record<string, string> }[] = [
  { slug: "office-core", name: "Office core", description: "The everyday workplace words anyone in any office role should know.", roles: "",
    headings: { com: "Communication", meet: "Meetings", proj: "Projects and planning", rep: "Reporting and information", ppl: "People and teams", work: "Working patterns", money: "Money and admin", cust: "Customers, products and services", tool: "Tools and files", rule: "Rules, risk and quality" } },
  { slug: "civil-service-core", name: "Civil Service core", description: "What a civil servant needs to know, from the first day to the Senior Civil Service.", roles: "civil service",
    headings: { cs: "Civil Service basics", grade: "Grades and careers", min: "Working with ministers", parl: "Parliament", pol: "Policy making", money: "Public money", legal: "Legal and accountability", del: "Delivery and digital", info: "Information and security", lead: "Senior leadership and structure" } },
  { slug: "full-stack-core", name: "Full stack developer core", description: "The terms a full stack developer needs, from the web basics to architecture and reliability.", roles: "full stack developer",
    headings: { web: "Web fundamentals", front: "Front end", api: "Back end and APIs", data: "Databases", sec: "Web security", vc: "Version control and teamwork", test: "Testing and code quality", ship: "Build and deployment", run: "Reliability and performance", arch: "Delivery and architecture" } },
  { slug: "cto-core", name: "CTO core", description: "The terms a technology leader needs, from engineering manager to CTO.", roles: "cto",
    headings: { strat: "Technology strategy", arch: "Architecture", org: "Delivery and organisation", ppl: "People leadership", fin: "Finance for technology leaders", risk: "Risk and resilience", gov: "Governance and legal", ven: "Vendors and commercial", data: "Data and AI", exec: "Board and executive" } },
  { slug: "finance-admin-core", name: "Financial admin core", description: "The terms a finance or accounts team member needs, from accounts assistant to head of finance.", roles: "accounting",
    headings: { book: "Bookkeeping", arap: "Receivables and payables", bank: "Banking and cash", tax: "Tax and payroll", stmt: "Financial statements", close: "Month-end and year-end", mgmt: "Budgeting and management accounting", ctl: "Financial control and audit", sys: "Finance systems and compliance", lead: "Finance leadership" } },
  { slug: "security-core", name: "Security core", description: "The terms a security professional needs, from junior analyst to CISO.", roles: "security analyst,ciso,security",
    headings: { fund: "Security fundamentals", iam: "Identity and access", net: "Network security", app: "Application security", crypto: "Cryptography", atk: "Attacks and threats", ops: "Security operations", ir: "Incident response", grc: "Governance, risk and compliance", assure: "Security assurance" } },
];

let banks = 0, added = 0, kept = 0;
BANKS.forEach((b, i) => {
  const file = path.join(process.cwd(), "content", "cards", `${b.slug}.json`);
  if (!fs.existsSync(file)) { console.log(`skip ${b.slug}: no card file`); return; }
  const spec: Spec = JSON.parse(fs.readFileSync(file, "utf8"));
  let bank = db.select().from(termBanks).where(eq(termBanks.slug, b.slug)).get();
  if (!bank) { bank = db.insert(termBanks).values({ slug: b.slug, name: b.name, description: b.description, roles: b.roles, sortOrder: i }).returning().get(); banks++; }
  const have = new Set(db.select({ t: terms.term }).from(terms).where(and(eq(terms.bankId, bank.id), isNull(terms.ownerUserId))).all().map((r) => r.t.toLowerCase()));
  spec.cards.forEach((c, n) => {
    if (have.has(c.subject.toLowerCase())) { kept++; return; }
    const meaning = `It ${c.says[0]}`;
    db.insert(terms).values({ bankId: bank!.id, groupName: b.headings[c.group] ?? c.group, term: c.subject, meaning, tier: c.tier, similar: JSON.stringify(c.like ?? []), sortOrder: n }).run();
    added++;
  });
});
const total = db.select({ n: sql<number>`count(*)` }).from(terms).get()!.n;
console.log(`Banks added: ${banks}. Terms added: ${added}. Already there: ${kept}. Terms in all: ${total}.`);
