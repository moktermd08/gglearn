import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { brands, companies, db } from "@/lib/db";
import { type Reach, isGlobal, reachFor, reachOf, scopeInReach } from "@/lib/tenancy";

/**
 * What the admin is looking at, chosen in the switcher at the top of the side nav. Four kinds:
 *   master   the academy's general layer. Only the platform owner (an admin who runs no particular company) can enter it.
 *   all      everything this person runs.
 *   company  one company they run, with its brands and projects.
 *   brand    one brand they run.
 * Held in a cookie, but never trusted: every read is checked against what the person actually runs (lib/tenancy.ts), so a
 * forged cookie falls back to "all". Pages with no master layer of their own treat master as all, like GGSocial.
 */
export const SCOPE_COOKIE = "ggl_admin_scope";

export type ScopeKind = "master" | "all" | "company" | "brand";
export type AdminScope = {
  value: string; // "master", "all", "company:3" or "brand:7"
  kind: ScopeKind;
  id: number | null;
  name: string;
  blurb: string; // one line on what the pages show in this scope
  reach: Reach; // what the pages may read: all of theirs, or just this company or brand
  isMaster: boolean;
  owner: boolean; // the platform owner
};

export type ScopeChoices = {
  owner: boolean;
  companies: { id: number; name: string; brands: { id: number; name: string }[] }[];
  shared: { id: number; name: string }[]; // academy-wide brands, for the platform owner
};

type Me = { id: number; role: string };
const isOwner = (me: Me) => me.role === "admin" && isGlobal(reachOf(me.id));

/** The companies and brands this person may pick in the switcher. */
export function scopeChoices(me: Me): ScopeChoices {
  const reach = reachOf(me.id), owner = isOwner(me);
  const allBrands = db.select().from(brands).orderBy(asc(brands.name)).all();
  const cos = db.select().from(companies).orderBy(asc(companies.name)).all().filter((c) => scopeInReach(reach, { kind: "company", id: c.id }));
  return {
    owner,
    companies: cos.map((c) => ({
      id: c.id, name: c.academyName || c.name,
      brands: allBrands.filter((b) => b.companyId === c.id && b.kind === "company" && scopeInReach(reach, { kind: "brand", id: b.id })).map((b) => ({ id: b.id, name: b.name })),
    })),
    shared: owner ? allBrands.filter((b) => b.kind === "shared").map((b) => ({ id: b.id, name: b.name })) : [],
  };
}

/** Turns a stored value into a scope the person is allowed, or null when it is not one. */
export function resolveScope(me: Me, raw: string | undefined | null): AdminScope | null {
  const reach = reachOf(me.id), owner = isOwner(me);
  const all: AdminScope = { value: "all", kind: "all", id: null, name: owner ? "Whole academy" : "Everything I run", blurb: owner ? "Every company and brand." : "All the companies and brands you run.", reach, isMaster: false, owner };
  if (!raw || raw === "all") return all;
  if (raw === "master") return owner ? { ...all, value: "master", kind: "master", name: "Master", isMaster: true, blurb: "The academy's general layer: what every company starts from." } : null;
  const [kind, idText] = raw.split(":"), id = Number(idText);
  if (!Number.isInteger(id)) return null;
  if (kind === "company" && scopeInReach(reach, { kind: "company", id })) {
    const c = db.select().from(companies).where(eq(companies.id, id)).get();
    return c ? { ...all, value: raw, kind: "company", id, name: c.academyName || c.name, blurb: "This company's people, brands and content.", reach: reachFor([{ kind: "company", id }]) } : null;
  }
  if (kind === "brand" && scopeInReach(reach, { kind: "brand", id })) {
    const b = db.select().from(brands).where(eq(brands.id, id)).get();
    return b ? { ...all, value: raw, kind: "brand", id, name: b.name, blurb: "This brand's people and content.", reach: reachFor([{ kind: "brand", id }]) } : null;
  }
  return null;
}

/** The scope the person has chosen, falling back to "all" when the cookie is missing or no longer allowed. */
export async function adminScopeOf(me: Me): Promise<AdminScope> {
  const raw = (await cookies()).get(SCOPE_COOKIE)?.value;
  return resolveScope(me, raw) ?? resolveScope(me, "all")!;
}
