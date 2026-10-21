/**
 * Accessibility check: npm run check:a11y. Opens the public pages in a real browser and runs axe (WCAG 2.0/2.1 A and AA) on each; any
 * violation, or a page that does not load, fails. Needs a running site (BASE_URL, default http://localhost:3000) and Chromium
 * (CI installs it; locally set CHROME_PATH to a Chrome binary, or run `npx playwright-core install chromium`).
 * Public pages always. With SIGNED_IN=1 it also signs in as the local-only demo learner and demo admin that `npx tsx scripts/seed-demo-user.ts`
 * creates (their throwaway passwords are in that script; never use them anywhere real) and checks the learner and admin pages that need
 * no particular data. Pages that need real rows (a run, a certificate, a team) were audited by hand.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES = ["/", "/signup", "/login", "/forgot", "/sso", "/try", "/campaigns", "/competitions", "/map", "/map/public", "/map/software"];
const LEARNER = ["/dashboard", "/achievements", "/friends", "/journey", "/league", "/mentoring", "/notifications", "/profile", "/rewards", "/search", "/seasons", "/sponsoring", "/teams", "/updates", "/start", "/competitions/new"];
const ADMIN = ["/admin", "/admin/access", "/admin/bank", "/admin/careers", "/admin/certificates", "/admin/compliance", "/admin/contests", "/admin/freshness", "/admin/integrity", "/admin/matrix", "/admin/paths", "/admin/people", "/admin/problems", "/admin/profile", "/admin/rewards", "/admin/role-change", "/admin/setup", "/admin/starting-points"];
const ACCOUNTS = { learner: { email: "demo@gglearn.local", password: "demo-learner-local-only" }, admin: { email: "demo-admin@gglearn.local", password: "demo-admin-local-only" } };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const axeSource = fs.readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");

type Violation = { id: string; impact?: string | null; nodes: { html: string; target: unknown[]; any: { data?: { contrastRatio?: number } }[] }[] };

async function main() {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let fails = 0;
  try {
    // a phone-sized and a desktop-sized window: some text only breaks at one of them
    const sets: [string, string[], keyof typeof ACCOUNTS | null][] = [["public", PAGES, null]];
    if (process.env.SIGNED_IN) sets.push(["learner", LEARNER, "learner"], ["admin", ADMIN, "admin"]);
    for (const [who, pages, account] of sets) for (const [label0, size] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
      const label = account ? `${label0} ${who}` : label0;
      const ctx = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
      if (account) {
        const page = await ctx.newPage();
        await page.goto(BASE + "/login", { waitUntil: "networkidle" });
        await page.fill('input[name="email"]', ACCOUNTS[account].email);
        await page.fill('input[name="password"]', ACCOUNTS[account].password);
        await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }), page.click('button:has-text("Sign in")')]);
        await page.close();
      }
      for (const p of pages) {
        const page = await ctx.newPage();
        try {
          const res = await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30_000 });
          if (!res || !res.ok()) { fails++; console.log(`FAIL ${label} ${p}: HTTP ${res ? res.status() : "no response"}`); continue; }
          await page.addScriptTag({ content: axeSource });
          const violations: Violation[] = await page.evaluate(
            async (tags) => (await (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> } }).axe.run(document, { runOnly: tags })).violations,
            TAGS,
          ) as Violation[];
          if (!violations.length) { console.log(`ok   ${label} ${p}`); continue; }
          fails++;
          console.log(`FAIL ${label} ${p}`);
          for (const v of violations) {
            const n = v.nodes[0], ratio = n.any[0]?.data?.contrastRatio;
            console.log(`       ${v.id} (${v.impact}) x${v.nodes.length}${ratio ? ` contrast ${ratio}` : ""}: ${n.html.replace(/\s+/g, " ").slice(0, 120)}`);
          }
        } catch (e) {
          fails++;
          console.log(`FAIL ${label} ${p}: ${(e as Error).message.split("\n")[0]}`);
        } finally {
          await page.close();
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(fails ? `\n${fails} accessibility check(s) failed` : "\naccessibility ok");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
