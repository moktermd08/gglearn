import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, integrityEvents, integritySessions, integritySnapshots, runs } from "@/lib/db";
import { DEFAULTS, FIELDS, type Resolved, type Settings, isActive, needsCamera, needsGuard, policyForTrack, policyForUser } from "@/lib/integrity/policy";

export type ExamKind = "run" | "role";
export type Session = typeof integritySessions.$inferSelect;
export type Flag = { key: string; label: string; points: number; count: number };

const nowSec = () => Math.floor(Date.now() / 1000);

/** The kinds of event a browser may report. Anything else is dropped, so a forged request cannot invent server-side flags. */
export const CLIENT_EVENTS = ["blur", "fullscreen_exit", "paste", "copy", "bulk_insert", "automation", "no_face", "multi_face", "camera_lost", "reload"] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

/** Snapshots a session may hold: the selfie, the random stills and a little room for a re-take. Stops a loop from filling the disk. */
export const snapshotCap = (p: Settings) => (p.selfie ? 2 : 0) + (p.webcam === "snapshots" ? p.snapshots + 3 : 0);
export const MAX_SNAPSHOT_BYTES = 60_000;

/**
 * The policy an exam attempt is held to. Resolved when the attempt is first looked at, then frozen on its session row; if the
 * session does not exist yet this returns the policy as it stands now (the exam page uses it to decide whether to show the check).
 */
export function policyFor(kind: ExamKind, examId: number, userId: number, trackId: number | null): Resolved {
  const s = sessionOf(kind, examId);
  if (s) return frozen(s.policy);
  return trackId != null ? policyForTrack(trackId) : policyForUser(userId);
}

function frozen(text: string): Resolved {
  // a frozen policy is just the values; sources and locks matter only while editing
  let v: Partial<Settings> = {};
  try { v = JSON.parse(text); } catch { /* fall back to defaults */ }
  const values = { ...DEFAULTS } as Settings;
  for (const f of FIELDS) { const x = (v as Record<string, unknown>)[f.key]; if (x !== undefined && typeof x === typeof f.def) (values as Record<string, unknown>)[f.key] = x; }
  const src = { scope: "default" as const, label: "Frozen" };
  return { values, source: Object.fromEntries(FIELDS.map((f) => [f.key, src])) as Resolved["source"], lockedBy: {} };
}

export const sessionOf = (kind: ExamKind, examId: number): Session | undefined =>
  db.select().from(integritySessions).where(and(eq(integritySessions.examKind, kind), eq(integritySessions.examId, examId))).get();

/** Opens the session for an attempt, once. Freezes the policy and records the person's consent. Returns it unchanged if it already exists. */
export function startSession(a: { kind: ExamKind; examId: number; userId: number; trackId: number | null; level: number; consent: boolean }): Session {
  const policy = policyFor(a.kind, a.examId, a.userId, a.trackId).values;
  db.insert(integritySessions).values({
    examKind: a.kind, examId: a.examId, userId: a.userId, trackId: a.trackId, level: a.level, policy: JSON.stringify(policy),
    consentAt: a.consent ? nowSec() : null,
  }).onConflictDoNothing().run();
  const s = sessionOf(a.kind, a.examId)!;
  if (a.consent && !s.consentAt) db.update(integritySessions).set({ consentAt: nowSec() }).where(eq(integritySessions.id, s.id)).run();
  return s;
}

/** Records browser events against an open session. Returns how many were kept. */
export function recordEvents(sessionId: number, events: { kind: string; detail?: string }[]): number {
  const keep = events.filter((e) => (CLIENT_EVENTS as readonly string[]).includes(e.kind)).slice(0, 50);
  if (!keep.length) return 0;
  const have = db.select({ n: sql<number>`count(*)` }).from(integrityEvents).where(eq(integrityEvents.sessionId, sessionId)).get()?.n ?? 0;
  const room = Math.max(0, 600 - have); // an attempt that produces hundreds of events is already flagged; stop storing more
  const rows = keep.slice(0, room).map((e) => ({ sessionId, kind: e.kind, detail: (e.detail ?? "").slice(0, 200) }));
  if (rows.length) db.insert(integrityEvents).values(rows).run();
  return rows.length;
}

