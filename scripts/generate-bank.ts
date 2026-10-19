/**
 * Fills the question bank for tracks the dynamic generators cannot serve (company knowledge, processes, products).
 * For every level below the target it asks Claude for new multiple-choice questions grounded in the track's knowledge
 * items, then has a second blind pass answer each one and keeps only those where the answers agree (lib/questionGen.ts).
 *
 *   npm run generate:bank -- --track sdlc-backend [--target 110] [--level 5] [--activate] [--dry]
 *   npm run generate:bank -- --all-short
 *
 * New rows are saved with status "review" (source "ai") unless --activate is given, so nothing unreviewed goes live by
 * accident. Needs ANTHROPIC_API_KEY. Safe to re-run: it only requests the shortfall and the unique index drops duplicates.
 * Company admins can do the same from /admin/profile ("Write questions"), for the tracks published from a profile.
 */
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, tracks } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";
import { familiesFor } from "@/lib/dynamic/engine";
import { factsOf, fillLevel, storedAt } from "@/lib/questionGen";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? undefined : process.argv[i + 1] ?? ""; };
const flag = (n: string) => process.argv.includes(`--${n}`);
const TARGET = Number(arg("target") ?? 110);
const status = flag("activate") ? "active" : "review";
if (!process.env.ANTHROPIC_API_KEY && !flag("dry")) { console.error("Set ANTHROPIC_API_KEY (or use --dry to only print the plan)."); process.exit(1); }
const client = new Anthropic();

async function fill(track: typeof tracks.$inferSelect) {
  const facts = factsOf(track.id);
  for (let level = 1; level <= MAX_LEVEL; level++) {
    if (arg("level") && Number(arg("level")) !== level) continue;
    const have = storedAt(track.id, level);
    const dyn = familiesFor(track.slug, level).length ? TARGET : 0; // dynamic families already cover the level
    let need = TARGET - Math.max(have, dyn);
    console.log(`${track.slug} L${level}: ${have} stored, need ${Math.max(need, 0)} more`);
    if (flag("dry")) continue;
    for (let tries = 0; need > 0 && tries < 25; tries++) {
      let added = 0;
      try { added = await fillLevel(client, track, facts, level, status); } catch (e) {
        // a rejected key or exhausted quota will fail every later batch too, so stop instead of retrying
        if (e instanceof Anthropic.APIError && [401, 403].includes(e.status ?? 0)) { console.error(`  stopping: ${e.status} ${e.message}`); process.exit(1); }
        console.error("  batch failed:", (e as Error).message); continue;
      }
      need -= added;
      console.log(`  +${added} kept, ${Math.max(need, 0)} to go`);
    }
  }
}

const wanted = flag("all-short")
  ? db.select().from(tracks).all().filter((t) => Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).some((l) => !familiesFor(t.slug, l).length))
  : db.select().from(tracks).where(eq(tracks.slug, arg("track") ?? "")).all();
if (!wanted.length) { console.error("No matching track. Use --track <slug> or --all-short."); process.exit(1); }
(async () => { for (const t of wanted) await fill(t); })();
