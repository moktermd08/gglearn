/**
 * 300 public, open-join competitions: 100 career campaigns, 100 general leagues, 100 AI races (content/campaigns).
 * Idempotent: each one has a fixed slug, so re-running adds only what is missing. Run with --dry to check without writing.
 *   npm run seed:campaigns [-- --dry]
 */
import { and, eq } from "drizzle-orm";
import { competitions, db, tracks, users } from "../lib/db";
import { campaigns } from "../content/campaigns";

const dry = process.argv.includes("--dry");
const now = Math.floor(Date.now() / 1000);

const missing = campaigns.filter((c) => !db.select({ id: tracks.id }).from(tracks).where(eq(tracks.slug, c.track)).get());
if (missing.length) {
  console.error(`Unknown track slugs:\n${missing.map((m) => `  ${m.id} ${m.title} -> ${m.track}`).join("\n")}`);
  process.exit(1);
}
const titles = new Set<string>();
for (const c of campaigns) { if (titles.has(c.title)) { console.error(`Duplicate title: ${c.title}`); process.exit(1); } titles.add(c.title); }

const organiser = db.select().from(users).where(and(eq(users.role, "admin"), eq(users.status, "active"))).get();
if (!organiser) { console.error("No active admin user to own the contests."); process.exit(1); }

let added = 0, cash = 0, vouchers = 0;
for (const c of campaigns) {
  cash += c.reward.cash / 100;
  vouchers += Number(/\$(\d+) Amazon voucher/.exec(c.reward.note)?.[1] ?? 0);
  const slug = `camp-${c.id}`;
  if (db.select({ id: competitions.id }).from(competitions).where(eq(competitions.slug, slug)).get()) continue;
  added++;
  if (dry) continue;
  const track = db.select({ id: tracks.id }).from(tracks).where(eq(tracks.slug, c.track)).get()!;
  db.insert(competitions).values({
    slug, title: c.title, description: c.hook, trackId: track.id, createdBy: organiser.id, visibility: "public", joinPolicy: "open",
    goalLevels: c.goal, startsAt: now, endsAt: now + c.days * 86400, maxHumans: 500,
    prizeAmount: c.reward.cash, prizeCurrency: "USD", prizeSplit: c.reward.split, prizeNote: c.reward.note,
  }).run();
}
console.log(`${dry ? "would add" : "added"} ${added} of ${campaigns.length}. Maximum payout if every contest is won: cash $${cash}, vouchers $${vouchers} (total $${cash + vouchers}).`);