/** JPEG magic bytes: the only thing that is ever stored as a snapshot. */
const isJpeg = (b: Buffer) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export function addSnapshot(session: Session, tag: "start" | "random", jpeg: Buffer, faces: number | null): { ok: true } | { error: string } {
  const p = frozen(session.policy).values;
  if (!needsCamera(p)) return { error: "This exam does not use the camera." };
  if (jpeg.length > MAX_SNAPSHOT_BYTES || !isJpeg(jpeg)) return { error: "That is not a small JPEG." };
  const n = db.select({ n: sql<number>`count(*)` }).from(integritySnapshots).where(eq(integritySnapshots.sessionId, session.id)).get()?.n ?? 0;
  if (n >= snapshotCap(p)) return { error: "Enough photos have been taken." };
  db.insert(integritySnapshots).values({ sessionId: session.id, tag, data: jpeg, faces: faces != null && Number.isInteger(faces) && faces >= 0 && faces <= 20 ? faces : null }).run();
  if (faces === 0) recordEvents(session.id, [{ kind: "no_face", detail: "no face in a camera photo" }]);
  else if (faces != null && faces > 1) recordEvents(session.id, [{ kind: "multi_face", detail: `${faces} faces in a camera photo` }]);
  return { ok: true };
}

// ---- scoring ----

/** Points per kind of evidence, and the most any one kind can add, so one noisy signal cannot flag an exam alone. */
const CAP = { blur: 40, fullscreen_exit: 25, paste: 32, copy: 10, bulk_insert: 30, no_face: 30, multi_face: 45, camera_lost: 40, reload: 9 };

export type Attempt = { questionCount: number; startedAt: number; finishedAt: number; passed: boolean; level: number };

/**
 * Turns an attempt's evidence into flags and a 0-100 risk. Missing evidence counts: an exam that was meant to be watched but sent no
 * session, no photos or no consent is the cheapest thing to fake, so it scores as a risk in itself. Pure: no database access.
 */
