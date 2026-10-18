import { NextResponse, type NextRequest } from "next/server";
import { startSession } from "@/lib/auth";
import { allowed, clientIp, hit, MINUTE } from "@/lib/rate-limit";
import { safeNext } from "@/lib/nextPath";
import { siteUrl } from "@/lib/share";
import { complete } from "@/lib/sso";
import { syncRequired } from "@/lib/paths";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

/** The identity provider sends the person back here. The cookie from the start of the sign-in is used up whatever happens. */
export async function GET(req: NextRequest) {
  const base = await siteUrl(), q = req.nextUrl.searchParams;
  const done = (path: string) => { const res = NextResponse.redirect(new URL(path, base)); res.cookies.set("gglearn_sso", "", { path: "/sso", maxAge: 0 }); return res; };
  const ipKey = `sso-callback:${await clientIp()}`;
  if (!allowed(ipKey, 30)) return done("/sso?e=expired");
  hit(ipKey, 10 * MINUTE);
  const r = await complete(req.cookies.get("gglearn_sso")?.value, { code: q.get("code"), state: q.get("state"), error: q.get("error") }, `${base}/sso/callback`);
  if ("error" in r) return done(`/sso?e=${r.error}`);
  const u = db.select().from(users).where(eq(users.id, r.userId)).get();
  if (u) syncRequired(u); // picks up tracks that became required since their last visit, as a password sign-in does
  await startSession(r.userId);
  return done(safeNext(r.next) ?? "/dashboard");
}
