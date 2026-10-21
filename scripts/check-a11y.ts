/**
 * Accessibility check: npm run check:a11y. Opens the public pages in a real browser and runs axe (WCAG 2.0/2.1 A and AA) on each; any
 * violation, or a page that does not load, fails. Needs a running site (BASE_URL, default http://localhost:3000) and Chromium
 * (CI installs it; locally set CHROME_PATH to a Chrome binary, or run `npx playwright-core install chromium`).
 * Only pages that need no sign-in and no data, so it runs on an empty database. Signed-in and admin pages were audited by hand.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES = ["/", "/signup", "/login", "/forgot", "/sso", "/try", "/campaigns", "/competitions", "/map", "/map/public", "/map/software"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const axeSource = fs.readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");

type Violation = { id: string; impact?: string | null; nodes: { html: string; target: unknown[]; any: { data?: { contrastRatio?: number } }[] }[] };

async function main() {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let fails = 0;
  try {
    // a phone-sized and a desktop-sized window: some text only breaks at one of them
    for (const [label, size] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
      const ctx = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
      for (const p of PAGES) {
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
