import { NextResponse, type NextRequest } from "next/server";
import { buildCv } from "@/lib/cv/build";
import { gateName, gateOpen, openLink, viewOf } from "@/lib/cv/links";
import { renderPdf } from "@/lib/cv/pdf";
import { allowed, hit, MINUTE, pickClientIp } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** The CV as a PDF, for a live share link that allows it (and, for a passcode link, only after the code). Never cached, never listed. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const key = `cvpdf:${pickClientIp(req.headers.get("x-forwarded-for"))}`;
  if (!allowed(key, 30)) return new NextResponse("Too many downloads. Please wait a few minutes.", { status: 429 });
  hit(key, 10 * MINUTE);
  const link = openLink(token);
  if (!link || !link.allowPdf) return NO();
  if (link.kind === "passcode" && !gateOpen(link.id, req.cookies.get(gateName(link.id))?.value)) return NO();
  const doc = buildCv(link.userId, viewOf(link), await siteUrl());
  if (!doc) return NO();
  const bytes = await renderPdf(doc);
  const file = `${doc.name.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "CV"}-CV.pdf`;
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
}
