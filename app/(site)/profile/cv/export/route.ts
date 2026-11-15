import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { exportJsonResume } from "@/lib/cv/export";
import { allowed, hit, MINUTE } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The signed-in person's CV as a JSON Resume file: their own data, to keep or to use elsewhere. Never cached. */
export async function GET() {
  const me = await currentUser();
  if (!me) return new NextResponse("Sign in to export your CV.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const key = `cv-export:${me.id}`;
  if (!allowed(key, 20)) return new NextResponse("Too many downloads. Please wait a few minutes.", { status: 429 });
  hit(key, 10 * MINUTE);
  const data = exportJsonResume(me.id, await siteUrl());
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="resume.json"', "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
