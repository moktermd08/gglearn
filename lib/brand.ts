import { eq } from "drizzle-orm";
import { brands, companies, db, projects } from "@/lib/db";
import { scopesOf } from "@/lib/paths";

/** What the academy looks like to one person. Nothing set = the gglearn default. */
export type Look = {
  name: string; // shown in the header, footer and page title
  logo: string | null; // data: URL
  accent: string | null; // #rrggbb
  issuer: string; // printed under "Issued by" on certificates
  company: string | null; // null = the default look
};

export const DEFAULT_LOOK: Look = { name: "gglearn", logo: null, accent: null, issuer: "the academy", company: null };

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s: string) => HEX.test(s);

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/** White text on this colour must be readable (WCAG AA, 4.5:1). */
export const readableWithWhite = (hex: string) => 1.05 / (lum(hex) + 0.05) >= 4.5;

/** A darker shade for hover states. */
export function darken(hex: string, by = 0.15): string {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - by)));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Changes when the logo does, so browsers refetch it. */
const version = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

export function lookOfCompany(companyId: number): Look {
  const c = db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!c) return DEFAULT_LOOK;
  const name = c.academyName || DEFAULT_LOOK.name;
  return { name, logo: c.logo ? `/brand/${c.id}/logo?v=${version(c.logo)}` : null, accent: isHex(c.accent) ? c.accent : null, issuer: c.certIssuer || c.academyName || c.name, company: c.name };
}

type ScopeRef = { kind: "company" | "brand" | "project"; id: number };
export type CompanyMaps = { brands: Map<number, { companyId: number | null }>; projects: Map<number, { companyId: number | null; brandId: number | null }> };

/** Brands and projects loaded once, so many people can be placed without a query each. */
export function companyMaps(): CompanyMaps {
  return { brands: new Map(db.select().from(brands).all().map((b) => [b.id, b])), projects: new Map(db.select().from(projects).all().map((p) => [p.id, p])) };
}

/** The company a set of scopes belongs to, when it is exactly one: through a company scope, a brand's company or a project's. */
export function singleCompanyIn(scopes: ScopeRef[], m: CompanyMaps): number | null {
  const ids = new Set<number>();
  for (const s of scopes) {
    if (s.kind === "company") ids.add(s.id);
    else if (s.kind === "brand") { const c = m.brands.get(s.id)?.companyId; if (c != null) ids.add(c); }
    else {
      const p = m.projects.get(s.id);
      const c = p?.companyId ?? (p?.brandId != null ? m.brands.get(p.brandId)?.companyId : null);
      if (c != null) ids.add(c);
    }
  }
  return ids.size === 1 ? [...ids][0] : null;
}

export const singleCompany = (scopes: ScopeRef[]): number | null => singleCompanyIn(scopes, companyMaps());

/** A person sees their company's look when they belong to exactly one company; otherwise (several companies, or none) the default. */
export function lookFor(userId: number | null | undefined): Look {
  if (!userId) return DEFAULT_LOOK;
  const id = singleCompany(scopesOf(userId));
  return id == null ? DEFAULT_LOOK : lookOfCompany(id);
}

/** CSS variables that tint buttons and headings with a company's accent; undefined for the default look. */
export function themeStyle(look: Look): Record<string, string> | undefined {
  return look.accent ? { "--brand": look.accent, "--brand-dark": darken(look.accent), "--brand-2": darken(look.accent, 0.35) } : undefined;
}
