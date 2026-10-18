import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { userOfUnsubToken } from "@/lib/nudges";

/** The "unsubscribe" button in a mail app (RFC 8058 one-click) sends a POST here; it needs no page and no sign-in. */
export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = userOfUnsubToken((await params).token);
  if (!id) return new Response("Not found", { status: 404 });
  db.update(users).set({ emailNudges: "off" }).where(eq(users.id, id)).run();
  return new Response("Unsubscribed", { status: 200 });
}
