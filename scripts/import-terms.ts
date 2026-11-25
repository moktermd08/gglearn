/**
 * Loads the vocabulary card files into the term bank, so a super admin can edit them in the app.
 *   npm run import:terms
 *
 * A card file becomes a term bank by carrying a "termBank" block:
 *   "termBank": { "name": "Office core", "description": "...", "roles": "cto,cio", "order": 3, "headings": { "<group key>": "Heading" } }
 * `roles` is a comma separated list of lower case job roles (empty = everyone); `headings` names each of the file's groups as people see it; `order` sorts the banks.
 * Card files without a "termBank" block are other tracks and are left alone. Adding a bank is adding a file: nothing here changes.
 *
 * Safe to run again: a bank or a term that already exists is left exactly as it is (an admin may have edited it); only missing ones are added.
 * Each card becomes one term: the subject, its first "says" line as the meaning ("It ..."), its other "says" lines as facts, its "use" and "not" lines, its tier,
 * its group heading and its "like" list. Terms already loaded get the facts, use and mistakes they are missing, and a bank gets any role it is missing: nothing already
 * set (and nothing an admin has edited) is overwritten or removed.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, termBanks, terms } from "@/lib/db";

type Card = { group: string; subject: string; tier: number; says: string[]; use?: string; not?: string[]; like?: string[] };
type BankMeta = { name: string; description: string; roles: string; order?: number; headings: Record<string, string> };
type Spec = { slug: string; cards: Card[]; termBank?: BankMeta };

const dir = path.join(process.cwd(), "content", "cards");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();
const found: { slug: string; spec: Spec; meta: BankMeta }[] = [];
for (const f of files) {
  const spec: Spec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  if (spec.termBank) found.push({ slug: f.slice(0, -5), spec, meta: spec.termBank });
}
found.sort((a, b) => (a.meta.order ?? 1000) - (b.meta.order ?? 1000) || a.slug.localeCompare(b.slug));

const list = (s: string) => s.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
let banks = 0, added = 0, kept = 0, filled = 0, widened = 0;
found.forEach(({ slug, spec, meta }, i) => {
  let bank = db.select().from(termBanks).where(eq(termBanks.slug, slug)).get();
  if (!bank) { bank = db.insert(termBanks).values({ slug, name: meta.name, description: meta.description, roles: list(meta.roles).join(","), sortOrder: meta.order ?? 100 + i }).returning().get(); banks++; }
  else {
    const have = list(bank.roles), want = list(meta.roles);
    const missing = want.filter((r) => !have.includes(r));
    if (have.length && missing.length) { db.update(termBanks).set({ roles: [...have, ...missing].join(",") }).where(eq(termBanks.id, bank.id)).run(); widened++; }
  }
  const existing = new Map(db.select().from(terms).where(and(eq(terms.bankId, bank.id), isNull(terms.ownerUserId))).all().map((r) => [r.term.toLowerCase(), r]));
  spec.cards.forEach((c, n) => {
    const facts = JSON.stringify(c.says.slice(1)), useWhen = c.use ?? "", mistakes = JSON.stringify(c.not ?? []);
    const cur = existing.get(c.subject.toLowerCase());
    if (cur) {
      kept++;
      const set: Partial<typeof terms.$inferInsert> = {};
      if (cur.facts === "[]" && facts !== "[]") set.facts = facts;
      if (cur.useWhen === "" && useWhen) set.useWhen = useWhen;
      if (cur.mistakes === "[]" && mistakes !== "[]") set.mistakes = mistakes;
      if (Object.keys(set).length) { db.update(terms).set(set).where(eq(terms.id, cur.id)).run(); filled++; }
      return;
    }
    db.insert(terms).values({ bankId: bank!.id, groupName: meta.headings[c.group] ?? c.group, term: c.subject, meaning: `It ${c.says[0]}`, tier: c.tier, similar: JSON.stringify(c.like ?? []), facts, useWhen, mistakes, sortOrder: n }).run();
    added++;
  });
});
const total = db.select({ n: sql<number>`count(*)` }).from(terms).get()!.n;
console.log(`Banks in the card files: ${found.length}. Banks added: ${banks}. Terms added: ${added}. Already there: ${kept} (${filled} filled in with facts, use or mistakes). Banks given more roles: ${widened}. Terms in all: ${total}.`);
