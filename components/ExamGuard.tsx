"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Maximize, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ClientPolicy } from "@/lib/integrity/policy";

type Ev = { kind: string; detail?: string };
type FaceDetectorLike = { detect: (c: CanvasImageSource) => Promise<unknown[]> };

const needsCamera = (p: ClientPolicy) => p.webcam !== "off" || p.selfie;

/**
 * Wraps an exam in the integrity check its policy asks for. Before the questions appear it tells the person exactly what is recorded and asks them
 * to agree; then it goes fullscreen and starts the camera if the policy needs them. While the exam runs it records leaving the window, leaving
 * fullscreen, paste attempts, text that appears all at once and (if asked) takes camera photos at random moments. Everything goes to /api/integrity.
 *
 * This is evidence-gathering, not a lock: a determined person can defeat any page's checks. The server scores the evidence, treats missing evidence as
 * a risk, and a person reviews what is flagged (lib/integrity/session.ts).
 */
export function ExamGuard({ kind, id, policy, notice, expectedSeconds, children }: {
  kind: "run" | "role"; id: number; policy: ClientPolicy; notice: string[]; expectedSeconds: number; children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState<null | "fullscreen" | "camera">(null);
  const [camOn, setCamOn] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const queue = useRef<Ev[]>([]);
  const mark = `gglearn-guard:${kind}:${id}`;

  const post = useCallback((body: object) => fetch("/api/integrity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, ...body }), keepalive: true }), [kind, id]);
  const note = useCallback((k: string, detail?: string) => { queue.current.push({ kind: k, detail }); }, []);
  const flush = useCallback(() => {
    if (!queue.current.length) return;
    const events = queue.current.splice(0, 50);
    post({ op: "events", events }).catch(() => { queue.current.unshift(...events); }); // keep them for the next flush if the network blinked
  }, [post]);

  const attach = useCallback(async (s: MediaStream) => {
    stream.current = s;
    const v = video.current;
    if (v) { v.srcObject = s; await v.play().catch(() => {}); }
    setCamOn(true);
  }, []);

  const openCamera = useCallback(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
    await attach(s);
    s.getVideoTracks()[0]?.addEventListener("ended", () => { note("camera_lost"); flush(); setBlocked("camera"); });
  }, [attach, note, flush]);

  /** A small JPEG of the camera right now, and how many faces the browser can see in it (null when it cannot count). */
  const shoot = useCallback(async (): Promise<{ image: string; faces: number | null } | null> => {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = 320; c.height = Math.round(320 * (v.videoHeight / v.videoWidth)) || 240;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    let image = c.toDataURL("image/jpeg", 0.5);
    if (image.length > 70_000) image = c.toDataURL("image/jpeg", 0.3);
    let faces: number | null = null;
    const FD = (window as unknown as { FaceDetector?: new (o: object) => FaceDetectorLike }).FaceDetector;
    if (FD) { try { faces = (await new FD({ fastMode: true, maxDetectedFaces: 5 }).detect(c)).length; } catch { faces = null; } }
    return { image, faces };
  }, []);

  async function begin() {
    setError(""); setBusy(true);
    try {
      // fullscreen first: the browser only allows it within a few seconds of the click, and the camera permission prompt can take longer than that
      if (policy.fullscreen) {
        if (!document.documentElement.requestFullscreen) throw new Error("This browser cannot go fullscreen. Use a computer to take this exam.");
        try { await document.documentElement.requestFullscreen(); } catch { throw new Error("The browser did not allow fullscreen. Try again."); }
      }
      if (needsCamera(policy)) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot use a camera here. Open the exam on a computer with a camera, over a secure (https) connection.");
        try { await openCamera(); } catch { throw new Error("This exam needs your camera. Allow camera access in your browser, then try again."); }
      }
      const res = await post({ op: "start", consent: true, automated: navigator.webdriver === true });
      if (!res.ok) throw new Error("Could not start the check. Reload the page and try again.");
      if (sessionStorage.getItem(mark)) note("reload", "page reloaded during the exam");
      try { sessionStorage.setItem(mark, "1"); } catch { /* blocked: the reload flag is a nicety */ }
      if (policy.selfie) {
        await new Promise((r) => setTimeout(r, 900)); // let the camera settle on a face
        const shot = await shoot();
        if (!shot) throw new Error("The camera did not give a picture. Check it is not covered or in use, then try again.");
        const up = await post({ op: "snapshot", tag: "start", image: shot.image, faces: shot.faces });
        if (!up.ok) throw new Error("Could not save your start photo. Try again.");
        if (shot.faces === 0) throw new Error("No face was seen. Sit in front of the camera with good light, then try again.");
      }
      setPhase("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCamOn(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  // while the exam is live: watch the window, the clipboard, the text and the camera
  useEffect(() => {
    if (phase !== "live") return;
    const cleanups: (() => void)[] = [];
    const on = <T extends EventTarget>(t: T, type: string, fn: (e: Event) => void, opts: AddEventListenerOptions | boolean = true) => { t.addEventListener(type, fn, opts); cleanups.push(() => t.removeEventListener(type, fn, opts)); };

    let leftAt = 0;
    if (policy.tabSwitch !== "off") {
      on(window, "blur", () => { if (!leftAt) leftAt = Date.now(); }, false);
      on(window, "focus", () => { if (leftAt) { note("blur", `${Math.round((Date.now() - leftAt) / 1000)}s away`); leftAt = 0; flush(); } }, false);
    }
    if (policy.fullscreen) {
      on(document, "fullscreenchange", () => {
        if (!document.fullscreenElement) { note("fullscreen_exit"); flush(); setBlocked((b) => b ?? "fullscreen"); }
        else setBlocked((b) => (b === "fullscreen" ? null : b));
      }, false);
    }
    if (policy.blockPaste || policy.behaviour) {
      const stop = (e: Event) => { if (policy.blockPaste) e.preventDefault(); };
      on(document, "paste", (e) => { stop(e); note("paste"); });
      on(document, "drop", (e) => { stop(e); note("paste", "dropped text"); });
      on(document, "copy", (e) => { stop(e); note("copy"); });
      on(document, "cut", (e) => { stop(e); note("copy", "cut"); });
      if (policy.blockPaste) on(document, "contextmenu", (e) => e.preventDefault());
    }
    if (policy.behaviour) {
      const last = new WeakMap<Element, number>();
      on(document, "input", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement)) return;
        const before = last.get(t) ?? 0, now = t.value.length;
        last.set(t, now);
        const type = (e as InputEvent).inputType ?? "";
        if (now - before > 25 && !type.startsWith("insertFrom")) note("bulk_insert", `${now - before} characters at once`);
      });
    }
    const tick = setInterval(flush, 4000);
    cleanups.push(() => clearInterval(tick));
    on(window, "pagehide", flush, false);
    on(document, "submit", flush); // the exam is being handed in: send what is still waiting

    // random camera photos, spread across the time the exam should take
    if (policy.webcam === "snapshots") {
      const span = Math.max(60, expectedSeconds) - 12;
      const times = Array.from({ length: policy.snapshots }, () => 12 + Math.random() * span).sort((a, b) => a - b);
      for (const t of times) {
        const h = setTimeout(async () => {
          const shot = await shoot();
          if (shot) post({ op: "snapshot", tag: "random", image: shot.image, faces: shot.faces }).catch(() => {});
        }, t * 1000);
        cleanups.push(() => clearTimeout(h));
      }
    }
    return () => { cleanups.forEach((f) => f()); flush(); };
  }, [phase, policy, expectedSeconds, note, flush, post, shoot]);

  // handing the exam in ends the check: put the screen and camera back
  useEffect(() => () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  async function resume() {
    setError("");
    try {
      if (blocked === "fullscreen") await document.documentElement.requestFullscreen();
      else if (blocked === "camera") { await openCamera(); setBlocked(null); }
    } catch { setError(blocked === "camera" ? "The camera is still not available." : "The browser did not allow fullscreen. Try again."); }
  }

  const cam = needsCamera(policy);
  // One <video> in one place for the whole life of the guard, so the stream survives the move from the check screen to the exam.
  const preview = (
    <video ref={video} muted playsInline aria-label="Your camera"
      className={!camOn ? "hidden" : phase === "gate" ? "mx-auto mb-3 h-40 w-56 -scale-x-100 rounded-lg bg-black/80 object-cover" : "fixed bottom-3 right-3 z-40 h-20 w-28 -scale-x-100 rounded-lg border border-white/40 bg-black/80 object-cover shadow"} />
  );

  return (
    <>
      {preview}
      {phase === "gate" ? (
        <div className="mx-auto max-w-xl space-y-4">
          <div className="card space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck size={22} className="text-indigo-400" />Before you begin</h2>
            <p className="text-sm text-slate-300">This exam is taken under an integrity check so that your result means something. While you take it:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">{notice.map((n) => <li key={n}>{n}</li>)}</ul>
            <p className="text-xs text-slate-400">Your answers and this record are seen only by the people who run your academy, and the camera photos are deleted after the retention period. Nothing is decided by software alone: a person looks at anything flagged.</p>
            {cam && <p className="flex items-center gap-1.5 text-xs text-slate-400"><Camera size={13} />Your camera starts when you press Begin.</p>}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />I understand what is recorded and I agree to take the exam this way.</label>
            {error && <p role="alert" className="flex items-start gap-2 text-sm text-rose-400"><TriangleAlert size={16} className="mt-0.5 shrink-0" />{error}</p>}
            <button type="button" disabled={!agree || busy} onClick={begin} className="btn disabled:opacity-50">
              {policy.fullscreen ? <Maximize size={16} /> : <ShieldCheck size={16} />}{busy ? "Starting…" : "Begin the exam"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-center gap-1.5 text-xs text-slate-400"><ShieldCheck size={13} className="text-emerald-400" />Integrity check active</div>
          <div style={{ visibility: blocked ? "hidden" : "visible" }}>{children}</div>
          {blocked && (
            <div role="alertdialog" aria-modal="true" aria-label="Return to the exam" className="fixed inset-0 z-50 grid place-items-center bg-white/95 p-6">
              <div className="card max-w-sm space-y-3 p-6 text-center">
                <TriangleAlert size={28} className="mx-auto text-amber-400" />
                <p className="font-bold">{blocked === "fullscreen" ? "The exam must stay fullscreen." : "Your camera stopped."}</p>
                <p className="text-sm text-slate-400">{blocked === "fullscreen" ? "Leaving was recorded. Your answers are kept." : "This was recorded. Turn the camera back on to continue."}</p>
                {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
                <button type="button" className="btn" onClick={resume}>{blocked === "fullscreen" ? "Return to fullscreen" : "Turn the camera on"}</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
