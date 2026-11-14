import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildCv } from "@/lib/cv/build";
import { viewForOwner } from "@/lib/cv/links";
import { renderPdf } from "@/lib/cv/pdf";
import { allowed, hit, MINUTE } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The signed-in person's own CV as a PDF, as any one of their views would show it (?as=full|public|recruiter|<link id>). */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me) return new NextResponse("Sign in to download your CV.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const key = `cvpdf-own:${me.id}`;
  if (!allowed(key, 30)) return new NextResponse("Too many downloads. Please wait a few minutes.", { status: 429 });
  hit(key, 10 * MINUTE);
  const { view } = viewForOwner(me.id, req.nextUrl.searchParams.get("as") ?? undefined);
  const doc = buildCv(me.id, view, await siteUrl());
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const file = `${doc.name.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "CV"}-CV.pdf`;
  return new NextResponse(Buffer.from(await renderPdf(doc)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
