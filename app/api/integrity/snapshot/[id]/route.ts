import { eq } from "drizzle-orm";
import { db, integritySessions, integritySnapshots } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { reachOf, userInReach } from "@/lib/tenancy";

/** A webcam still, for the admin who runs the person it shows. Nobody else can open it, not even the person themselves, and it is never cached. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const me = await currentUser();
  if (!Number.isInteger(id) || !me || me.role !== "admin") return new Response(null, { status: 404 });
  const snap = db.select().from(integritySnapshots).where(eq(integritySnapshots.id, id)).get();
  const session = snap && db.select().from(integritySessions).where(eq(integritySessions.id, snap.sessionId)).get();
  if (!snap || !session || session.userId === me.id || !userInReach(reachOf(me.id), session.userId)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(snap.data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
