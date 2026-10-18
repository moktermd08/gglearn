import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** The 1200x630 picture shown when a gglearn link is pasted into a chat or a feed. Same look as the share cards. */
export function ogCard({ kicker, title, sub, from = "#6366f1", to = "#9333ea" }: { kicker: string; title: string; sub: string; from?: string; to?: string }) {
  const big = title.length > 44 ? 64 : title.length > 26 ? 80 : 104;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, color: "#fff", background: `linear-gradient(135deg, ${from}, ${to})` }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 800 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ marginRight: 16 }}><rect width="48" height="48" rx="12" fill="rgba(255,255,255,.25)" /><path d="M14 34 L24 12 L34 34 M18.5 27 H29.5" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          gglearn
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", opacity: 0.85 }}>{kicker}</div>
          <div style={{ display: "flex", fontSize: big, fontWeight: 900, lineHeight: 1.05, marginTop: 14 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 36, marginTop: 20, opacity: 0.92 }}>{sub}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.9 }}>Learn it. Race it. Prove it. 20 levels from Novice to Titan.</div>
      </div>
    ),
    OG_SIZE,
  );
}
