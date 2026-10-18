import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { submitAnswer } from "@/lib/duel";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";

/** One answer to one question. The server decides if it is on time, by its own clock; the page only says which option was tapped. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in to play." }, { status: 401 });
  if (!allowed(`duel-answer:${me.id}`, 60)) return NextResponse.json({ error: "Slow down." }, { status: 429 });
  hit(`duel-answer:${me.id}`, MINUTE);
  const body = (await req.json().catch(() => null)) as { index?: unknown; choice?: unknown } | null;
  const r = submitAnswer((await params).code, me.id, Number(body?.index), String(body?.choice ?? ""));
  return NextResponse.json(r, { status: "ok" in r ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
