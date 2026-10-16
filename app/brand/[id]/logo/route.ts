import { eq } from "drizzle-orm";
import { companies, db } from "@/lib/db";

/** A company's logo, served from the data: URL kept on the company row. Public on purpose: certificates and the header show it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = /^\d+$/.test(id) ? db.select({ logo: companies.logo }).from(companies).where(eq(companies.id, Number(id))).get() : undefined;
  const m = c && /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(c.logo);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600", "Content-Security-Policy": "default-src 'none'" },
  });
}
