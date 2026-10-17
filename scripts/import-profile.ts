/**
 * Loads draft answers into the company and brand profiles from a JSON file.
 *   npm run import:profile -- content/profiles/moksy.json [--dry] [--overwrite] [--as admin@example.com]
 * File shape: { entries: [{ scope: "company" | "brand", slug, sections: { <section>: { <field>: "text" | [ {column: "text"} ] } } }] }.
 * Never replaces an answer someone already wrote unless --overwrite is given; empty values are skipped. Nothing is marked reviewed,
 * so every imported section still shows as due for review. The answers are attributed to --as (default: the first admin).
 */
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { brands, companies, db, profileEntries, users } from "../lib/db";
import { fieldsFor, isAnswered, saveAnswer } from "../lib/profile";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? undefined : process.argv[i + 1]; };
const flag = (n: string) => process.argv.includes(`--${n}`);
const file = process.argv.slice(2).find((a) => !a.startsWith("--") && a.endsWith(".json"));
if (!file) { console.error("usage: import-profile <file.json> [--dry] [--overwrite] [--as email]"); process.exit(1); }

type Entry = { scope: "company" | "brand"; slug: string; sections: Record<string, Record<string, string | Record<string, string>[]>> };
const data = JSON.parse(fs.readFileSync(file, "utf8")) as { entries: Entry[] };

const who = arg("as") ? db.select().from(users).where(eq(users.email, arg("as")!)).get() : db.select().from(users).where(eq(users.role, "admin")).orderBy(users.id).get();
if (!who) { console.error("No such user to attribute the answers to."); process.exit(1); }

let saved = 0, kept = 0, empty = 0, bad = 0;
for (const e of data.entries) {
  const row = e.scope === "company" ? db.select().from(companies).where(eq(companies.slug, e.slug)).get() : db.select().from(brands).where(eq(brands.slug, e.slug)).get();
  if (!row) { console.error(`${e.scope} not found: ${e.slug}`); bad++; continue; }
  const have = new Map(db.select().from(profileEntries).all().filter((p) => p.scope === e.scope && p.refId === row.id).map((p) => [`${p.section}.${p.field}`, p.value]));
  for (const [section, fields] of Object.entries(e.sections)) {
    const defs = fieldsFor(e.scope, row.id, section);
    if (!defs) { console.error(`${e.slug}: no section "${section}" for a ${e.scope}`); bad++; continue; }
    for (const [field, raw] of Object.entries(fields)) {
      const def = defs.find((d) => d.key === field);
      if (!def) { console.error(`${e.slug}: no field "${section}.${field}"`); bad++; continue; }
      const value = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (!isAnswered(def, value)) { empty++; continue; }
      const existing = have.get(`${section}.${field}`);
      if (existing && isAnswered(def, existing) && !flag("overwrite")) { kept++; continue; }
      if (!flag("dry")) saveAnswer(e.scope, row.id, section, field, value, who.id);
      saved++;
    }
  }
}
console.log(`${flag("dry") ? "Would save" : "Saved"} ${saved} answers; kept ${kept} existing; skipped ${empty} empty${bad ? `; ${bad} problem(s) above` : ""}. Attributed to ${who.email}.`);
process.exit(bad ? 1 : 0);
