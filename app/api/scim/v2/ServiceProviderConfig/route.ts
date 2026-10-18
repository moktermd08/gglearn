import { authed, json } from "@/lib/scimHttp";

export async function GET(req: Request) {
  const a = await authed(req);
  if (a instanceof Response) return a;
  return json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"], patch: { supported: true }, bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 100 }, changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false },
    authenticationSchemes: [{ type: "oauthbearertoken", name: "Bearer token", description: "A token made for your company in the admin Set up page", primary: true }],
  });
}
