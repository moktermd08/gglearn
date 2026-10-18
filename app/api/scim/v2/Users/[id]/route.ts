import { attrsOf, managed, patchAttrs, removeUser, resource, updateUser } from "@/lib/scim";
import { authed, body, fail, json } from "@/lib/scimHttp";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const a = await authed(req);
  if (a instanceof Response) return a;
  const m = managed(a.company, (await params).id);
  return m ? json(resource(m.user, m.externalId, a.base)) : fail({ status: 404, detail: "User not found." });
}

async function change(req: Request, { params }: Ctx, patch: boolean) {
  const a = await authed(req);
  if (a instanceof Response) return a;
  const b = await body(req);
  if (b === null) return fail({ status: 400, detail: "The body must be JSON.", scimType: "invalidSyntax" });
  const r = updateUser(a.company, (await params).id, patch ? patchAttrs(b) : attrsOf(b));
  return "error" in r ? fail(r.error) : json(resource(r.value.user, r.value.externalId, a.base));
}
export const PUT = (req: Request, ctx: Ctx) => change(req, ctx, false);
export const PATCH = (req: Request, ctx: Ctx) => change(req, ctx, true);

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authed(req);
  if (a instanceof Response) return a;
  const r = removeUser(a.company, (await params).id);
  return "error" in r ? fail(r.error) : new Response(null, { status: 204 });
}
