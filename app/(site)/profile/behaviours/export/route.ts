import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { exportStories } from "@/lib/star/data";
import { allowed, hit, MINUTE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The signed-in person's behaviour stories and applications as one JSON file: their own words, to keep. Private, never cached. */
export async function GET() {
  const me = await currentUser();
  if (!me) return new NextResponse("Sign in to download your stories.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const key = `star-export:${me.id}`;
  if (!allowed(key, 20)) return new NextResponse("Too many downloads. Please wait a few minutes.", { status: 429, headers: { "Cache-Control": "no-store" } });
  hit(key, 10 * MINUTE);
  return new NextResponse(JSON.stringify(exportStories(me.id), null, 2), { headers: {
    "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="behaviour-stories.json"',
    "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  } });
}