export function assess(p: Settings, session: { consentAt: number | null; exists: boolean }, events: { kind: string; detail: string }[], snaps: { tag: string }[], a: Attempt): Flag[] {
  const flags: Flag[] = [];
  const add = (key: string, label: string, points: number, count = 1) => { if (points > 0) flags.push({ key, label, points: Math.round(points), count }); };
  const n = (k: string) => events.filter((e) => e.kind === k).length;

  if (needsGuard(p)) {
    if (!session.exists) add("no_session", "The exam was taken without the integrity check starting", 60);
    else if (!session.consentAt) add("no_consent", "The person did not accept the monitoring notice", 60);
  }

  const leaves = n("blur");
  if (p.tabSwitch === "log") add("tab_leave", `Left the exam window ${leaves} time${leaves === 1 ? "" : "s"}`, Math.min(leaves * 3, CAP.blur), leaves);
  else if (p.tabSwitch === "limit") {
    const over = Math.max(0, leaves - p.maxTabLeaves), within = leaves - over;
    add("tab_leave", `Left the exam window ${leaves} time${leaves === 1 ? "" : "s"} (${p.maxTabLeaves} allowed)`, Math.min(within * 3 + over * 12, CAP.blur), leaves);
  }
  if (p.tabSwitch !== "off") {
    const away = events.filter((e) => e.kind === "blur").reduce((t, e) => t + (Number(e.detail.match(/(\d+)s/)?.[1]) || 0), 0);
    if (away >= 120) add("away_long", `${Math.round(away / 60)} minutes spent outside the exam window`, 15);
  }
  if (p.fullscreen) { const x = n("fullscreen_exit"); add("fullscreen_exit", `Left fullscreen ${x} time${x === 1 ? "" : "s"}`, Math.min(x * 5, CAP.fullscreen_exit), x); }
  if (p.blockPaste || p.behaviour) {
    const x = n("paste"), c = n("copy");
    add("paste", `${x} paste attempt${x === 1 ? "" : "s"}`, Math.min(x * 8, CAP.paste), x);
    add("copy", `${c} copy attempt${c === 1 ? "" : "s"}`, Math.min(c * 2, CAP.copy), c);
  }
  if (p.behaviour) {
    const x = n("bulk_insert");
    add("bulk_insert", `Text appeared all at once ${x} time${x === 1 ? "" : "s"}`, Math.min(x * 10, CAP.bulk_insert), x);
    if (n("automation")) add("automation", "The browser reported it is being automated", 40);
  }
  if (needsCamera(p)) {
    const wanted = p.webcam === "snapshots" ? p.snapshots : 0, got = snaps.filter((s) => s.tag === "random").length;
    if (wanted > 0 && got < Math.ceil(wanted / 2)) add("missing_photos", `Only ${got} of ${wanted} camera photos arrived`, 30);
    if (p.selfie && !snaps.some((s) => s.tag === "start")) add("missing_selfie", "No photo was taken at the start", 30);
    const nf = n("no_face"), mf = n("multi_face"), cl = n("camera_lost");
    add("no_face", `No face in ${nf} photo${nf === 1 ? "" : "s"}`, Math.min(nf * 6, CAP.no_face), nf);
    add("multi_face", `More than one face in ${mf} photo${mf === 1 ? "" : "s"}`, Math.min(mf * 15, CAP.multi_face), mf);
    add("camera_lost", `The camera stopped ${cl} time${cl === 1 ? "" : "s"}`, Math.min(cl * 20, CAP.camera_lost), cl);
  }
  const rl = n("reload");
  if (needsGuard(p) && rl) add("reload", `The page was reloaded ${rl} time${rl === 1 ? "" : "s"}`, Math.min(rl * 3, CAP.reload), rl);

  if (p.minSecondsPerQuestion > 0 && a.questionCount > 0) {
    const per = Math.max(0, a.finishedAt - a.startedAt) / a.questionCount;
    if (per < p.minSecondsPerQuestion / 2) add("too_fast", `Finished in ${Math.round(per)}s per question, far faster than people usually can`, 60);
    else if (per < p.minSecondsPerQuestion) add("too_fast", `Finished in ${Math.round(per)}s per question, faster than people usually can`, 35);
  }
  return flags;
}

export const riskOf = (flags: Flag[]) => Math.min(100, flags.reduce((t, f) => t + f.points, 0));

export type Outcome = { status: Session["status"]; score: number; hold: boolean };

/**
 * Called once, as an attempt is graded. Scores the evidence, decides whether a person must look, and whether the certificate and rewards
 * of a passing result wait for them. An attempt under an inactive policy leaves no trace at all.
 */
