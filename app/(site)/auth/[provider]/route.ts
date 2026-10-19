import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { allowed, clientIp, hit, MINUTE } from "@/lib/rate-limit";
import { safeNext } from "@/lib/nextPath";
import { siteUrl } from "@/lib/share";
import { begin, isProvider } from "@/lib/social";

/** Sends the person to Google or Microsoft. `?connect=1` (signed in) connects the account to the one they are using instead of signing in. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const base = await siteUrl(), key = (await params).provider, q = req.nextUrl.searchParams;
  const connecting = q.get("connect") === "1", me = connecting ? await currentUser() : null;
  const back = (e: string) => NextResponse.redirect(new URL(connecting ? `/profile?social=${e}#connected` : `/login?social=${e}`, base));
  if (!isProvider(key)) return back("off");
  if (connecting && !me) return back("expired");
  const ipKey = `social-start:${await clientIp()}`;
  if (!allowed(ipKey, 30)) return back("expired");
  hit(ipKey, 10 * MINUTE);
  const r = await begin(key, `${base}/auth/${key}/callback`, { next: safeNext(q.get("next")) ?? "", ref: (q.get("ref") ?? "").slice(0, 30), tried: (q.get("try") ?? "").slice(0, 80), link: me?.id });
  if ("error" in r) return back(r.error);
  const res = NextResponse.redirect(r.url);
  res.cookies.set("gglearn_social", r.box, { httpOnly: true, sameSite: "lax", path: "/auth", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return res;
}
