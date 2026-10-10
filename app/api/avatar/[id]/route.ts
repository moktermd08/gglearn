import { eq } from "drizzle-orm";
import { db, userAvatars } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { canSeeAvatar } from "@/lib/competitions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });
  const row = db.select().from(userAvatars).where(eq(userAvatars.userId, id)).get();
  // strangers only see photos of people who chose to play in a public contest
  if (!row || !canSeeAvatar(id, await currentUser())) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
