/**
 * Sends the streak reminders and the Monday recap: npm run send:nudges
 *   --dry        list what would be sent, send and record nothing
 *   --at=<ISO>   pretend it is this time (UTC), for trying it out
 * Run it every hour (pm2 does, see ecosystem.config.cjs). It only does anything inside the send windows (lib/nudges.ts), only for people who opted in,
 * and never sends the same email twice. Needs RESEND_API_KEY, MAIL_FROM and SITE_URL (links in the emails point at it).
 */
import { mailConfigured, sendMail } from "../lib/mail";
import { runNudges } from "../lib/nudges";

const dry = process.argv.includes("--dry");
const at = process.argv.find((a) => a.startsWith("--at="))?.slice(5);
const now = at ? new Date(at) : new Date();
if (Number.isNaN(now.getTime())) { console.error(`Cannot read the time "${at}". Use something like 2026-10-19T09:00:00Z.`); process.exit(1); }
const base = (process.env.SITE_URL ?? "").trim().replace(/\/$/, "");

async function main() {
  if (!dry && !mailConfigured()) { console.log("Email is not set up (RESEND_API_KEY and MAIL_FROM). Nothing sent."); return; }
  if (!dry && !base) { console.log("SITE_URL is not set, so the links in the emails would point nowhere. Nothing sent."); return; }
  const r = await runNudges({ now, base: base || "http://localhost:3000", dry, send: (m, key) => sendMail(m, { key }) });
  console.log(`${now.toISOString()}  due: ${r.due.join(", ") || "nothing in this window"}  people with emails on: ${r.considered}`);
  for (const s of r.sent) console.log(`${dry ? "would send" : "sent"}  ${s.kind.padEnd(6)} ${s.email}  "${s.subject}"`);
  for (const f of r.failed) console.log(`FAILED  ${f.email}: ${f.error}`);
  console.log(`${dry ? "Dry run: " : ""}${r.sent.length} ${dry ? "would be " : ""}sent, ${r.skipped} skipped, ${r.failed.length} failed.`);
  if (r.failed.length) process.exitCode = 1;
}
main();
