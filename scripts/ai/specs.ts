import fs from "node:fs";
import path from "node:path";
import { MIN_PER_LEVEL } from "./engine";
import type { TrackSpec } from "./types";

/** Card-authored company/role tracks live as JSON in content/cards; the Titan technology tracks are TypeScript in ./data. */
export const CARDS_DIR = path.join(process.cwd(), "content", "cards");
const TS_DIR = path.join(__dirname, "data");

export type Loaded = { slug: string; spec: TrackSpec; origin: "ts" | "cards" };

/** Every spec of the chosen origin (optionally only these slugs), sorted by slug. */
export async function loadSpecs(origin: "ts" | "cards", only: string[] = []): Promise<Loaded[]> {
  const dir = origin === "cards" ? CARDS_DIR : TS_DIR;
  if (!fs.existsSync(dir)) return [];
  const ext = origin === "cards" ? ".json" : ".ts";
  const out: Loaded[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(ext) && !x.startsWith("_")).sort()) {
    const slug = f.slice(0, -ext.length);
    if (only.length && !only.includes(slug)) continue;
    const spec: TrackSpec = origin === "cards" ? JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) : (await import(path.join(dir, f))).default;
    out.push({ slug, spec, origin });
  }
  return out;
}

/** Card tracks must clear 1000 questions (50 a level); the Titan technology tracks keep their stricter 100 a level. */
export const minPerLevelFor = (spec: TrackSpec, origin: "ts" | "cards") => spec.minPerLevel ?? (origin === "cards" ? 50 : MIN_PER_LEVEL);
