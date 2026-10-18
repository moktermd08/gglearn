import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { stateFor } from "@/lib/duel";

/** The duel as the caller may see it right now. The room asks for this about once a second. Never cached: it changes with the clock. */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in to play." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const st = stateFor((await params).code, me.id);
  return st ? NextResponse.json(st, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
