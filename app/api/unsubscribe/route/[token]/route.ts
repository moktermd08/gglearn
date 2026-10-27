import { unsubscribeRoute } from "@/lib/routeReminders";

/** The "unsubscribe" button in a mail app (RFC 8058 one-click) sends a POST here for the weekly route email; it needs no page and no sign-in. */
export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!unsubscribeRoute((await params).token)) return new Response("Not found", { status: 404 });
  return new Response("Unsubscribed", { status: 200 });
}
