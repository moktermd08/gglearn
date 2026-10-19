import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { currentUser, startSession } from "@/lib/auth";
import { allowed, clientIp, hit, MINUTE } from "@/lib/rate-limit";
import { safeNext } from "@/lib/nextPath";
import { siteUrl } from "@/lib/share";
import { complete, isProvider } from "@/lib/social";
import { syncRequired } from "@/lib/paths";

/** Google or Microsoft sends the person back here. The cookie from the start is used up whatever happens. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const base = await siteUrl(), key = (await params).provider, q = req.nextUrl.searchParams;
  const done = (path: string) => { const res = NextResponse.redirect(new URL(path, base)); res.cookies.set("gglearn_social", "", { path: "/auth", maxAge: 0 }); return res; };
  if (!isProvider(key)) return done("/login?social=off");
  const ipKey = `social-callback:${await clientIp()}`;
  if (!allowed(ipKey, 30)) return done("/login?social=expired");
  hit(ipKey, 10 * MINUTE);
  const me = await currentUser();
  const r = await complete(key, req.cookies.get("gglearn_social")?.value, { code: q.get("code"), state: q.get("state"), error: q.get("error") }, `${base}/auth/${key}/callback`, me?.id ?? null);
  if ("error" in r) return done(me && r.error === "taken" ? `/profile?social=${r.error}#connected` : `/login?social=${r.error}`);
  if (r.linked) return done("/profile?social=connected#connected"); // already signed in: nothing to start
  const u = db.select().from(users).where(eq(users.id, r.userId)).get();
  if (u) syncRequired(u);
  await startSession(r.userId);
  return done(safeNext(r.next) ?? (r.created ? "/try?first=1" : "/dashboard")); // a new account gets a first win in a minute, as sign-up does
}
