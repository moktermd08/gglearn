import { ImageResponse } from "next/og";

/** The home-screen icon the web manifest points to: the gglearn mark on the brand gradient, at the two sizes browsers ask for. */
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const px = (await params).size === "512" ? 512 : (await params).size === "192" ? 192 : null;
  if (!px) return new Response(null, { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#4f46e5,#9333ea 70%,#db2777)" }}>
        <svg width={px * 0.6} height={px * 0.6} viewBox="0 0 48 48"><path d="M14 34 L24 12 L34 34 M18.5 27 H29.5" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    ),
    { width: px, height: px, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
