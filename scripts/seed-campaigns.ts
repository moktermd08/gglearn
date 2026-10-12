/**
 * Makes the contests behind the campaign catalogue (content/campaigns) exist and renews any that have ended. Idempotent.
 * The /campaigns page does the same on demand, so this is only needed to seed ahead of the first visit.
 *   npm run seed:campaigns [-- --dry]
 * Campaigns whose track is not in the database are skipped, not fatal.
 */
import { campaigns } from "../content/campaigns";
import { syncCampaigns } from "../lib/campaigns";

const r = syncCampaigns({ dry: process.argv.includes("--dry") });
const dry = process.argv.includes("--dry") ? "would " : "";
if (r.noOrganiser) console.error("No active admin user to own the contests: create an admin first, then run this again.");
console.log(`${dry}create ${r.created} and renew ${r.renewed} of ${campaigns.length} campaigns; ${r.waiting.length} waiting for their track to exist in this database.`);
if (r.waiting.length) console.log(`waiting: ${r.waiting.join(", ")}`);
const first = campaigns.reduce((s, c) => s + c.reward.cash / 100 + Number(/\$(\d+) Amazon voucher/.exec(c.reward.note)?.[1] ?? 0), 0);
console.log(`Maximum payout if every first-round contest is won: $${first}. Renewal rounds are certificate-only.`);
