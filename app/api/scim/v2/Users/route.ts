import { SCHEMA_LIST, attrsOf, createUser, listUsers, resource } from "@/lib/scim";
import { authed, body, fail, json } from "@/lib/scimHttp";

export async function GET(req: Request) {
  const a = await authed(req);
  if (a instanceof Response) return a;
  const q = new URL(req.url).searchParams;
  const r = listUsers(a.company, q.get("filter"), Number(q.get("startIndex") ?? 1) || 1, q.has("count") ? Number(q.get("count")) || 0 : 100);
  if ("error" in r) return fail(r.error);
  return json({ schemas: [SCHEMA_LIST], totalResults: r.value.total, startIndex: Math.max(1, Number(q.get("startIndex") ?? 1) || 1), itemsPerPage: r.value.rows.length, Resources: r.value.rows.map((x) => resource(x.user, x.externalId, a.base)) });
}

export async function POST(req: Request) {
  const a = await authed(req);
  if (a instanceof Response) return a;
  const b = await body(req);
  if (b === null) return fail({ status: 400, detail: "The body must be JSON.", scimType: "invalidSyntax" });
  const r = createUser(a.company, attrsOf(b));
  if ("error" in r) return fail(r.error);
  return json(resource(r.value.user, r.value.externalId, a.base), r.created ? 201 : 200);
}
