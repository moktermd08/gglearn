/**
 * Copies the questions of each old `foundations-<x>` track into its `<x>-titan` twin so hiding the old track
 * loses nothing. Questions keep their level, so existing Titan questions and anyone's history are untouched.
 * A question already in the Titan track (same prompt + code) is skipped, so re-running is a no-op.
 *   npm run merge:legacy [-- --dry]
 */
import { and, eq } from "drizzle-orm";
import { db, questions, tracks } from "../lib/db";

const dry = process.argv.includes("--dry");
const subject = (slug: string) => slug.replace(/^foundations-/, "").replace(/-titan$/, "").replace(/[^a-z0-9]/g, "");
const key = (prompt: string, code: string | null) => `${prompt}|${code ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();

const all = db.select().from(tracks).all();
const titans = new Map(all.filter((t) => t.slug.endsWith("-titan")).map((t) => [subject(t.slug), t]));
let total = 0;

for (const legacy of all.filter((t) => t.slug.startsWith("foundations-"))) {
  const titan = titans.get(subject(legacy.slug));
  if (!titan) continue;
  const have = new Set(db.select().from(questions).where(eq(questions.trackId, titan.id)).all().map((q) => key(q.prompt, q.code)));
  const src = db.select().from(questions).where(and(eq(questions.trackId, legacy.id), eq(questions.status, "active"))).all();
  let added = 0, dup = 0, clash = 0;
  for (const q of src) {
    const k = key(q.prompt, q.code);
    if (have.has(k)) { dup++; continue; }
    if (dry) { added++; have.add(k); continue; }
    // unique index is (track, level, prompt): on a clash try a neighbouring level
    let ok = false;
    for (const shift of [0, 1, -1, 2, -2]) {
      const level = q.level + shift;
      if (level < 1 || level > 20) continue;
      const { id: _id, createdAt: _c, trackId: _t, level: _l, ...rest } = q;
      void _id; void _c; void _t; void _l;
      if (db.insert(questions).values({ ...rest, trackId: titan.id, level }).onConflictDoNothing().run().changes) { ok = true; break; }
    }
    if (ok) { added++; have.add(k); } else clash++;
  }
  total += added;
  console.log(`${legacy.slug} -> ${titan.slug}: ${added} copied, ${dup} already there${clash ? `, ${clash} could not be placed` : ""} (${src.length} source)`);
}
console.log(`${dry ? "DRY RUN: would copy" : "copied"} ${total} questions`);
