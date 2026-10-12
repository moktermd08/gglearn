import { ImageResponse } from "next/og";
import { and, eq, isNull } from "drizzle-orm";
import { db, shareCards } from "@/lib/db";
import { TONES } from "@/lib/share";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = db.select().from(shareCards).where(and(eq(shareCards.code, code), isNull(shareCards.revokedAt))).get();
  if (!c) return new Response(null, { status: 404 });
  const t = TONES[c.tone] ?? TONES.indigo, big = c.headline.length > 7 ? 150 : 210;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, color: t.ink, background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 800 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ marginRight: 16 }}><rect width="48" height="48" rx="12" fill="rgba(255,255,255,.25)" /><path d="M14 34 L24 12 L34 34 M18.5 27 H29.5" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            gglearn
          </div>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.9 }}>{c.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: big, fontWeight: 900, lineHeight: 1 }}>{c.headline}</div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, marginTop: 20 }}>{c.title}</div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 12, opacity: 0.9 }}>{c.subtitle}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.85 }}>Earned on real exams. Learn, compete, climb.</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
