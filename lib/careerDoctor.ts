import { type users } from "@/lib/db";
import { loadRoles } from "@/lib/lifecycle/roles";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { levelsPassed } from "@/lib/progress";
import { hiddenTrackIds } from "@/lib/tracks";

type Person = typeof users.$inferSelect;

export type Area = { slug: string; trackId: number; name: string; need: number; have: number; tested: boolean };
export type RoleFit = {
  role: string; name: string; family: string; blurb: string;
  /** 0..1: how much of the level this role first asks for the person already shows (placement counts: this is about fit, not proof) */
  fit: number;
  /** 0..1: how many of the role's areas have any result at all, so a high fit on thin evidence can be told apart */
  coverage: number;
  areas: Area[];
};
export type FamilyFit = { family: string; fit: number; coverage: number; roles: RoleFit[]; untested: Area[] };
export type Diagnosis = { families: FamilyFit[]; testedAreas: number; totalAreas: number };

/**
 * Where someone's results point. For every career ladder, the tracks that set the role apart are compared with the level the ladder first asks for,
 * using what the person has passed or been placed at. Families are ranked by their roles' best fits, but only where there is evidence:
 * a role with no results at all scores nothing rather than "weak", and shows up as areas still to try.
 */
export function diagnose(person: Person): Diagnosis {
  const cat = catalog(), hidden = hiddenTrackIds(), scopes = scopesOf(person.id);
  const bySlug = new Map(cat.filter((t) => !hidden.has(t.id) && inScope(t, person.audience, scopes) && t.reach > 0).map((t) => [t.slug, t]));
  const level = new Map<string, number>();
  const have = (slug: string) => {
    const t = bySlug.get(slug);
    if (!t) return null;
    if (!level.has(slug)) level.set(slug, levelsPassed(person.id, t.id));
    return level.get(slug)!;
  };

  const roles: RoleFit[] = [];
  for (const r of loadRoles()) {
    const slugs = (r.core?.length ? r.core : r.tracks).filter((s) => bySlug.has(s));
    const areas: Area[] = slugs.map((s) => {
      const need = Math.max(1, Math.min(r.entry?.[s] ?? 1, bySlug.get(s)!.reach)), got = have(s) ?? 0;
      return { slug: s, trackId: bySlug.get(s)!.id, name: bySlug.get(s)!.name, need, have: got, tested: got > 0 };
    });
    if (areas.length < 2) continue; // too few measurable areas to say anything about the role
    const asked = areas.reduce((n, a) => n + a.need, 0);
    roles.push({
      role: r.key, name: r.name, family: r.family, blurb: r.blurb, areas,
      fit: areas.reduce((n, a) => n + Math.min(a.have, a.need), 0) / asked,
      coverage: areas.filter((a) => a.tested).length / areas.length,
    });
  }

  const byFamily = new Map<string, RoleFit[]>();
  for (const r of roles) byFamily.set(r.family, [...(byFamily.get(r.family) ?? []), r]);
  const families: FamilyFit[] = [...byFamily.entries()].map(([family, rs]) => {
    rs.sort((a, b) => b.fit - a.fit || b.coverage - a.coverage || a.name.localeCompare(b.name));
    const seen = new Map<string, Area>();
    for (const r of rs) for (const a of r.areas) if (!seen.has(a.slug)) seen.set(a.slug, a);
    const top = rs.slice(0, 3);
    return {
      family, roles: rs,
      fit: top.reduce((n, r) => n + r.fit, 0) / top.length,
      coverage: [...seen.values()].filter((a) => a.tested).length / seen.size,
      untested: [...seen.values()].filter((a) => !a.tested).slice(0, 4),
    };
  }).sort((a, b) => b.fit - a.fit || b.coverage - a.coverage || a.family.localeCompare(b.family));

  const all = new Map<string, Area>();
  for (const r of roles) for (const a of r.areas) all.set(a.slug, a);
  return { families, testedAreas: [...all.values()].filter((a) => a.tested).length, totalAreas: all.size };
}