export function finalize(kind: ExamKind, examId: number, userId: number, trackId: number | null, a: Attempt): Outcome {
  const existing = sessionOf(kind, examId);
  const policy = existing ? frozen(existing.policy).values : (trackId != null ? policyForTrack(trackId) : policyForUser(userId)).values;
  if (!isActive(policy)) return { status: "clear", score: 0, hold: false };
  if (existing && existing.status !== "open") return { status: existing.status, score: existing.score, hold: existing.award === "held" }; // graded already

  const events = existing ? db.select().from(integrityEvents).where(eq(integrityEvents.sessionId, existing.id)).all() : [];
  const snaps = existing ? db.select({ tag: integritySnapshots.tag }).from(integritySnapshots).where(eq(integritySnapshots.sessionId, existing.id)).all() : [];
  const flags = assess(policy, { consentAt: existing?.consentAt ?? null, exists: !!existing }, events, snaps, a);
  const score = riskOf(flags);

  const byScore = policy.reviewAt > 0 && score >= policy.reviewAt;
  const highStakes = policy.reviewFromLevel > 0 && a.level >= policy.reviewFromLevel;
  if (highStakes) flags.push({ key: "high_stakes", label: `Level ${a.level} passes are always checked by a person`, points: 0, count: 1 });
  const review = a.passed && (byScore || highStakes);
  const hold = review && ((byScore && policy.holdOnFlag) || highStakes);
  const status: Session["status"] = review ? "review" : "clear";

  const fields = { status, award: hold ? "held" as const : "released" as const, score, flags: JSON.stringify(flags), finishedAt: nowSec() };
  if (existing) db.update(integritySessions).set(fields).where(eq(integritySessions.id, existing.id)).run();
  else db.insert(integritySessions).values({ examKind: kind, examId, userId, trackId, level: a.level, policy: JSON.stringify(policy), ...fields }).onConflictDoNothing().run();
  purgeExpired();
  return { status, score, hold };
}

// ---- retention ----

let lastPurge = 0;
/** Deletes webcam stills older than their policy's retention, once the attempt is settled. At most once an hour; the written record stays. */
export function purgeExpired(force = false): number {
  const t = Date.now();
  if (!force && t - lastPurge < 3_600_000) return 0;
  lastPurge = t;
  const withPhotos = db.selectDistinct({ id: integritySnapshots.sessionId }).from(integritySnapshots).all().map((r) => r.id);
  if (!withPhotos.length) return 0;
  const gone: number[] = [];
  for (const s of db.select().from(integritySessions).where(inArray(integritySessions.id, withPhotos)).all()) {
    if (s.status === "open" || s.status === "review") continue; // never delete evidence somebody still has to look at
    const settled = s.reviewedAt ?? s.finishedAt ?? s.createdAt;
    if (nowSec() - settled > frozen(s.policy).values.retainDays * 86_400) gone.push(s.id);
  }
  if (gone.length) db.delete(integritySnapshots).where(inArray(integritySnapshots.sessionId, gone)).run();
  return gone.length;
}

// ---- reading back ----

export const flagsOf = (s: Pick<Session, "flags">): Flag[] => { try { const f = JSON.parse(s.flags); return Array.isArray(f) ? f : []; } catch { return []; } };

export const eventsOf = (sessionId: number) => db.select().from(integrityEvents).where(eq(integrityEvents.sessionId, sessionId)).orderBy(integrityEvents.id).all();
export const snapshotsOf = (sessionId: number) =>
  db.select({ id: integritySnapshots.id, tag: integritySnapshots.tag, faces: integritySnapshots.faces, at: integritySnapshots.at }).from(integritySnapshots).where(eq(integritySnapshots.sessionId, sessionId)).orderBy(integritySnapshots.id).all();

/** The sessions waiting for a person, newest first. */
export const reviewQueue = (limit = 100) =>
  db.select().from(integritySessions).where(eq(integritySessions.status, "review")).orderBy(desc(integritySessions.finishedAt)).limit(limit).all();

export const recentlySettled = (limit = 30) =>
  db.select().from(integritySessions).where(and(inArray(integritySessions.status, ["cleared", "rejected"]), isNotNull(integritySessions.reviewedAt))).orderBy(desc(integritySessions.reviewedAt)).limit(limit).all();

/** Is this run's result waiting on, or withdrawn by, a review? For the result page. */
export const verdictFor = (runId: number) => {
  const s = sessionOf("run", runId);
  return s ? { status: s.status, held: s.award === "held" } : null;
};

/** The run a session belongs to, when it is a run. */
export const runOf = (s: Pick<Session, "examKind" | "examId">) => s.examKind === "run" ? db.select().from(runs).where(eq(runs.id, s.examId)).get() : undefined;
