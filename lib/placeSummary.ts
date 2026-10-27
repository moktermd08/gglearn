import type { Scope } from "@/lib/paths";

/**
 * The companies, brands and projects a person may be placed in, flat with their parents, for the pickers on the People page. Pure and
 * free of the database so client components can import it. The server builds it already limited to what the signed-in person runs
 * (lib/placeTree.ts); the actions check every choice again.
 */
export type PlaceTree = {
  companies: { id: number; name: string }[];
  brands: { id: number; name: string; companyId: number | null }[];
  projects: { id: number; name: string; brandId: number | null; companyId: number | null }[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A company covers its brands (their learning and their people), so a brand under a ticked company adds nothing. Projects are always separate. */
export function coveredBrand(tree: PlaceTree, picked: Scope[], brandId: number): boolean {
  const b = tree.brands.find((x) => x.id === brandId);
  return !!b && b.companyId != null && picked.some((s) => s.kind === "company" && s.id === b.companyId);
}

/** The scopes to store: what was ticked, minus brands already covered by a ticked company. */
export function tidyScopes(tree: PlaceTree, picked: Scope[]): Scope[] {
  return picked.filter((s) => !(s.kind === "brand" && coveredBrand(tree, picked, s.id)));
}

/** "Moksy Limited and its 4 brands; GGLearn (brand); 3 projects: A, B, C" as parts, or none when nothing is picked. */
export function summarisePlaces(tree: PlaceTree, picked: Scope[]): { parts: string[]; text: string } {
  const parts: string[] = [];
  for (const s of tidyScopes(tree, picked)) {
    if (s.kind !== "company") continue;
    const c = tree.companies.find((x) => x.id === s.id);
    if (!c) continue;
    const n = tree.brands.filter((b) => b.companyId === c.id).length;
    parts.push(n ? `${c.name} and its ${plural(n, "brand")}` : c.name);
  }
  for (const s of tidyScopes(tree, picked)) {
    if (s.kind !== "brand") continue;
    const b = tree.brands.find((x) => x.id === s.id);
    if (b) parts.push(`${b.name} (brand)`);
  }
  const ps = picked.filter((s) => s.kind === "project").map((s) => tree.projects.find((x) => x.id === s.id)?.name).filter((n): n is string => !!n);
  if (ps.length) parts.push(`${plural(ps.length, "project")}: ${ps.join(", ")}`);
  return { parts, text: parts.join("; ") };
}
