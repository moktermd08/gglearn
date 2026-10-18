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
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { role: string; name: string; rungs?: { steps?: [string, number][] }[] };
      const tracks = [...new Set((j.rungs ?? []).flatMap((r) => (r.steps ?? []).map((s) => s[0])))];
      roles.push({ key: j.role, name: j.name, aliases: ALIASES[j.role] ?? [], tracks });
    } catch { /* a ladder file that does not parse is simply not offered */ }
  }
  return (cache = roles.sort((a, b) => a.name.localeCompare(b.name)));
}
