import { eq } from "drizzle-orm";
import { z } from "zod";
import { brands, companies, db, tracks } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";
import { isGlobal, reachOf, scopeInReach, trackInReach } from "@/lib/tenancy";
import { isHex, readableWithWhite } from "@/lib/brand";

export type SetupState = { error?: string; done?: string } | null;
type Me = { id: number; role: "admin" | "manager" | "learner" };

export const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

type Table = "companies" | "brands" | "tracks";
const taken = (table: Table, slug: string) =>
  table === "companies" ? !!db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).get()
  : table === "brands" ? !!db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug)).get()
  : !!db.select({ id: tracks.id }).from(tracks).where(eq(tracks.slug, slug)).get();

/** A slug from the name that no other row of the table uses: "moksy", then "moksy-2", "moksy-3"... Returns "" if the name has no usable letters. */
export function uniqueSlug(table: Table, name: string): string {
  const base = slugify(name);
  if (!base) return "";
  let slug = base;
  for (let n = 2; taken(table, slug); n++) slug = `${base}-${n}`;
  return slug;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Adds a company. Only the platform owner (an admin with no scopes) can: everyone else runs companies that already exist. */
export function addCompany(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can set up companies." };
  if (!isGlobal(reachOf(me.id))) return { error: "Only the platform owner can add a company." };
  const p = z.object({ name: z.string().min(2).max(80), tagline: z.string().max(160) }).safeParse({ name: str(fd.get("name")), tagline: str(fd.get("tagline")) });
  if (!p.success) return { error: "Give the company a name of 2 to 80 characters (tagline up to 160)." };
  const slug = uniqueSlug("companies", p.data.name);
  if (!slug) return { error: "The name needs some letters or numbers." };
  if (db.select().from(companies).all().some((c) => c.name.toLowerCase() === p.data.name.toLowerCase())) return { error: "A company with that name already exists." };
  db.insert(companies).values({ slug, name: p.data.name, tagline: p.data.tagline }).run();
  return { done: `Added company ${p.data.name}. Next, add a brand, then invite its first manager on People.` };
}

/** Adds a brand to a company the admin runs. */
export function addBrand(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can set up brands." };
  const p = z.object({ companyId: z.coerce.number().int().positive(), name: z.string().min(2).max(80), tagline: z.string().max(160) })
    .safeParse({ companyId: fd.get("companyId"), name: str(fd.get("name")), tagline: str(fd.get("tagline")) });
  if (!p.success) return { error: "Pick a company and give the brand a name of 2 to 80 characters." };
  const company = db.select().from(companies).where(eq(companies.id, p.data.companyId)).get();
  if (!company || !scopeInReach(reachOf(me.id), { kind: "company", id: company.id })) return { error: "You can only add brands to a company you run." };
  const slug = uniqueSlug("brands", p.data.name);
  if (!slug) return { error: "The name needs some letters or numbers." };
  if (db.select().from(brands).where(eq(brands.companyId, company.id)).all().some((b) => b.name.toLowerCase() === p.data.name.toLowerCase())) return { error: `${company.name} already has a brand with that name.` };
  db.insert(brands).values({ slug, name: p.data.name, tagline: p.data.tagline, companyId: company.id, kind: "company" }).run();
  return { done: `Added brand ${p.data.name} to ${company.name}.` };
}

const TRACK = z.object({
  brandId: z.coerce.number().int().positive(),
  name: z.string().min(2).max(80),
  description: z.string().max(500),
  kind: z.enum(["subject", "product", "service", "tool", "technology", "process"]),
  scope: z.enum(["company", "brand"]),
  tier: z.enum(["mandatory", "role", "growth"]),
  audience: z.enum(["staff", "customer", "both"]),
  requiredLevel: z.coerce.number().int().min(1).max(MAX_LEVEL),
  dueDays: z.coerce.number().int().min(1).max(365),
});

/** Adds an empty track to a brand the admin runs. Questions come later (import or review); an empty track is never counted as required. */
export function addTrack(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can set up tracks." };
  const p = TRACK.safeParse({
    brandId: fd.get("brandId"), name: str(fd.get("name")), description: str(fd.get("description")), kind: str(fd.get("kind")), scope: str(fd.get("scope")),
    tier: str(fd.get("tier")), audience: str(fd.get("audience")), requiredLevel: fd.get("requiredLevel"), dueDays: fd.get("dueDays"),
  });
  if (!p.success) return { error: `Check the form: a brand, a name of 2 to 80 characters, and a pass level of 1 to ${MAX_LEVEL}.` };
  const brand = db.select().from(brands).where(eq(brands.id, p.data.brandId)).get();
  if (!brand || brand.kind !== "company" || !trackInReach(reachOf(me.id), { scope: "brand", projectId: null, brandId: brand.id })) return { error: "You can only add tracks to a brand you run." };
  const slug = uniqueSlug("tracks", p.data.name);
  if (!slug) return { error: "The name needs some letters or numbers." };
  const roles = [...new Set(str(fd.get("roles")).toLowerCase().split(",").map((r) => r.trim()).filter(Boolean))].join(",");
  if (roles.length > 200) return { error: "Too many roles: keep the list under 200 characters." };
  db.insert(tracks).values({ ...p.data, slug, roles, policySource: "admin" }).run();
  return { done: `Added track ${p.data.name}. It has no questions yet, so nobody is required to take it until some are added.` };
}

export const MAX_LOGO_BYTES = 150 * 1024;
/** png, jpeg or webp by their first bytes, not by the name or type the browser claims. */
function imageType(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Saves how the academy looks for one company: its name, accent colour, logo and the issuer printed on certificates. Empty fields go back to the default. */
export async function saveBranding(me: Me, fd: FormData): Promise<SetupState> {
  if (me.role !== "admin") return { error: "Only an admin can change branding." };
  const id = Number(fd.get("companyId"));
  const company = Number.isInteger(id) ? db.select().from(companies).where(eq(companies.id, id)).get() : undefined;
  if (!company || !scopeInReach(reachOf(me.id), { kind: "company", id: company.id })) return { error: "You can only change the branding of a company you run." };
  const p = z.object({ academyName: z.string().max(40), certIssuer: z.string().max(80), accent: z.string() })
    .safeParse({ academyName: str(fd.get("academyName")), certIssuer: str(fd.get("certIssuer")), accent: str(fd.get("accent")).toLowerCase() });
  if (!p.success) return { error: "Keep the academy name under 40 characters and the issuer under 80." };
  if (p.data.accent === "#4f46e5") p.data.accent = ""; // the standard shade means "no custom colour"
  if (p.data.accent && !isHex(p.data.accent)) return { error: "The colour must look like #1a73e8." };
  if (p.data.accent && !readableWithWhite(p.data.accent)) return { error: "That colour is too light for white button text. Pick a darker one." };

  let logo = company.logo;
  const file = fd.get("logo");
  if (fd.get("removeLogo") === "on") logo = "";
  else if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) return { error: `The logo is over ${MAX_LOGO_BYTES / 1024} KB. Use a smaller image.` };
    const bytes = new Uint8Array(await file.arrayBuffer()), type = imageType(bytes);
    if (!type) return { error: "The logo must be a PNG, JPEG or WebP image." };
    logo = `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  }
  db.update(companies).set({ academyName: p.data.academyName, certIssuer: p.data.certIssuer, accent: p.data.accent, logo }).where(eq(companies.id, company.id)).run();
  return { done: `Saved branding for ${company.name}. People in this company see it on their next page load.` };
}
