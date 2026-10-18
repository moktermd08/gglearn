import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, roleExams, runs } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { clientPolicy, needsGuard } from "@/lib/integrity/policy";
import { MAX_SNAPSHOT_BYTES, addSnapshot, policyFor, recordEvents, sessionOf, startSession } from "@/lib/integrity/session";

/**
 * The browser's side of exam integrity: it opens the session (with the person's consent), reports events and uploads camera photos.
 * Everything is checked here, not trusted: the exam must be the caller's own and still open, only known event kinds are kept, photos must be
 * small JPEGs, and each session has a cap on how much it can store. The page can only ever ADD evidence to its own attempt.
 */
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("start"), kind: z.enum(["run", "role"]), id: z.number().int().positive(), consent: z.boolean(), automated: z.boolean().optional() }),
  z.object({ op: z.literal("events"), kind: z.enum(["run", "role"]), id: z.number().int().positive(), events: z.array(z.object({ kind: z.string().max(30), detail: z.string().max(200).optional() })).max(50) }),
  z.object({ op: z.literal("snapshot"), kind: z.enum(["run", "role"]), id: z.number().int().positive(), tag: z.enum(["start", "random"]), image: z.string().max(Math.ceil(MAX_SNAPSHOT_BYTES * 1.4) + 40), faces: z.number().int().min(0).max(20).nullable().optional() }),
]);

export async function POST(req: Request) {
  // a cross-site page must not be able to post evidence (or noise) into someone's exam
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return json({ error: "Not allowed." }, 403);
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) return json({ error: "Expected JSON." }, 415);

  const me = await currentUser();
  if (!me) return json({ error: "Sign in again." }, 401);
  if (!allowed(`integrity:${me.id}`, 240)) return json({ error: "Too many requests." }, 429);
  hit(`integrity:${me.id}`, MINUTE);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request." }, 400);
  const b = parsed.data;

  // the attempt must be this person's own and not yet finished
  let trackId: number | null = null, level = 0;
  if (b.kind === "run") {
    const run = db.select().from(runs).where(and(eq(runs.id, b.id), eq(runs.userId, me.id), isNull(runs.finishedAt))).get();
    if (!run) return json({ error: "That exam is not open." }, 404);
    trackId = run.trackId; level = run.level;
  } else {
    const ex = db.select().from(roleExams).where(and(eq(roleExams.id, b.id), eq(roleExams.userId, me.id), isNull(roleExams.finishedAt))).get();
    if (!ex) return json({ error: "That exam is not open." }, 404);
    level = ex.rung;
  }

  if (b.op === "start") {
    const policy = policyFor(b.kind, b.id, me.id, trackId).values;
    if (!needsGuard(policy)) return json({ ok: true, active: false });
    if (!b.consent) return json({ error: "You need to accept the notice to begin." }, 400);
    const s = startSession({ kind: b.kind, examId: b.id, userId: me.id, trackId, level, consent: true });
    if (b.automated) recordEvents(s.id, [{ kind: "automation", detail: "navigator.webdriver" }]);
    return json({ ok: true, active: true, policy: clientPolicy(policy) });
  }

  const session = sessionOf(b.kind, b.id);
  if (!session || session.userId !== me.id || session.status !== "open") return json({ error: "No integrity session is open for this exam." }, 409);

  if (b.op === "events") return json({ ok: true, kept: recordEvents(session.id, b.events) });

  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(b.image);
  if (!m) return json({ error: "That is not a JPEG." }, 400);
  const r = addSnapshot(session, b.tag, Buffer.from(m[1], "base64"), b.faces ?? null);
  return "error" in r ? json(r, 400) : json({ ok: true });
}
