import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildCv } from "@/lib/cv/build";
import { renderPdf } from "@/lib/cv/pdf";
import { PRESETS } from "@/lib/cv/types";
import { buildPack, packText } from "@/lib/star/data";
import { renderPack } from "@/lib/star/pdf";
import { allowed, hit, MINUTE } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One application's behaviour pack for the signed-in person only: ?format=pdf|txt, ?mode=statements|cue, ?cv=1 puts their CV (the recruiter view) in
 * front in a PDF, ?blind=1 leaves their name off (many civil service applications are marked without names). Never cached, never indexed.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return new NextResponse("Sign in to download your application.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const key = `star-export:${me.id}`;
  if (!allowed(key, 40)) return new NextResponse("Too many downloads. Please wait a few minutes.", { status: 429 });
  hit(key, 10 * MINUTE);
  const id = Number((await ctx.params).id);
  const q = req.nextUrl.searchParams;
  const pack = Number.isInteger(id) ? buildPack(me.id, id) : null;
  if (!pack) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const mode = q.get("mode") === "cue" ? "cue" : "statements";
  const slug = pack.job.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "application";
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (q.get("format") === "txt") return new NextResponse(packText(pack, mode), { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-${mode}.txt"` } });
  let cv: Uint8Array | undefined;
  if (q.get("cv") === "1") { const doc = buildCv(me.id, PRESETS.recruiter.view, await siteUrl()); if (doc) cv = await renderPdf(blind(q) ? { ...doc, name: "Applicant", contact: [] } : doc); }
  const bytes = await renderPack(pack, mode, { name: blind(q) ? undefined : me.name, cv });
  return new NextResponse(Buffer.from(bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${slug}-${mode}.pdf"` } });
}
const blind = (q: URLSearchParams) => q.get("blind") === "1";
