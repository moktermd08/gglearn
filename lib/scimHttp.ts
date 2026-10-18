import { companyForToken, scimError, type ScimError } from "@/lib/scim";
import { siteUrl } from "@/lib/share";

/** The HTTP side of directory sync, shared by the route files: JSON in SCIM's media type, the bearer token turned into a company, errors in SCIM's shape. */
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/scim+json; charset=utf-8", "cache-control": "no-store" } });
export const fail = (e: ScimError) => json(scimError(e), e.status);

export async function authed(req: Request): Promise<{ company: number; base: string } | Response> {
  const company = companyForToken(req.headers.get("authorization"));
  if (company === null) return new Response(JSON.stringify(scimError({ status: 401, detail: "Missing, invalid or revoked token." })), { status: 401, headers: { "content-type": "application/scim+json", "www-authenticate": "Bearer" } });
  return { company, base: await siteUrl() };
}

/** A request body as an object, or null when it is not JSON or is far larger than a person record. */
export async function body(req: Request): Promise<unknown | null> {
  const text = await req.text();
  if (text.length > 20_000) return null;
  try { return JSON.parse(text); } catch { return null; }
}
