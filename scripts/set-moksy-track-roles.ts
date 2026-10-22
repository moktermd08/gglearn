/**
 * Applies the job roles of the two Moksy engineering tracks to a database that already has them (seed-curriculum only
 * inserts missing tracks, so a changed role list in that file never reaches an existing database). Safe to re-run.
 *   npm run set:moksy-roles            preview
 *   npm run set:moksy-roles -- --write apply
 */
import { eq } from "drizzle-orm";
import { db, tracks } from "../lib/db";

const ROLES: Record<string, string> = {
  "moksy-platform-services": "developer,backend developer,frontend developer,full stack developer,engineer,architect,technical lead,data engineer,devops,security,tester",
  "moksy-patterns-automation": "developer,backend developer,full stack developer,engineer,architect,technical lead,data engineer,devops",
};
const write = process.argv.includes("--write");
for (const [slug, roles] of Object.entries(ROLES)) {
  const t = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  if (!t) { console.log(`${slug}: not in this database`); continue; }
  if (t.roles === roles) { console.log(`${slug}: already set`); continue; }
  console.log(`${slug}: ${t.roles || "(none)"} -> ${roles}`);
  if (write) db.update(tracks).set({ roles }).where(eq(tracks.id, t.id)).run();
}
if (!write) console.log("preview only; add --write to apply");
