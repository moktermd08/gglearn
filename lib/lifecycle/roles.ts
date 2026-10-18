import fs from "node:fs";
import path from "node:path";
import type { RoleInfo } from "./model";

/** Other names people search for. The ladder files use one name per role. */
const ALIASES: Record<string, string[]> = {
  sales: ["sales manager", "sales executive", "sales director", "business development"],
  "account manager": ["customer success manager"],
  manager: ["team manager", "engineering manager", "general manager"],
  "project manager": ["programme manager", "scrum master"],
  "delivery manager": ["release manager", "agile delivery manager"],
  "full stack developer": ["fullstack developer", "full-stack developer", "web developer"],
  marketing: ["marketing manager", "digital marketer"],
  devops: ["site reliability engineer", "sre", "platform engineer"],
  security: ["security engineer", "infosec"],
  tester: ["qa", "qa engineer", "test engineer"],
};

let cache: RoleInfo[] | null = null;

/** Every career ladder in content/careers/roles with the tracks it asks for (a ladder step is [trackSlug, level]). */
export function loadRoles(): RoleInfo[] {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "content", "careers", "roles");
  const roles: RoleInfo[] = [];
  const levels = new Map<string, Map<string, number>>();
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { role: string; name: string; rungs?: { steps?: [string, number][] }[] };
      const top = new Map<string, number>();
      for (const r of j.rungs ?? []) for (const [t, l] of r.steps ?? []) top.set(t, Math.max(top.get(t) ?? 0, l));
      levels.set(j.role, top);
      roles.push({ key: j.role, name: j.name, aliases: ALIASES[j.role] ?? [], tracks: [...top.keys()], core: [] });
    } catch { /* a ladder file that does not parse is simply not offered */ }
  }
  // A track most ladders ask for (such as governance and compliance) is a basic, not what sets a role apart, so it only counts as core when this ladder wants it at level 8 or more.
  const shared = new Map<string, number>();
  for (const r of roles) for (const t of r.tracks) shared.set(t, (shared.get(t) ?? 0) + 1);
  for (const r of roles) r.core = r.tracks.filter((t) => (shared.get(t) ?? 0) <= roles.length * 0.7 || (levels.get(r.key)?.get(t) ?? 0) >= 8);
  return (cache = roles.sort((a, b) => a.name.localeCompare(b.name)));
}
