import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { companies, db } from "@/lib/db";
import { allowed, clientIp, hit, MINUTE } from "@/lib/rate-limit";
import { safeNext } from "@/lib/nextPath";
import { siteUrl } from "@/lib/share";
import { begin } from "@/lib/sso";

/** Sends the person to their company's identity provider, with the state, nonce and PKCE verifier kept in a short-lived signed cookie. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const base = await siteUrl(), back = (e: string) => NextResponse.redirect(new URL(`/sso?e=${e}`, base));
  const ipKey = `sso-start:${await clientIp()}`;
  if (!allowed(ipKey, 30)) return back("expired");
  hit(ipKey, 10 * MINUTE);
  const company = db.select({ id: companies.id }).from(companies).where(eq(companies.slug, (await params).slug)).get();
  if (!company) return back("off");
  const r = await begin(company.id, `${base}/sso/callback`, safeNext(req.nextUrl.searchParams.get("next")) ?? "/dashboard");
  if ("error" in r) return back(r.error);
  const res = NextResponse.redirect(r.url);
  res.cookies.set("gglearn_sso", r.box, { httpOnly: true, sameSite: "lax", path: "/sso", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return res;
}
