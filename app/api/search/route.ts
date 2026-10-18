import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { searchFor } from "@/lib/search";
import { MAX_QUERY } from "@/lib/searchRules";
import { MINUTE, allowed, clientIp, hit } from "@/lib/rate-limit";

/** Search for whoever is asking: the results follow what they are allowed to see (lib/search.ts). Never cached, because they depend on who it is. */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const key = `search:${await clientIp()}`;
  if (!allowed(key, 120)) return NextResponse.json({ groups: [], error: "Slow down a little." }, { status: 429, headers });
  hit(key, MINUTE);
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, MAX_QUERY);
  const me = await currentUser();
  return NextResponse.json({ groups: searchFor(me ? { id: me.id, role: me.role, audience: me.audience } : null, q) }, { headers });
}
