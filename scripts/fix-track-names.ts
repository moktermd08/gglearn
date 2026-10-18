/**
 * Corrects the names of a few topics that were imported misspelt or in the wrong case: npm run fix:names  (add --dry to only show what it would do).
 * Safe to repeat: a topic is renamed only while its name is still exactly the wrong one below, so a name an admin has since chosen is never overwritten.
 * The artwork and everything else is keyed by the topic's slug, which does not change. Runs as the last step of deploy/seed-content.sh, so a later import cannot put the old name back.
 */
import { and, eq } from "drizzle-orm";
import { db, tracks } from "../lib/db";

const FIXES = [
  { slug: "lambda-titan", from: "AWS Lamda: Novice to Titan", to: "AWS Lambda: Novice to Titan" },
  { slug: "linkedin-titan", from: "Linkedin: Novice to Titan", to: "LinkedIn: Novice to Titan" },
  { slug: "foundations-github", from: "Github", to: "GitHub" },
  { slug: "foundations-javascript", from: "Javascript", to: "JavaScript" },
  { slug: "foundations-wordpress", from: "Wordpress", to: "WordPress" },
  // the 20-level tracks imported from the question repo kept the folder's lower case
  ...([["angular", "Angular"], ["bootstrap", "Bootstrap"], ["css", "CSS"], ["dynamics", "Dynamics"], ["html", "HTML"], ["javascript", "JavaScript"], ["laravel", "Laravel"],
    ["mysql", "MySQL"], ["nodejs", "Node.js"], ["php", "PHP"], ["python", "Python"], ["react", "React"], ["wordpress", "WordPress"]] as const)
    .map(([k, proper]) => ({ slug: `${k}-titan`, from: `${k}: Novice to Titan`, to: `${proper}: Novice to Titan` })),
];

const dry = process.argv.includes("--dry");
let changed = 0;
for (const f of FIXES) {
  const t = db.select({ id: tracks.id, name: tracks.name }).from(tracks).where(eq(tracks.slug, f.slug)).get();
  if (!t) { console.log(`skip   ${f.slug}: no such topic`); continue; }
  if (t.name !== f.from) { console.log(`skip   ${f.slug}: named "${t.name}", not "${f.from}"`); continue; }
  if (!dry) db.update(tracks).set({ name: f.to }).where(and(eq(tracks.id, t.id), eq(tracks.name, f.from))).run();
  console.log(`${dry ? "would " : ""}rename ${f.slug}: "${f.from}" -> "${f.to}"`);
  changed++;
}
console.log(`${dry ? "Dry run: " : ""}${changed} topic${changed === 1 ? "" : "s"} ${dry ? "would change" : "renamed"}.`);
