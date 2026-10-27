"use client";

import { practicalFor } from "@/content/build/stops";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Crosshair, Lock, Minus, Plus, Lightbulb, Search, Share2, Trophy, X } from "lucide-react";
import { setJourneyMode } from "@/app/actions";
import { AuthModal, type AuthKit, type AuthMode } from "./AuthModal";
import { PASS_MARK, QUESTIONS_PER_RUN } from "@/lib/levels";
import { pickQuery, type RoutePick } from "@/lib/lifecycle/share";
import {
  AI_MODES, FAMILY_ORDER, SIZE_LABEL, aiRoleName, type AiMode, type FocusId, type Gate, type LineId, type MapData, type MapModel, type RaceInfo, type RoleInfo, type StageId, type Station, type TrackInfo,
} from "@/lib/lifecycle/engine";
import { combineProblems, findProblems, findStops, STAGE_QUESTIONS, suggestStage } from "@/lib/lifecycle/problems";
import { MAPS, MAP_LIST } from "@/lib/lifecycle/maps";
import { acceptRoleStartAction, logProblemAction } from "@/app/(map)/map/actions";

const ModelCtx = createContext<MapModel>(MAPS.software);
const useModel = () => useContext(ModelCtx);

type View = { k: number; x: number; y: number };
type Sel = { kind: "st" | "gt"; id: string } | null;

const MAX_K = 2.4;
const wrapWords = (t: string, max: number) => {
  const out: string[] = []; let cur = "";
  for (const w of t.split(" ")) { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  return out;
};
const fmtDate = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Mark = "none" | "learning" | "solid" | "titan";
const markOf = (t: TrackInfo | undefined): Mark => !t || t.passed <= 0 ? "none" : t.passed >= 20 ? "titan" : t.passed >= 5 ? "solid" : "learning";

/** `standalone` makes the map a page of its own: full height, with its own slim top bar (brand and a way back) instead of the site header. `initial` is a route carried by a shared link: it wins over the signed-in person's own defaults. */
export function LifecycleMap({ mapId, data, signage, standalone, initial, auth }: { mapId: string; data: MapData; signage: string; standalone?: { brand: string }; initial?: RoutePick; auth?: AuthKit }) {
  const M = MAPS[mapId] ?? MAPS.software;
  const boxRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(0); // the header's height, so panels and the camera start below it however many rows it wraps to
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ k: 0.5, x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const linked = !!(initial?.role || initial?.area || initial?.stage || initial?.problem);
  const [focus, setFocus] = useState<FocusId>(initial?.role || initial?.stage || initial?.problem ? "all" : initial?.area ?? (data.defaultRole ? "all" : data.defaultFocus));
  const [roleKey, setRoleKey] = useState<string | null>(linked ? initial!.role : data.defaultRole);
  const [stage, setStage] = useState<StageId | null>(initial?.role ? null : initial?.stage ?? null);
  const [stageOpen, setStageOpen] = useState(!!stage); // the panel that explains the chosen company stage
  const [stagePicker, setStagePicker] = useState(false);
  const [orgSize, setOrgSize] = useState<string | null>(initial?.size ?? null); // organisation size: what the map lights up depends on how big the body is
  const [sizeOpen, setSizeOpen] = useState(!!initial?.size);
  const [sizePicker, setSizePicker] = useState(false);
  const [sector, setSector] = useState<string | null>(initial?.sector ?? null); // the kind of business: adds sector notes to the stops it touches
  const [sectorPicker, setSectorPicker] = useState(false);
  const [sectorOpen, setSectorOpen] = useState(!!initial?.sector); // a link that names a kind of business opens what it says, like a stage or a size link does
  const [level, setLevel] = useState<number | null>(initial?.level ?? null); // where the person is on their role's career ladder (1-based rung): later stops are flagged, not lit
  const [levelPicker, setLevelPicker] = useState(false);
  const [picker, setPicker] = useState(false);
  const [problemId, setProblemId] = useState<string | null>(initial?.problem ?? null); // a problem in the person's own words: it lights its own stops
  const [fq, setFq] = useState(""); // what they typed in the problem finder
  const [fopen, setFopen] = useState(false);
  const [activeOpt, setActiveOpt] = useState(-1); // which result the arrow keys are on (-1: none yet)
  const [quiz, setQuiz] = useState<Record<string, boolean | undefined> | null>(null); // the "not sure which stage?" questions
  const finderRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (activeOpt >= 0) document.getElementById(`finder-opt-${activeOpt}`)?.scrollIntoView({ block: "nearest" }); }, [activeOpt]);
  const problem = useMemo(() => combineProblems(problemId, M.PROBLEMS), [M, problemId]);
  const [ticks, setTicks] = useState<string[]>([]); // "not sure what is wrong": the things that sound like them, ticked
  const [checker, setChecker] = useState(false);
  const stopHits = useMemo(() => (M.PROBLEMS.length ? findStops(fq, M.STATIONS) : []), [M, fq]);
  const finderHits = useMemo(() => (fq.trim() ? findProblems(fq, M.PROBLEMS, 6) : M.PROBLEMS.filter((p) => p.common)), [M, fq]);
  const [pq, setPq] = useState("");
  const [races, setRaces] = useState(false);
  const [jpanel, setJpanel] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [hint, setHint] = useState(true);
  const [ctrl, setCtrl] = useState(false); // on a phone the route controls fold away until asked for
  const [aiOpen, setAiOpen] = useState(false);
  const [legend, setLegend] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHint(false), 7000); return () => clearTimeout(t); }, []);
  const [mode, setMode] = useState<AiMode>(initial?.mode ?? "human");
  // `auth` makes "Sign in" a dialog over the map; signing in returns to the address the map had when it was opened (route and all)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [back, setBack] = useState("/map");
  const openSignIn = auth ? () => { setBack(window.location.pathname + window.location.search); setAuthMode("login"); } : undefined;
  const [copied, setCopied] = useState(false);
  const narrow = size.w > 0 && size.w < 900;
  const chrome = standalone ? 40 : 0; // room taken by the standalone top bar

  const role = useMemo<RoleInfo | null>(() => data.roles.find((r) => r.key === roleKey) ?? null, [roleKey, data.roles]);
  /* The finder's results as one list, problems first and then stops, so the arrow keys, the screen reader and the mouse all see the same options. */
  const finderOptions = useMemo(() => [...finderHits.map((p) => ({ kind: "problem" as const, id: p.id, label: p.say })), ...stopHits.map((s) => ({ kind: "stop" as const, id: s.id, label: s.name }))], [finderHits, stopHits]);
  /* A role whose main subjects mostly live on another map (a cloud engineer on the business map) is pointed there, with the role and level kept. A role this map already covers about as well is left alone. */
  const betterMap = useMemo(() => {
    if (!role || !role.core.length) return null;
    const total = role.core.length, here = M.roleCoverage(role.core);
    let best: { label: string; href: string; n: number } | null = null;
    for (const o of MAP_LIST) {
      if (o.id === M.id) continue;
      const n = MAPS[o.id].roleCoverage(role.core);
      // only when this map covers half or less of the role, and another covers clearly more: a role this map already fits is left alone
      if (here / total <= 0.5 && n / total >= 0.3 && n / total >= here / total + 0.25 && (!best || n > best.n)) best = { label: o.label, href: o.href, n };
    }
    return best && { ...best, here, total };
  }, [M, role]);
  const betterMapNote = betterMap && role && (
    <p className="text-[12.5px] text-slate-400"><b className="font-semibold text-slate-300">More of this role&apos;s learning is on the {betterMap.label} map</b>: {betterMap.n} of its {betterMap.total} main subjects have stops there, {betterMap.here === 0 ? "none" : betterMap.here} here.{" "}
      <Link href={`${betterMap.href}${pickQuery({ role: role.key, area: null, stage: null, size: null, level, mode })}`} className="font-semibold text-indigo-300 underline">Open it there →</Link></p>
  );
  /* The route: the stops a role's career ladder asks for (or an area's hand-picked stops), seen through the chosen AI lens. */
  const route = useMemo(() => M.buildRoute(role, focus, mode, stage, orgSize, level, problem?.stops ?? null), [M, role, focus, mode, stage, orgSize, level, problem]);
  const routeIds = route.ids;
  const litLines = useMemo(() => new Set<LineId>(M.STATIONS.filter((s) => routeIds.has(s.id)).map((s) => s.line)), [M, routeIds]);
  const dimming = routeIds.size < M.STATIONS.length;

  /* The next stop: the first required, unfinished stop in your lines; else the first one you have not yet passed at level 5. */
  const next = useMemo<Station | null>(() => {
    const all = M.STATIONS.filter((s) => routeIds.has(s.id)).sort((a, b) => a.x - b.x || a.row - b.row);
    // never send someone to a stop that is locked for them: the first stop they can open comes first
    const free = all.filter((s) => !data.journey?.locks[s.track]);
    const mine = free.length ? free : all;
    const t = (s: Station) => data.tracks[s.track];
    const start = problem ? M.STATION_BY_ID.get(problem.stops[0]) : mode !== "human" ? M.STATION_BY_ID.get("aiuse") : !role && stage ? M.STATION_BY_ID.get(M.STAGE_BY_ID.get(stage)!.start) : !role ? M.STATION_BY_ID.get(M.FOCUS_START[focus] ?? "") : undefined;
    return mine.find((s) => t(s)?.open && t(s)?.required && t(s)!.passed < t(s)!.requiredLevel)
      ?? (start && routeIds.has(start.id) && (t(start)?.passed ?? 0) < 5 ? start : undefined)
      ?? mine.find((s) => t(s)?.open && (t(s)?.passed ?? 0) < 5) ?? mine[0] ?? null;
  }, [M, routeIds, role, focus, mode, stage, problem, data.tracks, data.journey]);

  /* Where the route starts and where it ends: the goal is the last stop along it. */
  const ends = useMemo(() => {
    if (!dimming) return null;
    const on = M.STATIONS.filter((s) => routeIds.has(s.id)).sort((a, b) => a.x - b.x || a.row - b.row);
    // a company stage names its own first stop; any other route starts at its leftmost stop
    const from = (!role && stage ? M.STATION_BY_ID.get(M.STAGE_BY_ID.get(stage)!.start) : undefined) ?? on[0];
    return on.length > 1 ? { from, goal: on[on.length - 1], count: on.length } : null;
  }, [M, dimming, routeIds, role, stage]);

  /* Races: live or upcoming campaigns on the tracks of this route. One flag per track, on the first stop of that track on the route. */
  const routeTracks = useMemo(() => role ? new Set([...role.tracks, ...(mode !== "human" ? ["ai-llm-practice"] : [])]) : new Set(M.STATIONS.filter((s) => routeIds.has(s.id)).map((s) => s.track)), [M, role, mode, routeIds]);
  const raceList = useMemo(() => data.races.filter((r) => routeTracks.has(r.track)).sort((a, b) => Number(b.state === "live") - Number(a.state === "live") || b.humans - a.humans), [data.races, routeTracks]);
  const racesByTrack = useMemo(() => { const m = new Map<string, RaceInfo[]>(); for (const r of data.races) m.set(r.track, [...(m.get(r.track) ?? []), r]); return m; }, [data.races]);
  const raceAnchor = useMemo(() => {
    const m = new Map<string, number>(), seen = new Set<string>();
    for (const st of M.STATIONS.filter((x) => routeIds.has(x.id)).sort((a, b) => a.x - b.x || a.row - b.row)) {
      if (seen.has(st.track) || !racesByTrack.has(st.track)) continue;
      seen.add(st.track); m.set(st.id, racesByTrack.get(st.track)!.length);
    }
    return m;
  }, [M, routeIds, racesByTrack]);

  /* ---------- camera ---------- */
  const fitK = size.w && size.h ? Math.min(size.w / M.W, size.h / M.H) : 0.5;
  const move = useCallback((v: View, smooth: boolean) => { setAnimate(smooth); setView(v); }, []);
  const centreOn = useCallback((cx: number, cy: number, k: number, smooth = true, rightInset = 0, sheet = false) => {
    const kk = Math.min(MAX_K, Math.max(fitK * 0.5, k));
    const top = (narrow ? (size.w < 640 ? 110 : 215) : 0) + chrome, bottom = sheet ? size.h * 0.4 : size.h;
    move({ k: kk, x: (size.w - rightInset) / 2 - cx * kk, y: (top + bottom) / 2 - cy * kk }, smooth);
  }, [fitK, size, narrow, chrome, move]);
  const frameLines = useCallback((lines: Set<LineId>, smooth = true, ids?: ReadonlySet<string>, startId?: string) => {
    const on = (st: Station) => (ids ? ids.has(st.id) : lines.has(st.line));
    if (narrow) { const s = (startId ? M.STATION_BY_ID.get(startId) : undefined) ?? M.STATIONS.filter(on).sort((a, b) => a.x - b.x)[0], rs = M.LINES.filter((l) => lines.has(l.id)).map((l) => l.row); if (s) centreOn(M.px(s.x) + 120, M.py((Math.min(...rs) + Math.max(...rs)) / 2), 0.75, smooth); return; }
    const rows = M.LINES.filter((l) => lines.has(l.id)).map((l) => l.row);
    const y0 = M.py(Math.min(...rows)) - 120 - (M.TOP - 170), // a map with more room above its first line keeps its phase titles in view
       y1 = M.py(Math.max(...rows)) + 80, top = narrow ? 100 + chrome : (headRef.current?.offsetHeight ?? 220) + 6, bottom = narrow ? 96 : 150; // clear of the header above and the route buttons below
    // readable first: about 0.9 unless the lit lines would not fit up and down; the fit button shows the whole map
    const kk = Math.min(1.1, Math.max(0.6, Math.min(0.95, (size.h - top - bottom) / (y1 - y0))));
    const first = (startId ? M.STATION_BY_ID.get(startId) : undefined) ?? M.STATIONS.filter(on).sort((p, q) => p.x - q.x)[0], x0 = first ? M.px(first.x) - 300 : 0;
    move({ k: kk, x: 16 - Math.max(0, x0) * kk, y: top + Math.max(0, size.h - top - bottom - (y1 - y0) * kk) / 2 - y0 * kk }, smooth);
  }, [M, narrow, size, chrome, centreOn, move]);

  const fitAll = () => { const k = Math.min((size.w - 32) / M.W, (size.h - 200 - chrome) / M.H); move({ k, x: (size.w - M.W * k) / 2, y: 136 + chrome + (size.h - 200 - chrome - M.H * k) / 2 }, true); };
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = headRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight));
    ro.observe(el); setHeadH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  const first = useRef(true);
  useLayoutEffect(() => { if (size.w && first.current) { first.current = false; frameLines(litLines, false, routeIds, !roleKey && stage ? M.STAGE_BY_ID.get(stage)?.start : undefined); } }, [size.w, litLines, routeIds, frameLines]); // eslint-disable-line react-hooks/exhaustive-deps -- frames once, from the route the page opened with

  /* ---------- pointer: drag to pan, two fingers or ctrl+wheel to zoom ---------- */
  const viewRef = useRef(view);
  useLayoutEffect(() => { viewRef.current = view; });
  const moved = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const pts = new Map<number, { x: number; y: number }>([[e.pointerId, { x: e.clientX, y: e.clientY }]]);
    const start = { ...viewRef.current }, from = { x: e.clientX, y: e.clientY };
    let pinch0 = 0; moved.current = false;
    const rect = boxRef.current!.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 1) {
        const dx = ev.clientX - from.x, dy = ev.clientY - from.y;
        if (!moved.current && Math.hypot(dx, dy) < 5) return;
        moved.current = true; setHint(false); setAnimate(false);
        setView({ k: start.k, x: start.x + dx, y: start.y + dy });
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!pinch0) pinch0 = d / viewRef.current.k;
        moved.current = true; setAnimate(false);
        const cur = viewRef.current, k = Math.min(MAX_K, Math.max(fitK * 0.5, d / pinch0)), mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
        setView({ k, x: mx - (mx - cur.x) * (k / cur.k), y: my - (my - cur.y) * (k / cur.k) });
      }
    };
    const onUp = (ev: PointerEvent) => {
      pts.delete(ev.pointerId);
      if (!pts.size) { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); }
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
    // a second finger joins the same gesture
    const onSecond = (ev: PointerEvent) => { if (ev.pointerId !== e.pointerId && pts.size) pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); };
    boxRef.current!.addEventListener("pointerdown", onSecond, { once: true });
  };
  const zoomBy = useCallback((f: number, mx = size.w / 2, my = size.h / 2, smooth = true) => {
    const cur = viewRef.current, k = Math.min(MAX_K, Math.max(fitK * 0.5, cur.k * f));
    move({ k, x: mx - (mx - cur.x) * (k / cur.k), y: my - (my - cur.y) * (k / cur.k) }, smooth);
  }, [fitK, size, move]);
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return; // plain scrolling still moves the page
      e.preventDefault(); const r = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  /* ---------- actions ---------- */
  const pick = (s: Sel) => {
    setSel(s); setHint(false);
    if (!s) return;
    const n = s.kind === "st" ? M.STATION_BY_ID.get(s.id)! : null, g = s.kind === "gt" ? M.GATE_BY_ID.get(s.id)! : null;
    const cx = n ? M.px(n.x) : M.px(g!.x), cy = n ? M.py(n.row) : (M.py(M.gateRow(g!)) + M.py(M.gateBottom(g!))) / 2;
    centreOn(cx, cy, Math.max(viewRef.current.k, narrow ? 0.8 : 1.05), true, narrow ? 0 : 380, narrow);
  };
  const choose = (id: FocusId) => { setProblemId(null); setFocus(id); setRoleKey(null); setSel(null); setHint(false); setPicker(false); setStagePicker(false); setStage(null); setStageOpen(false); setCtrl(false); setLevel(null); setLevelPicker(false); setOrgSize(null); setSizeOpen(false); const r = M.buildRoute(null, id, mode, null, null); frameLines(new Set<LineId>(M.STATIONS.filter((st) => r.ids.has(st.id)).map((st) => st.line)), true, r.ids); };
  const chooseRole = (key: string | null) => {
    setProblemId(null); setRoleKey(key); setPicker(false); setStagePicker(false); setStage(null); setStageOpen(false); setLevel(null); setLevelPicker(false); setOrgSize(null); setSizeOpen(false); setPq(""); setSel(null); setHint(false); setCtrl(false);
    const r = data.roles.find((x) => x.key === key);
    if (!r) { setFocus("all"); frameLines(new Set<LineId>(M.LINES.map((l) => l.id))); return; }
    const rt = M.buildRoute(r, "all", mode, null, null);
    frameLines(new Set<LineId>(M.STATIONS.filter((st) => rt.ids.has(st.id)).map((st) => st.line)), true, rt.ids);
  };
  const chooseStage = (id: StageId) => {
    setProblemId(null); setQuiz(null); setStage(id); setRoleKey(null); setLevel(null); setLevelPicker(false); setFocus("all"); setSel(null); setHint(false); setPicker(false); setStagePicker(false); setCtrl(false); setStageOpen(!narrow);
    const r = M.buildRoute(null, "all", mode, id, orgSize);
    frameLines(new Set<LineId>(M.STATIONS.filter((st) => r.ids.has(st.id)).map((st) => st.line)), true, r.ids, M.STAGE_BY_ID.get(id)?.start);
  };
  /** Someone says what is wrong in their own words and picks the closest match: its stops light up and the first one opens. */
  /** An anonymous daily count of what people pick (never who, never what they typed); a failure here must never get in the way. */
  const logPick = (kind: "pick" | "stop" | "nomatch", ids: string[] = []) => { logProblemAction(kind, mapId, ids).catch(() => {}); };
  const chooseProblem = (id: string | null) => {
    const p = combineProblems(id, M.PROBLEMS);
    if (p) logPick("pick", p.id.split("+"));
    setProblemId(p ? p.id : null); setChecker(false); setTicks([]); setRoleKey(null); setStage(null); setStageOpen(false); setLevel(null); setLevelPicker(false); setOrgSize(null); setSizeOpen(false); setFocus("all");
    setPicker(false); setStagePicker(false); setSizePicker(false); setFopen(false); setFq(""); setHint(false); setCtrl(false); setSel(null);
    const rt = M.buildRoute(null, "all", mode, null, null, null, p?.stops ?? null);
    frameLines(new Set<LineId>(M.STATIONS.filter((st) => rt.ids.has(st.id)).map((st) => st.line)), true, rt.ids, p?.stops[0]);
  };
  const chooseMode = (m: AiMode) => {
    setMode(m); setSel(null); setHint(false);
    const rt = M.buildRoute(role, focus, m, stage, orgSize, level, problem?.stops ?? null);
    frameLines(new Set<LineId>(M.STATIONS.filter((st) => rt.ids.has(st.id)).map((st) => st.line)), true, rt.ids, !role && stage ? M.STAGE_BY_ID.get(stage)?.start : undefined);
  };
  const chooseSize = (id: string | null) => {
    setOrgSize(id); setSizePicker(false); setStagePicker(false); setPicker(false); setSel(null); setHint(false); setCtrl(false); setSizeOpen(!!id && !narrow);
    const rt = M.buildRoute(role, focus, mode, stage, id, level, problem?.stops ?? null);
    frameLines(new Set<LineId>(M.STATIONS.filter((st) => rt.ids.has(st.id)).map((st) => st.line)), true, rt.ids, !role && stage ? M.STAGE_BY_ID.get(stage)?.start : undefined);
  };
  const chooseLevel = (n: number | null) => {
    setLevel(n); setLevelPicker(false); setSel(null); setHint(false); setCtrl(false);
    const rt = M.buildRoute(role, focus, mode, stage, orgSize, n, problem?.stops ?? null);
    frameLines(new Set<LineId>(M.STATIONS.filter((st) => rt.ids.has(st.id)).map((st) => st.line)), true, rt.ids);
  };
  /** What the chosen level means for one stop: the rung of the ladder where it starts to matter, when that is higher than this one. */
  const levelLater = (stopId: string) => { const at = route.waiting.get(stopId); return at && role?.rungs?.[at - 1]?.title || null; };
  /** What the chosen size means for one stop: who usually owns it, a note if it differs, and when it starts to matter. */
  const sizeInfo = (stopId: string) => {
    const z = orgSize ? M.SIZE_BY_ID.get(orgSize) : null;
    if (!orgSize || !z) return null;
    const si = M.SIZES.findIndex((x) => x.id === orgSize), at = M.sizeFrom(stopId);
    return { label: z.label, text: M.sizeNote(stopId, orgSize) ?? z.owner, later: at > si ? M.SIZES[at].label : null };
  };
  const chooseSector = (id: string | null) => {
    setSector(id); setSectorPicker(false); setPicker(false); setStagePicker(false); setSizePicker(false); setLevelPicker(false); setSectorOpen(!!id && !narrow); setHint(false); setCtrl(false);
  };
  /** What the chosen kind of business means for one stop, when it says anything about it. */
  const sectorInfo = (stopId: string) => { const s = sector ? M.SECTOR_BY_ID.get(sector) : null, text = s ? M.sectorNote(stopId, s.id) : null; return s && text ? { label: s.label, text } : null; };
  /** Picks one of the finder's results, as a click or Enter on the highlighted one does. */
  const chooseOption = (o: { kind: "problem" | "stop"; id: string }) => {
    if (o.kind === "problem") { chooseProblem(o.id); return; }
    setProblemId(null); setFocus("all"); setFopen(false); setFq(""); setActiveOpt(-1); logPick("stop", [o.id]); pick({ kind: "st", id: o.id });
  };
  const goNext = () => { if (next) pick({ kind: "st", id: next.id }); };

  /* The address bar always holds the current route, so it can be copied as it is; Share also offers it to the phone's share sheet. */
  const query = useMemo(() => {
    const keepAll = !roleKey && !stage && focus === "all" && (!!data.defaultRole || data.defaultFocus !== "all"); // "everything" is a choice when someone's own default is narrower
    return pickQuery({ sector, problem: problemId, role: roleKey, area: !roleKey && !stage && (focus !== "all" || keepAll) ? focus : null, stage: roleKey ? null : stage, size: orgSize, level: roleKey ? level : null, mode });
  }, [sector, problemId, roleKey, focus, stage, orgSize, level, mode, data.defaultRole, data.defaultFocus]);
  const asId = data.viewingAs?.id; // a manager's view of someone else's map stays in the address bar, but is never put in a share link
  useEffect(() => { if (standalone) window.history.replaceState(null, "", `${window.location.pathname}${asId ? `${query ? `${query}&` : "?"}as=${asId}` : query}`); }, [standalone, query, asId]);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}${query}`;
    const title = `${role ? aiRoleName(role.name, mode) : stage ? M.STAGE_BY_ID.get(stage)!.label : "My route"}: ${M.words.routeWord}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    } catch { /* closing the share sheet is not an error */ }
  };
  const shareButton = standalone && query && (
    <button type="button" onClick={share} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/15 bg-[#fff] px-3 py-1 text-[13px] font-semibold shadow-sm hover:border-indigo-400 hover:text-indigo-300">
      <Share2 size={14} aria-hidden />{copied ? "Link copied" : "Share this route"}
    </button>
  );
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const panel = !!sel || !!problem || !!(sector && sectorOpen) || !!(stage && stageOpen) || !!(orgSize && sizeOpen); // something is open on the right
  const showLabels = view.k >= 0.55;
  const selStation = sel?.kind === "st" ? M.STATION_BY_ID.get(sel.id) ?? null : null;
  const selGate = sel?.kind === "gt" ? M.GATE_BY_ID.get(sel.id) ?? null : null;

  return (
    <ModelCtx.Provider value={M}>
    <section aria-label={M.words.aria} className={`lm relative isolate overflow-hidden bg-[#fbfaf6] ${signage}`} style={{ height: standalone ? "100svh" : "calc(100svh - 3.4rem)", minHeight: 520 }}>
      {auth && authMode && !data.signedIn && <AuthModal mode={authMode} kit={auth} next={back} onMode={setAuthMode} onClose={() => setAuthMode(null)} />}
      <style>{`
        .lm .ln{animation:draw 1.6s cubic-bezier(.4,0,.2,1) both}
        .lm .pulse{animation:lmpulse 2s ease-out infinite;transform-box:fill-box;transform-origin:center}
        @keyframes lmpulse{0%{transform:scale(.7);opacity:.9}100%{transform:scale(2.1);opacity:0}}
        .lm .st:hover .nm,.lm .st:focus-visible .nm{text-decoration:underline}
        @media (prefers-reduced-motion:reduce){.lm .ln,.lm .pulse{animation:none}.lm .train{display:none}}
      `}</style>

      {/* the map */}
      <div ref={boxRef} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing" onPointerDown={onPointerDown}>
        <svg width={size.w} height={size.h} role="group" aria-label={`Map: ${M.LINES.length} lines, ${M.ZONES.length} phases, ${M.GATES.length} handoff gates`}>
          <g style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transition: animate ? "transform .75s cubic-bezier(.2,.8,.2,1)" : "none" }}>
            {/* phases */}
            {M.ZONES.map((z, i) => {
              const x0 = i === 0 ? 0 : M.px(z.from), x1 = i === M.ZONES.length - 1 ? M.W : M.px(z.to);
              return (
                <g key={z.name}>
                  <rect x={x0} y={0} width={x1 - x0} height={M.H} fill={i % 2 ? "#f4f2ea" : "#fbfaf6"} />
                  {i > 0 && <line x1={x0} x2={x0} y1={0} y2={M.H} stroke="#14161f" strokeOpacity={0.12} strokeDasharray="3 5" />}
                  <text x={x0 + 14} y={36} fontSize={21} fontWeight={700} letterSpacing=".14em" fill="#14161f" fillOpacity={0.78}>{i + 1}  {z.name.toUpperCase()}</text>
                  <text x={x0 + 14} y={60} fontSize={16} fontWeight={500} fill="#5b6375">{z.sub}</text>
                </g>
              );
            })}

            {/* lines */}
            {M.LINES.map((l) => {
              const xs = M.SEQ[l.id].map((n) => (n.kind === "st" ? n.st.x : n.gate.x)), a = M.px(Math.min(...xs)), b = M.px(Math.max(...xs)), y = M.py(l.row), c = M.LINE_COLOUR[l.id];
              const on = !dimming || litLines.has(l.id);
              return (
                <g key={l.id} style={{ opacity: on ? 1 : 0.16, transition: "opacity .4s" }}>
                  <line className="ln" pathLength={1} strokeDasharray={1} x1={a} x2={b} y1={y} y2={y} stroke={c} strokeWidth={l.hollow ? 13 : 10} strokeLinecap="butt" />
                  {l.hollow && <line x1={a} x2={b} y1={y} y2={y} stroke="#fbfaf6" strokeWidth={4} />}
                  {on && dimming && !l.hollow && (
                    <g className="train">
                      <rect x={-13} y={-7} width={26} height={14} rx={4} fill="#fff" stroke={c} strokeWidth={3} />
                      <animateMotion dur={`${14 + l.row}s`} repeatCount="indefinite" path={`M${a},${y} L${b},${y}`} />
                    </g>
                  )}
                </g>
              );
            })}

            {/* gates */}
            {M.GATES.map((g) => {
              const X = M.px(g.x), r0 = M.gateRow(g), r1 = M.gateBottom(g), wl = wrapWords(g.name, 12), top0 = 92;
              const on = !dimming || g.lines.some((id) => litLines.has(id)), isSel = sel?.kind === "gt" && sel.id === g.id;
              return (
                <g key={g.id} role="button" tabIndex={0} aria-label={`Handoff gate: ${g.name}`} className="cursor-pointer outline-none" style={{ opacity: on ? 1 : 0.2, transition: "opacity .4s" }}
                  onClick={() => { if (!moved.current) pick({ kind: "gt", id: g.id }); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick({ kind: "gt", id: g.id }); } }}>
                  <line x1={X} x2={X} y1={top0 + wl.length * 23 - 8} y2={M.py(r0) - 12} stroke="#5b6375" strokeWidth={1.2} strokeDasharray="2 3" />
                  {r1 > r0 && <rect x={X - 8} y={M.py(r0)} width={16} height={M.py(r1) - M.py(r0)} fill="#fbfaf6" stroke="#14161f" strokeWidth={3} />}
                  {g.lines.map((id) => <circle key={id} cx={X} cy={M.py(M.LINE_BY_ID[id].row)} r={11} fill="#fbfaf6" stroke={isSel ? "#4f46e5" : "#14161f"} strokeWidth={isSel ? 4 : 3} />)}
                  {wl.map((t, i) => <text key={i} x={X} y={top0 + i * 23} textAnchor="middle" fontSize={20} fontWeight={700} fill={isSel ? "#4f46e5" : "#14161f"}>{t}</text>)}
                  <rect x={X - 72} y={top0 - 20} width={144} height={wl.length * 23 + 10} fill="transparent" />
                  <rect x={X - 15} y={M.py(r0) - 15} width={30} height={M.py(r1) - M.py(r0) + 30} fill="transparent" />
                </g>
              );
            })}

            {/* line names, drawn over the gates so a handoff bar never cuts through one */}
            {M.LINES.map((l) => {
              const xs = M.SEQ[l.id].map((n) => (n.kind === "st" ? n.st.x : n.gate.x)), a = M.px(Math.min(...xs)), y = M.py(l.row), c = M.LINE_COLOUR[l.id];
              const on = !dimming || litLines.has(l.id), pw = l.name.length * 9.4 + 34;
              return (
                <g key={l.id} pointerEvents="none" style={{ opacity: on ? 1 : 0.16, transition: "opacity .4s" }}>
                  <rect x={a - 18 - pw} y={y - 17} width={pw} height={34} rx={17} fill={c} />
                  <text x={a - 18 - pw / 2} y={y + 6.5} textAnchor="middle" fontSize={18} fontWeight={600} fill={l.id === "doc" ? "#14161f" : "#fff"}>{l.name}</text>
                </g>
              );
            })}

            {/* stations */}
            {M.STATIONS.map((st) => {
              const X = M.px(st.x), Y = M.py(st.row), c = M.LINE_COLOUR[st.line], t = data.tracks[st.track], mk = markOf(t);
              const on = !dimming || routeIds.has(st.id), isNext = next?.id === st.id, isGoal = ends?.goal.id === st.id && !isNext, isSel = sel?.kind === "st" && sel.id === st.id, lift = st.tier * 22, above = true; // labels always sit above the line, on a second tier when they would collide
              const tx = st.anchor === "start" ? st.L : st.anchor === "end" ? st.R : X, frac = Math.min(1, (t?.passed ?? 0) / 20), C = 2 * Math.PI * 16;
              const label = showLabels && (on || isSel) || isNext || isGoal || isSel;
              return (
                <g key={st.id} role="button" tabIndex={0} aria-label={`${st.name}${t ? `, ${t.passed > 0 ? `level ${t.passed} of 20${t.passed > t.earned ? ", a starting level" : ""}` : "not started"}` : ""}`} className="st cursor-pointer outline-none"
                  style={{ opacity: on ? 1 : 0.14, transition: "opacity .4s" }}
                  onClick={() => { if (!moved.current) pick({ kind: "st", id: st.id }); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick({ kind: "st", id: st.id }); } }}>
                  {isNext && !isSel && <circle className="pulse" cx={X} cy={Y} r={16} fill="none" stroke={c} strokeWidth={4} />}
                  {(isSel || mk === "learning" || mk === "solid") && <circle cx={X} cy={Y} r={16} fill="none" stroke={isSel ? "#4f46e5" : c} strokeOpacity={isSel ? 1 : 0.9} strokeWidth={isSel ? 4.5 : 4} strokeDasharray={isSel ? undefined : `${C * frac} ${C}`} transform={`rotate(-90 ${X} ${Y})`} />}
                  <circle cx={X} cy={Y} r={mk === "titan" ? 11 : 9} fill={mk === "titan" ? "#f5b800" : mk === "solid" ? c : "#fbfaf6"} stroke={mk === "titan" ? "#14161f" : c} strokeWidth={4} />
                  {t?.required && t.overdue && <circle cx={X + 11} cy={Y - 11} r={5.5} fill="#e11d48" stroke="#fbfaf6" strokeWidth={1.5} />}
                  {t && t.passed > t.earned && <rect x={X - 17} y={Y - 17} width={9} height={9} transform={`rotate(45 ${X - 12.5} ${Y - 12.5})`} fill="#fbfaf6" stroke={c} strokeWidth={2.5} />}
                  {route.agent.has(st.id) && <circle cx={X} cy={Y} r={17} fill="none" stroke="#6d28d9" strokeWidth={3} strokeDasharray="5 4" />}
                  {mode === "ai" && route.ai.has(st.id) && (
                    <g transform={`translate(${X - 19},${above ? Y + 19 : Y - 19})`}><circle r={10} fill="#6d28d9" stroke="#fbfaf6" strokeWidth={2} /><text y={3.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#fff">AI</text></g>
                  )}
                  {mode === "agent" && (route.review.has(st.id) || route.ai.has(st.id)) && (
                    <g transform={`translate(${X - 19},${above ? Y + 19 : Y - 19})`}><circle r={10} fill="#14161f" stroke="#fbfaf6" strokeWidth={2} /><path d="M-4.5,0.5 l3,3 l6,-6.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></g>
                  )}
                  {raceAnchor.has(st.id) && (
                    <g transform={`translate(${X + 19},${above ? Y + 19 : Y - 19})`}>
                      <circle r={11} fill="#f5b800" stroke="#14161f" strokeWidth={2} />
                      <path d="M-4.5,-4 h9 v2.5 a4.5,4.5 0 0 1 -9,0 z M-1,3 h2 v2.5 h-2 z M-3.5,5.5 h7" fill="none" stroke="#14161f" strokeWidth={1.6} strokeLinejoin="round" />
                    </g>
                  )}
                  {label && (
                    <text className="nm" x={tx} y={Y - 24 - lift} textAnchor={st.anchor} fontSize={20} fontWeight={isNext || isSel ? 700 : 500} fill={isSel ? "#4f46e5" : "#14161f"} stroke="#fbfaf6" strokeWidth={4.5} paintOrder="stroke" strokeLinejoin="round">{st.name}</text>
                  )}
                  {data.journey?.locks[st.track] && on && (
                    <g aria-hidden pointerEvents="none"><circle cx={X} cy={Y} r={11} fill="#e9e5d9" stroke="#5b6375" strokeWidth={2} />
                      <rect x={X - 4.5} y={Y - 1} width={9} height={7} rx={1.5} fill="#5b6375" /><path d={`M${X - 3},${Y - 1} v-2.5 a3,3 0 0 1 6,0 v2.5`} fill="none" stroke="#5b6375" strokeWidth={1.8} /></g>
                  )}
                  {isNext && !isSel && (
                    <g transform={`translate(${X},${Y + 36})`}>
                      <rect x={-48} y={-14} width={96} height={27} rx={13} fill="#14161f" />
                      <text y={5} textAnchor="middle" fontSize={15} fontWeight={700} letterSpacing=".06em" fill="#fff">{data.signedIn ? "NEXT STOP" : "START HERE"}</text>
                    </g>
                  )}
                  {isGoal && !isSel && (
                    <g transform={`translate(${X},${Y + 36})`}>
                      <rect x={-34} y={-14} width={68} height={27} rx={13} fill="#4f46e5" />
                      <text y={5} textAnchor="middle" fontSize={15} fontWeight={700} letterSpacing=".06em" fill="#fff">GOAL</text>
                    </g>
                  )}
                  <circle cx={X} cy={Y} r={20} fill="transparent" />
                  {label && <rect x={st.L - 4} y={Y - 46 - lift} width={st.R - st.L + 8} height={46 + lift} fill="transparent" />}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* welcome and the one question */}
      <div ref={headRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-[#fbfaf6] from-85% to-transparent px-3 pb-7 pt-3 sm:px-5 sm:pt-4">
        {standalone && (
          <div className="pointer-events-auto mb-2 flex items-center gap-3 text-sm">
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#fff] px-3 py-1 font-semibold shadow-sm hover:shadow-md"><ArrowLeft size={14} />{standalone.brand}</Link>
            {MAP_LIST.length > 1 && (
              <nav aria-label="Maps" className="inline-flex overflow-hidden rounded-full border border-black/15 bg-[#fff] text-[13px] font-semibold shadow-sm">
                {MAP_LIST.map((x) => <Link key={x.id} href={data.viewingAs ? `${x.href}?as=${data.viewingAs.id}` : x.href} aria-current={x.id === M.id ? "page" : undefined} className={`px-3 py-1 transition ${x.id === M.id ? "bg-[#14161f] text-[#fff]" : "hover:bg-black/5"}`}>{x.label}</Link>)}
              </nav>
            )}
            {data.viewingAs && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-[13px] font-semibold">
                Viewing {data.viewingAs.name}&apos;s map
                <Link href={MAP_LIST.find((x) => x.id === M.id)?.href ?? "/map"} className="text-indigo-300 underline">Back to mine</Link>
              </span>
            )}
            <span className="ml-auto flex items-center gap-2">
              {data.signedIn ? <Link href="/dashboard" className="font-semibold text-indigo-300 hover:underline">My quest</Link> : openSignIn ? <button type="button" onClick={openSignIn} className="btn !px-3.5 !py-1 text-[13px]">Sign in</button> : <Link href="/login" className="btn !px-3.5 !py-1 text-[13px]">Sign in</Link>}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div className="pointer-events-auto">
            <p className="hidden text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400 sm:block">{M.words.kicker}</p>
            <h1 className="mt-0.5 text-[1.2rem] font-bold leading-[1.05] sm:text-[1.6rem]">
              {data.viewingAs ? <>{data.firstName}&apos;s map. <span className="text-indigo-300">Where they are now.</span></> : data.signedIn ? <>Welcome back, {data.firstName}. <span className="text-indigo-300">Here is your route.</span></> : <>{M.words.headline[0]} <span className="text-indigo-300">{M.words.headline[1]}</span></>}
            </h1>
          </div>
          {/* The width is measured after the first paint, so until then the page cannot tell a phone from a desktop: showing the full controls would flash them open on a phone and then fold them away (and a tap in that moment lands on the wrong thing). Keep them hidden, with their space reserved, until the width is known. */}
          <div className="pointer-events-auto min-w-0 flex-1 basis-[22rem]" style={size.w > 0 ? undefined : { visibility: "hidden" }}>
            {narrow && !ctrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setCtrl(true)} aria-expanded={false}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/20 bg-[#fff] px-3.5 py-1.5 text-[14px] font-bold shadow-sm hover:border-indigo-400">
                  <span className="truncate">{role ? aiRoleName(role.name, mode) : stage ? M.STAGE_BY_ID.get(stage)!.label : focus !== "all" ? M.FOCUS.find((f) => f.id === focus)?.label : "Choose your route"}</span><ChevronDown size={15} className="shrink-0" />
                </button>
                {shareButton}
                {betterMapNote}
              </div>
            ) : (
              <>
                {M.PROBLEMS.length > 0 && (
                  <div className="relative mb-2.5">
                    <label className="flex items-center gap-2 rounded-2xl border border-black/20 bg-[#fff] px-3.5 py-2 shadow-sm focus-within:border-indigo-400">
                      <Lightbulb size={16} className="shrink-0 text-amber-500" />
                      <input ref={finderRef} value={fq} onChange={(e) => { setFq(e.target.value); setFopen(true); setActiveOpt(-1); }} onFocus={() => setFopen(true)}
                        onKeyDown={(e) => {
                          const n = finderOptions.length;
                          if (e.key === "ArrowDown") { e.preventDefault(); setFopen(true); if (n) setActiveOpt((i) => (i + 1) % n); }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setFopen(true); if (n) setActiveOpt((i) => (i <= 0 ? n - 1 : i - 1)); }
                          else if (e.key === "Home" && fopen && n) { e.preventDefault(); setActiveOpt(0); }
                          else if (e.key === "End" && fopen && n) { e.preventDefault(); setActiveOpt(n - 1); }
                          else if (e.key === "Escape") { if (fopen) { e.preventDefault(); setFopen(false); setActiveOpt(-1); } }
                          else if (e.key === "Enter") {
                            e.preventDefault();
                            const o = activeOpt >= 0 ? finderOptions[activeOpt] : undefined, h = findProblems(fq, M.PROBLEMS, 1)[0];
                            if (o) chooseOption(o); else if (h) chooseProblem(h.id); else if (fq.trim()) logPick("nomatch");
                          }
                        }}
                        placeholder="Not sure where to start? Say what is going wrong, in your own words…" aria-label="Say what is going wrong" role="combobox" aria-autocomplete="list" aria-expanded={fopen} aria-controls="problem-list" aria-activedescendant={fopen && activeOpt >= 0 ? `finder-opt-${activeOpt}` : undefined} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
                      {(fq || problem) && <button type="button" aria-label="Clear" onClick={() => { setFq(""); if (problem) chooseProblem(null); finderRef.current?.focus(); }} className="rounded-full p-0.5 text-slate-400 hover:bg-black/5"><X size={14} /></button>}
                    </label>
                    {problem && !fopen && <p className="mt-1 px-1 text-[12.5px] text-slate-300">Showing help for: <b className="font-semibold">{problem.say}</b></p>}
                    {fopen && (
                        <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(34rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-2 shadow-2xl">
                          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">{fq.trim() ? (finderHits.length ? "Closest to what you said" : "No match yet") : "Common situations: pick the one that sounds like you"}</p>
                          <ul id="problem-list" role="listbox" aria-label="Problems" className="max-h-80 overflow-auto">
                            {finderHits.map((p, i) => (
                              <li key={p.id} role="presentation"><button type="button" id={`finder-opt-${i}`} role="option" tabIndex={-1} aria-selected={i === activeOpt} onClick={() => chooseProblem(p.id)} onMouseMove={() => setActiveOpt(i)} className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5 ${i === activeOpt ? "bg-indigo-50 ring-2 ring-indigo-400" : ""}`}>
                                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{p.say}</span><span className="block text-[12px] text-slate-400">{p.stops.length} stops · starts at {M.STATION_BY_ID.get(p.stops[0])?.name}</span></span></button></li>
                            ))}
                            {stopHits.length > 0 && <li role="presentation" className="mt-1 border-t border-black/10 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Or go straight to a stop</li>}
                            {stopHits.map((s, j) => { const i = finderHits.length + j; return (
                              <li key={s.id} role="presentation"><button type="button" id={`finder-opt-${i}`} role="option" tabIndex={-1} aria-selected={i === activeOpt} onClick={() => chooseOption({ kind: "stop", id: s.id })} onMouseMove={() => setActiveOpt(i)} className={`block w-full rounded-lg px-3 py-1.5 text-left text-[14px] font-semibold hover:bg-black/5 ${i === activeOpt ? "bg-indigo-50 ring-2 ring-indigo-400" : ""}`}>{s.name}</button></li>
                            ); })}
                            {!finderHits.length && <li className="px-3 py-2 text-[13px] text-slate-400">Try fewer or simpler words (for example “cash”, “hiring”, “customers leave”), or pick one of the areas below.</li>}
                          </ul>
                          {!checker ? (
                            <button type="button" onClick={() => setChecker(true)} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-indigo-300 hover:bg-black/5">Can&apos;t say what is wrong? Tick everything that sounds like you</button>
                          ) : (
                            <div className="mt-1 border-t border-black/10 px-3 pb-2 pt-2">
                              <p className="pb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Tick as many as fit (up to four)</p>
                              <ul className="max-h-56 overflow-auto">
                                {M.PROBLEMS.filter((p) => p.common || p.id === "symptom").map((p) => (
                                  <li key={p.id}><label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1.5 text-[13.5px] hover:bg-black/5">
                                    <input type="checkbox" className="mt-1" checked={ticks.includes(p.id)} disabled={!ticks.includes(p.id) && ticks.length >= 4} onChange={(e) => setTicks(e.target.checked ? [...ticks, p.id] : ticks.filter((x) => x !== p.id))} /><span>{p.say}</span></label></li>
                                ))}
                              </ul>
                              <button type="button" disabled={!ticks.length} onClick={() => chooseProblem(ticks.join("+"))} className="btn mt-2 w-full !py-1.5 text-[13px] disabled:opacity-40">{ticks.length ? `Show a route for these ${ticks.length}` : "Tick at least one"}</button>
                            </div>
                          )}
                          <button type="button" onClick={() => { if (fq.trim() && !finderHits.length && !stopHits.length) logPick("nomatch"); setFopen(false); }} className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-[12.5px] font-semibold text-slate-400 hover:bg-black/5">Close</button>
                        </div>
                    )}
                  </div>
                )}
                <p className="mb-1.5 text-[13px] font-semibold text-slate-300">{M.PROBLEMS.length > 0 ? "Or choose what you want to work on" : "What do you want to work on?"}</p>
                <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="What do you want to work on?">
                  {M.FOCUS.map((f) => (
                    <button key={f.id} type="button" aria-pressed={!role && !stage && focus === f.id} onClick={() => choose(f.id)}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-semibold transition ${!role && !stage && focus === f.id ? "border-[#14161f] bg-[#14161f] text-[#fff]" : "border-black/15 bg-[#fff] hover:border-indigo-400 hover:text-indigo-300"}`}>{f.label}</button>
                  ))}
                </div>
                <div className="relative mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-300">
                  <span>or I am a</span>
                  <button type="button" onClick={() => { setPicker((v) => !v); setStagePicker(false); setSizePicker(false); setLevelPicker(false); }} aria-expanded={picker} aria-haspopup="listbox"
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[14px] font-bold shadow-sm transition ${role ? "border-indigo-400 bg-indigo-50 text-indigo-300" : "border-black/20 bg-[#fff] hover:border-indigo-400"}`}>
                    {role ? aiRoleName(role.name, mode) : "Choose your role"}<ChevronDown size={15} />
                  </button>
                  {role && (role.rungs?.length ?? 0) > 1 && (
                    <>
                      <span>and I am at</span>
                      <button type="button" onClick={() => { setLevelPicker((v) => !v); setPicker(false); setStagePicker(false); setSizePicker(false); }} aria-expanded={levelPicker} aria-haspopup="listbox"
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[14px] font-bold shadow-sm transition ${level ? "border-indigo-400 bg-indigo-50 text-indigo-300" : "border-black/20 bg-[#fff] hover:border-indigo-400"}`}>
                        <span className="max-w-[12rem] truncate">{level ? role.rungs![level - 1].title : "Any level"}</span><ChevronDown size={15} className="shrink-0" />
                      </button>
                    </>
                  )}
                  <span>{M.words.stageIs ?? "or my company is"}</span>
                  <button type="button" onClick={() => { setStagePicker((v) => !v); setPicker(false); setSizePicker(false); setLevelPicker(false); }} aria-expanded={stagePicker} aria-haspopup="listbox"
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[14px] font-bold shadow-sm transition ${stage ? "border-indigo-400 bg-indigo-50 text-indigo-300" : "border-black/20 bg-[#fff] hover:border-indigo-400"}`}>
                    <span className="max-w-[11rem] truncate">{stage ? M.STAGE_BY_ID.get(stage)!.label : "At a stage…"}</span><ChevronDown size={15} className="shrink-0" />
                  </button>
                  {M.SIZES.length > 0 && stage && !role && (
                    <>
                      <span>and it is</span>
                      <button type="button" onClick={() => { setSizePicker((v) => !v); setPicker(false); setStagePicker(false); setLevelPicker(false); }} aria-expanded={sizePicker} aria-haspopup="listbox"
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[14px] font-bold shadow-sm transition ${orgSize ? "border-indigo-400 bg-indigo-50 text-indigo-300" : "border-black/20 bg-[#fff] hover:border-indigo-400"}`}>
                        {orgSize ? M.SIZE_BY_ID.get(orgSize)!.label : "Any size"}<ChevronDown size={15} />
                      </button>
                    </>
                  )}
                  {M.SECTORS.length > 0 && (
                    <>
                      <span>in</span>
                      <button type="button" onClick={() => { setSectorPicker((v) => !v); setPicker(false); setStagePicker(false); setSizePicker(false); setLevelPicker(false); }} aria-expanded={sectorPicker && !picker && !stagePicker && !sizePicker && !levelPicker} aria-haspopup="listbox"
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[14px] font-bold shadow-sm transition ${sector ? "border-indigo-400 bg-indigo-50 text-indigo-300" : "border-black/20 bg-[#fff] hover:border-indigo-400"}`}>
                        <span className="max-w-[12rem] truncate">{sector ? M.SECTOR_BY_ID.get(sector)!.label : "Any kind of business"}</span><ChevronDown size={15} className="shrink-0" />
                      </button>
                    </>
                  )}
              {sizePicker && (
                <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-2 shadow-2xl">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">How big is your organisation?</p>
                  <ul role="listbox" aria-label="Organisation sizes">
                    <li role="presentation"><button type="button" role="option" aria-selected={!orgSize} onClick={() => chooseSize(null)} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5"><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Any size</span><span className="block text-[12px] text-slate-400">Show every stop</span></span>{!orgSize && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                    {M.SIZES.map((z, i) => (
                      <li key={z.id} role="presentation"><button type="button" role="option" aria-selected={z.id === orgSize} onClick={() => chooseSize(z.id)} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#14161f] text-[11px] font-bold text-[#fff]">{i + 1}</span>
                        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{z.label}</span><span className="block text-[12px] text-slate-400">{z.people}</span></span>{z.id === orgSize && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                    ))}
                  </ul>
                </div>
              )}
              {sectorPicker && !picker && !stagePicker && !sizePicker && !levelPicker && (
                <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(26rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-2 shadow-2xl">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">What kind of business is it?</p>
                  <ul role="listbox" aria-label="Kinds of business" className="max-h-80 overflow-auto">
                    <li role="presentation"><button type="button" role="option" aria-selected={!sector} onClick={() => chooseSector(null)} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5"><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Any kind of business</span><span className="block text-[12px] text-slate-400">No sector notes</span></span>{!sector && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                    {M.SECTORS.map((z) => (
                      <li key={z.id} role="presentation"><button type="button" role="option" aria-selected={z.id === sector} onClick={() => chooseSector(z.id)} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5">
                        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{z.label}</span><span className="block text-[12px] text-slate-400">{z.blurb}</span></span>{z.id === sector && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                    ))}
                  </ul>
                </div>
              )}
              {levelPicker && role && (
                <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-2 shadow-2xl">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Which level are you at right now?</p>
                  <ul role="listbox" aria-label="Career levels">
                    <li role="presentation"><button type="button" role="option" aria-selected={!level} onClick={() => chooseLevel(null)} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5"><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Any level</span><span className="block text-[12px] text-slate-400">Show every stop for this role</span></span>{!level && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                    {role.rungs!.map((r, i) => (
                      <li key={i} role="presentation"><button type="button" role="option" aria-selected={level === i + 1} onClick={() => chooseLevel(i + 1)} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5">
                        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{r.title}</span><span className="block text-[12px] text-slate-400">{r.summary}</span></span>{level === i + 1 && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                    ))}
                  </ul>
                </div>
              )}
              {stagePicker && (
                <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-2 shadow-2xl">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">{M.words.stageAsk ?? "Where is your company?"}</p>
                  <ul role="listbox" aria-label="Stages">
                    {M.STAGES.map((g, i) => (
                      <li key={g.id} role="presentation"><button type="button" role="option" aria-selected={g.id === stage} onClick={() => chooseStage(g.id)} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#14161f] text-[11px] font-bold text-[#fff]">{i + 1}</span>
                        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{g.label}</span><span className="block text-[12px] text-slate-400">{g.ask}</span></span>{g.id === stage && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                    ))}
                  </ul>
                  {!quiz ? (
                    <button type="button" onClick={() => setQuiz({})} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-indigo-300 hover:bg-black/5">Not sure which one is you? Answer a few quick questions</button>
                  ) : (
                    <div className="mt-1 border-t border-black/10 px-3 pb-2 pt-2">
                      {STAGE_QUESTIONS.map((q) => (
                        <div key={q.id} className="flex items-center gap-2 py-1 text-[13px]">
                          <span className="min-w-0 flex-1">{q.ask}</span>
                          {([true, false] as const).map((v) => <button key={String(v)} type="button" aria-pressed={quiz[q.id] === v} onClick={() => setQuiz({ ...quiz, [q.id]: v })} className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${quiz[q.id] === v ? "border-[#14161f] bg-[#14161f] text-[#fff]" : "border-black/15 hover:border-indigo-400"}`}>{v ? "Yes" : "No"}</button>)}
                        </div>
                      ))}
                      {M.STAGE_BY_ID.has(suggestStage(quiz)) && <button type="button" onClick={() => chooseStage(suggestStage(quiz) as StageId)} disabled={Object.keys(quiz).length === 0} className="btn mt-2 w-full !py-1.5 text-[13px] disabled:opacity-40">{Object.keys(quiz).length ? `That sounds like: ${M.STAGE_BY_ID.get(suggestStage(quiz))!.label}` : "Answer at least one question"}</button>}
                    </div>
                  )}
                </div>
              )}
              {picker && (
                <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-2 shadow-2xl">
                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#fbfaf6] px-3 py-2"><Search size={15} className="text-slate-400" />
                    <input autoFocus value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Business analyst, CFO, policy advisor, software engineer…" aria-label="Find your role" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" /></label>
                  <ul role="listbox" aria-label="Roles" className="mt-1.5 max-h-80 overflow-auto">
                    {role && <li role="presentation"><button type="button" onClick={() => chooseRole(null)} className="w-full rounded-lg px-3 py-2 text-left text-[14px] text-slate-400 hover:bg-black/5">Any role: show everything</button></li>}
                    {(() => {
                      const q = pq.trim().toLowerCase();
                      const hit = (r: RoleInfo) => !q || [r.name, r.family, r.blurb, ...r.aliases].some((n) => n.toLowerCase().includes(q));
                      const shown = data.roles.filter(hit);
                      if (!shown.length) return <li role="presentation" className="px-3 py-2 text-[14px] text-slate-400">No role matches “{pq.trim()}”. {M.PROBLEMS.length > 0 ? <button type="button" onClick={() => { setPicker(false); setFq(pq.trim()); setPq(""); setFopen(true); finderRef.current?.focus(); }} className="font-semibold text-indigo-300 underline">Say what you need help with instead</button> : M.words.coverage}</li>;
                      const fams = [...new Set(shown.map((r) => r.family))].sort((a, b) => (FAMILY_ORDER.indexOf(a) + 100) % 100 - (FAMILY_ORDER.indexOf(b) + 100) % 100);
                      return fams.map((f) => (
                        <li key={f} role="presentation">
                          <p className="sticky top-0 bg-[#fff] px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">{f}</p>
                          <ul role="group" aria-label={f}>
                            {shown.filter((r) => r.family === f).map((r) => (
                              <li key={r.key} role="presentation"><button type="button" role="option" aria-selected={r.key === roleKey} onClick={() => chooseRole(r.key)} className="flex w-full items-start gap-2 rounded-lg px-3 py-1.5 text-left hover:bg-black/5">
                                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{r.name}</span><span className="block truncate text-[12px] text-slate-400">{r.blurb}</span></span>{r.key === roleKey && <Check size={15} className="mt-1 shrink-0 text-indigo-300" />}</button></li>
                            ))}
                          </ul>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
              )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-300">
                  {M.hasAi && (aiOpen || mode !== "human" ? (
                      <span className="inline-flex overflow-hidden rounded-full border border-black/15 bg-[#fff] text-[13px] font-semibold shadow-sm" role="group" aria-label="Role as a person or with AI">
                        {AI_MODES.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id} title={m.hint} onClick={() => chooseMode(m.id)}
                          className={`px-3 py-1 transition ${mode === m.id ? (m.id === "human" ? "bg-[#14161f] text-[#fff]" : "bg-violet-600 text-[#fff]") : "hover:bg-black/5"}`}>{m.label}</button>)}
                      </span>
                    ) : (
                      <button type="button" onClick={() => setAiOpen(true)} className="rounded-full px-2 py-1 text-[13px] font-semibold text-slate-400 underline decoration-dotted hover:text-indigo-300">Working with AI?</button>
                    ))}
                  {ends && <p className="text-[12.5px] text-slate-400">{data.viewingAs ? "Their route" : "Your route"}: {ends.count} stops, from <b className="font-semibold">{ends.from.name}</b> to <b className="font-semibold">{ends.goal.name}</b>.{role && level && route.waiting.size > 0 && <> {route.waiting.size} more come later, from {role.rungs?.[Math.min(...route.waiting.values()) - 1]?.title ?? "a higher level"}.</>}</p>}
                  {orgSize && !sizeOpen && !sel && <button type="button" onClick={() => setSizeOpen(true)} className="rounded-full px-2 py-1 text-[13px] font-semibold text-indigo-300 underline decoration-dotted">About this size</button>}
                  {stage && !stageOpen && !sel && <button type="button" onClick={() => setStageOpen(true)} className="rounded-full px-2 py-1 text-[13px] font-semibold text-indigo-300 underline decoration-dotted">About this stage</button>}
                  {sector && !sectorOpen && !sel && !problem && <button type="button" onClick={() => setSectorOpen(true)} className="rounded-full px-2 py-1 text-[13px] font-semibold text-indigo-300 underline decoration-dotted">About this kind of business</button>}
                  {shareButton}
                </div>
                {betterMapNote && <div className="mt-1.5">{betterMapNote}</div>}
              </>
            )}
          </div>
          {!standalone && <a href="#below" className="pointer-events-auto hidden shrink-0 items-center gap-1 rounded-full border border-black/10 bg-[#fff] px-3.5 py-1.5 text-[13px] font-semibold shadow-sm hover:shadow-md lg:inline-flex">Explore the academy<ChevronDown size={15} /></a>}
        </div>
      </div>

      {/* controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 sm:bottom-5 sm:right-5" style={{ right: !narrow && panel ? "25rem" : undefined }}>
        <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in" title="Zoom in" className="hidden sm:grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff]/95 shadow-md transition hover:bg-[#fff]"><Plus size={18} /></button>
        <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out" title="Zoom out" className="hidden sm:grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff]/95 shadow-md transition hover:bg-[#fff]"><Minus size={18} /></button>
        <button type="button" onClick={() => fitAll()} aria-label="See the whole map" title="See the whole map" className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff]/95 shadow-md transition hover:bg-[#fff]"><Crosshair size={18} /></button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2 sm:bottom-5">
        {hint && <p className="pointer-events-auto rounded-full bg-[#14161f]/85 px-3.5 py-1.5 text-[13px] font-medium text-[#fff]">{narrow ? "Drag to move · pinch to zoom · tap a stop" : "Drag to move · ctrl or ⌘ + scroll to zoom · click a stop"}</p>}
        <button type="button" onClick={goNext} disabled={!next} className="btn pointer-events-auto !rounded-full !px-4 !py-3 text-[15px] shadow-xl sm:!px-5 sm:text-base">{data.viewingAs ? "Go to their next stop" : data.signedIn ? "Take me to my next stop" : "Start at the first stop"}<ArrowRight size={18} /></button>
      </div>

      {data.journey && (
        <div className="absolute bottom-[7.6rem] left-3 z-10 sm:bottom-[7.8rem] sm:left-5">
          <button type="button" onClick={() => setJpanel((v) => !v)} aria-expanded={jpanel}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[#fff] px-3.5 py-2 text-[14px] font-bold shadow-lg hover:shadow-xl">
            {data.journey.locked ? <Lock size={15} /> : <Check size={15} className="text-emerald-400" />}Your journey · stage {data.journey.current} of {data.journey.total}<ChevronDown size={14} className={jpanel ? "rotate-180" : ""} />
          </button>
          {jpanel && (
            <div className="absolute bottom-12 left-0 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-3 shadow-2xl">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Your journey as {data.journey.roleName}</p>
              <ol className="mt-2 max-h-[20rem] space-y-1.5 overflow-auto">
                {data.journey.stages.map((g) => (
                  <li key={g.n} className={`rounded-xl border p-2.5 ${g.state === "current" ? "border-indigo-400 bg-indigo-50" : "border-black/10 bg-[#fbfaf6]"}`}>
                    <p className="flex items-center gap-2 text-[13px] font-bold">
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] text-[#fff] ${g.state === "done" ? "bg-emerald-500" : g.state === "current" ? "bg-indigo-500" : "bg-slate-400"}`}>{g.state === "done" ? <Check size={12} /> : g.state === "locked" && data.journey!.locked ? <Lock size={11} /> : g.n}</span>
                      Stage {g.n}<span className="font-normal text-slate-400">{g.state === "done" ? " · done" : g.state === "current" ? " · you are here" : data.journey!.locked ? " · locked" : " · later"}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">{g.tracks.map((t) => <button key={t.slug} type="button" onClick={() => { setJpanel(false); const st = M.STATIONS.filter((x) => x.track === t.slug).sort((a, b) => a.x - b.x)[0]; if (st) pick({ kind: "st", id: st.id }); }}
                      className={`rounded-full border px-2 py-0.5 text-[12px] ${t.need && t.passed >= t.need ? "border-emerald-400 text-emerald-300" : "border-black/15"}`}>{t.name}{t.need ? ` ${Math.min(t.passed, t.need)}/${t.need}` : ""}</button>)}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-2 px-1 text-[12.5px] text-slate-400">
                {data.journey.setting === "soft" ? "Your organisation recommends this order but never locks it."
                  : data.journey.setting === "hard" ? "Your organisation locks this order. You can test out of a stage with a placement check."
                  : data.journey.locked ? "Later stages unlock as you pass earlier ones, and you can test out of a stage." : "You have chosen to take your journey in any order."}
              </p>
              {data.journey.canSwitch && (
                <form action={setJourneyMode} className="mt-2 px-1">
                  <input type="hidden" name="mode" value={data.journey.locked ? "soft" : "inherit"} />
                  <button className="text-[13px] font-semibold text-indigo-300 underline">{data.journey.locked ? "Let me take it in any order" : "Lock my order again"}</button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {raceList.length > 0 && (
        <div className="absolute bottom-[4.4rem] left-3 z-10 sm:bottom-[4.6rem] sm:left-5">
          <button type="button" onClick={() => setRaces((v) => !v)} aria-expanded={races}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[#fff] px-3.5 py-2 text-[14px] font-bold shadow-lg hover:shadow-xl">
            <Trophy size={16} className="text-amber-300" />{raceList.length} race{raceList.length === 1 ? "" : "s"}{role ? ` for ${aiRoleName(role.name, mode)}` : " on your route"}<ChevronDown size={14} className={races ? "rotate-180" : ""} />
          </button>
          {races && (
            <div className="absolute bottom-12 left-0 w-[min(23rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-3 shadow-2xl">
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Races on {role ? `the ${aiRoleName(role.name, mode)} route` : "your route"}</p>
              <ul className="max-h-[22rem] space-y-1.5 overflow-auto">
                {raceList.slice(0, 12).map((r) => {
                  const anchor = M.STATIONS.filter((st) => st.track === r.track && routeIds.has(st.id)).sort((a, b) => a.x - b.x)[0];
                  return (
                    <li key={r.id} className="rounded-xl border border-black/10 bg-[#fbfaf6] p-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-bold">{r.title}</p><p className="truncate text-[12.5px] text-slate-400">{r.trackName} · reach level {r.goal} · {r.humans} racing</p></div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${r.state === "live" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"}`}>{r.state === "live" ? "Live" : "Soon"}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[12.5px] font-semibold text-amber-300">{r.headline}</span>
                        <span className="ml-auto flex gap-1.5">
                          {anchor && <button type="button" onClick={() => { setRaces(false); pick({ kind: "st", id: anchor.id }); }} className="rounded-full border border-black/15 bg-[#fff] px-2.5 py-1 text-[12.5px] font-semibold hover:border-indigo-400">Show on map</button>}
                          <Link href={`/competitions/${r.slug}`} className="rounded-full bg-[#14161f] px-3 py-1 text-[12.5px] font-bold text-[#fff] hover:bg-black">{r.state === "live" ? "Join" : "View"}</Link>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Link href="/campaigns" className="mt-2 inline-flex items-center gap-1 px-1 text-[13px] font-semibold text-indigo-300 hover:underline">All campaigns<ArrowRight size={13} /></Link>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 z-10 sm:bottom-5 sm:left-5">
        <button type="button" onClick={() => setLegend((v) => !v)} aria-expanded={legend} className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff]/95 text-[15px] font-bold shadow-md sm:inline-block sm:h-auto sm:w-auto sm:px-3 sm:py-2 sm:text-[13px] sm:font-semibold"><span className="sm:hidden" aria-hidden>?</span><span className="hidden sm:inline">How to read this</span><span className="sr-only sm:hidden">How to read this</span></button>
        {legend && (
          <div className="absolute bottom-12 left-0 w-72 rounded-2xl border border-black/10 bg-[#fff] p-3.5 text-[13px] shadow-xl">
            <ul className="space-y-2">
              <li className="flex items-center gap-2.5"><svg width="34" height="16"><line x1="0" x2="34" y1="8" y2="8" stroke="#1d5ec2" strokeWidth="6" /></svg><span><b>Line</b>: one discipline, all the way through</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="22"><circle cx="17" cy="11" r="6.5" fill="#fbfaf6" stroke="#1d5ec2" strokeWidth="3" /></svg><span><b>Stop</b>: something to learn. Empty means not started</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><circle cx="17" cy="13" r="11.5" fill="none" stroke="#1d5ec2" strokeWidth="3" strokeDasharray="30 73" transform="rotate(-90 17 13)" /><circle cx="17" cy="13" r="6.5" fill="#fbfaf6" stroke="#1d5ec2" strokeWidth="3" /></svg><span><b>Ring</b>: your level, out of 20</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="22"><circle cx="17" cy="11" r="6.5" fill="#1d5ec2" stroke="#1d5ec2" strokeWidth="3" /></svg><span><b>Solid</b>: passed level 5 or more</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="22"><circle cx="17" cy="11" r="8" fill="#f5b800" stroke="#14161f" strokeWidth="3" /></svg><span><b>Gold</b>: Titan, level 20</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><circle cx="17" cy="13" r="10" fill="#6d28d9" /></svg><span><b>AI</b>: an AI stop added when a role works with AI</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><circle cx="17" cy="13" r="10" fill="none" stroke="#6d28d9" strokeWidth="3" strokeDasharray="5 4" /></svg><span><b>Dashed ring</b>: an AI agent does this stop</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><circle cx="17" cy="13" r="10" fill="#14161f" /><path d="M12.5,13.5 l3,3 l6,-6.5" fill="none" stroke="#fff" strokeWidth="2.2" /></svg><span><b>Tick</b>: where a person checks the agent&apos;s work</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><circle cx="19" cy="13" r="6.5" fill="#fbfaf6" stroke="#1d5ec2" strokeWidth="3" /><rect x="8" y="3" width="8" height="8" transform="rotate(45 12 7)" fill="#fbfaf6" stroke="#1d5ec2" strokeWidth="2.2" /></svg><span><b>Diamond</b>: this level is a starting point (a placement check, your role or a manager), not an exam pass</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><circle cx="17" cy="13" r="11" fill="#f5b800" stroke="#14161f" strokeWidth="2" /></svg><span><b>Gold flag</b>: a live or upcoming race on this track</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><rect x="11" y="1" width="12" height="24" fill="#fbfaf6" stroke="#14161f" strokeWidth="2.5" /><circle cx="17" cy="6" r="6" fill="#fbfaf6" stroke="#14161f" strokeWidth="2.5" /><circle cx="17" cy="20" r="6" fill="#fbfaf6" stroke="#14161f" strokeWidth="2.5" /></svg><span><b>Gate</b>: a handoff where lines meet. Most projects fail here</span></li>
            </ul>
          </div>
        )}
      </div>

      {/* the problem the person described: what it means, one thing to do today, and how they will know it helped */}
      {problem && !sel && (
        <aside aria-live="polite" style={{ "--panel-top": `${Math.max(20, headH - 12)}px` } as React.CSSProperties} className="absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-auto rounded-t-3xl border border-black/10 bg-[#fff] shadow-[0_-18px_44px_-20px_rgba(20,22,31,.5)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-[var(--panel-top)] sm:max-h-none sm:w-[22.5rem] sm:rounded-3xl">
          <button type="button" onClick={() => chooseProblem(null)} aria-label="Close and show the whole map" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/5 hover:bg-black/10"><X size={16} /></button>
          <ProblemPanel p={problem} onStop={(sid) => pick({ kind: "st", id: sid })} />
        </aside>
      )}

      {/* where the company is, and how big it is */}
      {((stage && stageOpen) || (orgSize && sizeOpen) || (sector && sectorOpen)) && !sel && !problem && (
        <aside aria-live="polite" style={{ "--panel-top": `${Math.max(20, headH - 12)}px` } as React.CSSProperties} className="absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-auto rounded-t-3xl border border-black/10 bg-[#fff] shadow-[0_-18px_44px_-20px_rgba(20,22,31,.5)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-[var(--panel-top)] sm:max-h-none sm:w-[22.5rem] sm:rounded-3xl">
          <button type="button" onClick={() => { setStageOpen(false); setSizeOpen(false); setSectorOpen(false); }} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/5 hover:bg-black/10"><X size={16} /></button>
          {stage && stageOpen && <StagePanel id={stage} count={routeIds.size} onStop={(sid) => pick({ kind: "st", id: sid })} onGate={(gid) => pick({ kind: "gt", id: gid })} onStage={chooseStage} />}
          {orgSize && sizeOpen && <SizePanel id={orgSize} later={route.deferred.size} onSize={chooseSize} />}
          {sector && sectorOpen && <SectorPanel id={sector} onStop={(sid) => pick({ kind: "st", id: sid })} onRoute={() => chooseProblem(`sec-${sector}`)} />}
        </aside>
      )}

      {/* what is at this stop */}
      {(selStation || selGate) && (
        <aside aria-live="polite" style={{ "--panel-top": `${Math.max(20, headH - 12)}px` } as React.CSSProperties} className="absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-auto rounded-t-3xl border border-black/10 bg-[#fff] shadow-[0_-18px_44px_-20px_rgba(20,22,31,.5)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-[var(--panel-top)] sm:max-h-none sm:w-[22.5rem] sm:rounded-3xl">
          <button type="button" onClick={() => setSel(null)} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/5 hover:bg-black/10"><X size={16} /></button>
          {selStation && <StationCard st={selStation} lock={data.journey?.locks[selStation.track] ?? null} advice={data.journey?.advice[selStation.track] ?? null} onGate={(id) => pick({ kind: "gt", id })} onGoTrack={(slug) => { const t = M.STATIONS.filter((x) => x.track === slug).sort((a, b) => a.x - b.x)[0]; if (t) pick({ kind: "st", id: t.id }); }} info={data.tracks[selStation.track]} lens={mode === "agent" ? (route.agent.has(selStation.id) ? "agent" : route.review.has(selStation.id) || route.ai.has(selStation.id) ? "review" : null) : mode === "ai" && route.ai.has(selStation.id) ? "ai" : null} roleName={role?.name ?? null} races={racesByTrack.get(selStation.track) ?? []} signedIn={data.signedIn} onSignIn={openSignIn} who={data.viewingAs} canGrant={data.canGrant} size={sizeInfo(selStation.id)} sectorNote={sectorInfo(selStation.id)} coverage={M.coverageFor(selStation.id)} levelLater={levelLater(selStation.id)} onGo={(s) => pick({ kind: "st", id: s.id })} />}
          {selGate && <GateCard g={selGate} tracks={data.tracks} formal={orgSize ? { label: M.SIZE_BY_ID.get(orgSize)?.label ?? "", text: M.SIZE_BY_ID.get(orgSize)?.formal ?? "" } : null} />}
        </aside>
      )}
    </section>
    </ModelCtx.Provider>
  );
}

function StationCard({ st, info, lock, advice, onGoTrack, onGate, races, lens, roleName, signedIn, onSignIn, who, canGrant, size, levelLater, sectorNote, coverage, onGo }: { st: Station; info: TrackInfo | undefined; lock: { stage: number; waitingOn: { slug: string; name: string }[] } | null; advice: { stage: number; waitingOn: { slug: string; name: string }[] } | null; onGoTrack: (slug: string) => void; onGate: (id: string) => void; races: RaceInfo[]; lens: "agent" | "review" | "ai" | null; roleName: string | null; signedIn: boolean; onSignIn?: () => void; who: { id: number; name: string } | null; canGrant: boolean; size: { label: string; text: string; later: string | null } | null; levelLater: string | null; sectorNote: { label: string; text: string } | null; coverage: { level: "thin" | "some" | "good"; hit: number; total: number } | null; onGo: (s: Station) => void }) {
  const M = useModel();
  const line = M.LINE_BY_ID[st.line], c = M.LINE_COLOUR[st.line], z = M.zoneOf(st.x);
  const seq = M.stationsOn(st.line), i = seq.findIndex((s) => s.id === st.id), prev = seq[i - 1], nxt = seq[i + 1];
  const lvl = info?.passed ?? 0;
  const gate = M.nextGateFor(st), own = M.breaksFor(st.id), { needs, neededBy } = M.dependenciesOf(st.id);
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl" style={{ background: c }} />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{line.name} line · {M.ZONES[z].name}</p>
          <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{st.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{M.LINE_BLURB[st.line]} Usually owned by {/^[aeiou]/i.test(st.owner) ? "an" : "a"} {st.owner.toLowerCase()}.{SIZE_LABEL[st.scale] && <> {SIZE_LABEL[st.scale]}.</>}</p>
        </div>

        {lens === "agent" && (
          <div className="rounded-2xl border-l-4 border-violet-500 bg-violet-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-violet-300">An AI agent does this stop</p>
            <p className="mt-0.5">{roleName ? `The AI ${roleName}` : "The agent"} does the work. Before it moves on, check it leaves with:</p>
            <ul className="mt-1 list-disc pl-5">{st.outs.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}
        {lens === "review" && (
          <div className="rounded-2xl border-l-4 border-[#14161f] bg-black/5 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Your checkpoint</p>
            <p className="mt-0.5">This is where a person decides: set the limits, test what the agent produced, approve it or send it back. Nothing the agent does moves on without it.</p>
          </div>
        )}
        {lens === "ai" && (
          <div className="rounded-2xl border-l-4 border-violet-500 bg-violet-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-violet-300">An AI stop</p>
            <p className="mt-0.5">Working with AI adds this stop to the role: it is where AI work is designed, tested and kept in check.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">You bring</h3><ul className="space-y-1">{st.ins.map((t) => <li key={t} className="flex gap-1.5"><span className="text-slate-500">←</span>{t}</li>)}</ul></div>
          <div><h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">You leave with</h3><ul className="space-y-1">{st.outs.map((t) => <li key={t} className="flex gap-1.5"><span className="text-slate-500">→</span>{t}</li>)}</ul></div>
        </div>

        {levelLater && (
          <div className="rounded-2xl bg-indigo-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-indigo-300">Comes later</p>
            <p className="mt-0.5">Not needed at your level yet. Your career ladder asks for this from {levelLater}.</p>
          </div>
        )}
        {sectorNote && (
          <div className="rounded-2xl bg-sky-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-sky-700">In {sectorNote.label}</p>
            <p className="mt-0.5">{sectorNote.text}</p>
          </div>
        )}
        {size && (
          <div className="rounded-2xl bg-indigo-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-indigo-300">At {size.label} size</p>
            <p className="mt-0.5">{size.text}</p>
            {size.later && <p className="mt-1 text-slate-400">This can wait until you are {size.later} size.</p>}
          </div>
        )}

        {(gate || own) && (
          <div className="rounded-2xl border-l-4 border-rose-400 bg-rose-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-rose-300">Where it usually breaks</p>
            <p className="mt-0.5">{own ?? gate!.fail}</p>
            {gate && <button type="button" onClick={() => onGate(gate.id)} className="mt-1.5 text-[13px] font-semibold text-indigo-300 hover:underline">This work is checked at {gate.name} →</button>}
          </div>
        )}

        {M.outcomeFor(st.id) && (
          <div className="rounded-2xl bg-emerald-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-emerald-700">You will know it worked when</p>
            <p className="mt-0.5">{M.outcomeFor(st.id)}</p>
          </div>
        )}
        {M.handoffFor(st.id) && <p className="rounded-2xl border border-black/10 p-3 text-[13px]"><b className="font-semibold">The handover that matters.</b> {M.handoffFor(st.id)}</p>}
        {M.proFor(st.id) && <p className="rounded-2xl border border-black/10 p-3 text-[13px] text-slate-400"><b className="font-semibold text-slate-300">Where learning stops.</b> {M.proFor(st.id)}</p>}
        {M.localFor(st.id) && <p className="text-[12.5px] text-slate-400">{M.localFor(st.id)}</p>}
        {M.draftNote && <p className="text-[12px] italic text-slate-400">{M.draftNote}</p>}

        {M.id === "software" && practicalFor(st.id).length > 0 && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3.5 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-indigo-300">Do it for real</p>
            <p className="mt-0.5">Build a real project and do this stop on it. Your GitHub repository proves it.</p>
            <ul className="mt-1.5 space-y-1">{practicalFor(st.id).map((p) => <li key={p.step}><a href={`/build/step/${p.step}`} className="font-semibold text-indigo-300 underline">{p.label} →</a></li>)}</ul>
          </div>
        )}

        {(needs.length > 0 || neededBy.length > 0) && (
          <div className="space-y-3">
            {needs.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Builds on</h3>
                <div className="flex flex-wrap gap-1.5">{needs.map((n) => <button key={n.id} type="button" onClick={() => onGo(n)} className="rounded-full border border-black/15 bg-[#fff] px-3 py-1 text-[13px] font-semibold hover:border-indigo-400 hover:text-indigo-300">{n.name}</button>)}</div>
              </div>
            )}
            {neededBy.length > 0 && (
              <div>
                <h3 className="mb-0.5 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Why it matters</h3>
                <p className="mb-1.5 text-sm text-slate-400">{neededBy.length === 1 ? "One stop depends on it" : `${neededBy.length} stops depend on it`}, so a weak result here is passed on.</p>
                <div className="flex flex-wrap gap-1.5">{neededBy.map((n) => <button key={n.id} type="button" onClick={() => onGo(n)} className="rounded-full border border-black/15 bg-[#fff] px-3 py-1 text-[13px] font-semibold hover:border-indigo-400 hover:text-indigo-300">{n.name}</button>)}</div>
              </div>
            )}
          </div>
        )}

        {!info && <div className="rounded-2xl border border-black/10 bg-[#fbfaf6] p-3.5 text-sm text-slate-400"><b className="font-semibold text-slate-300">No learning for this stop yet.</b> Its learning track is not set up in this academy, so there is nothing to start here.</div>}
        {info && (
          <div className="rounded-2xl border border-black/10 bg-[#fbfaf6] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Learn it in</p>
            <p className="mt-0.5 text-base font-bold">{info.name}</p>
            <div className="bar mt-2" title={`Level ${lvl} of 20`}><i style={{ width: `${(lvl / 20) * 100}%` }} /></div>
            <p className="mt-1.5 text-sm text-slate-400">{lvl > 0 ? `You are on level ${lvl} of 20.` : "20 levels, from Novice to Titan."} {lvl < 5 ? `Level 5 earns the Foundation certificate: about ${5 - lvl} quiz${5 - lvl === 1 ? "" : "zes"} of ${QUESTIONS_PER_RUN} questions, ${Math.round(PASS_MARK * 100)}% to pass.` : null}{info.required && <> <b className={info.overdue ? "text-rose-300" : "text-amber-300"}>{lvl >= info.requiredLevel ? "Required: done." : info.overdue ? "Required: overdue." : `Required${info.dueAt ? `, due ${fmtDate(info.dueAt)}` : ""}.`}</b></>}</p>
            {coverage && (
              <p className={`mt-2 rounded-xl p-2.5 text-[13px] ${coverage.level === "thin" ? "bg-amber-50" : "bg-black/5"}`}>
                <b className="font-semibold">{coverage.level === "thin" ? "Thin match." : coverage.level === "some" ? "Partly covered." : "Well covered."}</b> {coverage.hit.toLocaleString("en-GB")} of this track&apos;s {coverage.total.toLocaleString("en-GB")} questions mention this subject.{coverage.level === "thin" ? " The track teaches the wider topic, so practise the subject itself with the first step on this card." : ""}
              </p>
            )}
            {lvl > 0 && (info.credit || info.placed > 0) && (
              <div className="mt-2 rounded-xl bg-black/5 p-2.5 text-[13px]">
                <p className="font-semibold">Where {who ? "their" : "your"} level comes from</p>
                <ul className="mt-1 space-y-0.5 text-slate-400">
                  <li>Exams passed: {info.earned > 0 ? `level ${info.earned}` : "none yet"}</li>
                  {info.placed > 0 && <li>Placement check: level {info.placed}</li>}
                  {info.credit && (
                    <li>
                      Starting level {info.credit.level}: {info.credit.source === "role" ? `from ${who ? "their" : "your"} job role, where a typical holder of it is` : `given by ${info.credit.by} on ${fmtDate(info.credit.at)}: “${info.credit.reason}”`}.
                      {info.credit.expiresAt ? ` It ends on ${fmtDate(info.credit.expiresAt)}.` : ""}
                    </li>
                  )}
                </ul>
                <p className="mt-1 text-slate-400">Level {lvl} is the highest of these. A starting level lifts where {who ? "they" : "you"} start and unlocks what comes next; {info.credit?.countsAsComplete ? "an admin marked it as complete for required training." : "the certificate still needs the exam."}</p>
              </div>
            )}
            {info.suggest > 0 && (
              who ? (
                <p className="mt-2 text-sm text-slate-400">{who.name.split(" ")[0]}&apos;s job role usually starts at level {info.suggest} here.</p>
              ) : signedIn ? (
                <form action={acceptRoleStartAction.bind(null, info.slug)} className="mt-3 rounded-xl border-l-4 border-indigo-400 bg-indigo-50 p-3 text-sm">
                  <p className="font-bold">Your job role usually starts at level {info.suggest} here.</p>
                  <p className="mt-0.5 text-slate-400">Already there? Start from it. You still sit the exams for the certificate.</p>
                  <button type="submit" className="mt-2 rounded-full bg-[#14161f] px-3 py-1 text-[13px] font-bold text-[#fff] hover:bg-black">Use level {info.suggest} as my starting point</button>
                </form>
              ) : null
            )}
            {who && canGrant && <Link href={`/admin/starting-points?user=${who.id}&track=${info.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-300 hover:underline">Give {who.name.split(" ")[0]} a starting level<ArrowRight size={14} /></Link>}
            {info.rival && <p className="mt-1 text-sm text-slate-400">{info.rival.name} is on level {info.rival.level}{info.rival.level > lvl ? ". Catch up." : lvl > info.rival.level ? ". You are ahead." : ". Dead level."}</p>}
            {lock && (
              <div className="mt-3 rounded-xl border-l-4 border-slate-400 bg-black/5 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-bold"><Lock size={14} />Locked until you pass {lock.waitingOn.map((w) => w.name).join(", ") || "the stage before"}</p>
                <p className="mt-0.5 text-slate-400">This is stage {lock.stage} of your journey. The stages before it come first, so what you learn builds up in order.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lock.waitingOn[0] && <button type="button" onClick={() => onGoTrack(lock.waitingOn[0].slug)} className="rounded-full bg-[#14161f] px-3 py-1 text-[13px] font-bold text-[#fff] hover:bg-black">Take me to {lock.waitingOn[0].name}</button>}
                  {info.open && <Link href={`/start/${info.slug}`} className="rounded-full border border-black/15 bg-[#fff] px-3 py-1 text-[13px] font-semibold hover:border-indigo-400">I already know this: test out</Link>}
                </div>
              </div>
            )}
            {!lock && advice && <p className="mt-3 rounded-xl bg-amber-500/10 p-2.5 text-[13px] text-amber-300">Recommended order: pass {advice.waitingOn.map((w) => w.name).join(", ") || "the stage before"} first. Nothing is blocked for you.</p>}
            {info.open
              ? lock
                ? <span className="btn mt-3 w-full cursor-not-allowed justify-center !bg-slate-400 opacity-70" aria-disabled><Lock size={15} />Locked</span>
                : <Link href={`/tracks/${info.slug}`} className="btn mt-3 w-full justify-center">{lvl > 0 ? "Continue" : "Start learning"}<ArrowRight size={16} /></Link>
              : <p className="mt-3 text-sm text-slate-400">This track is not part of your plan.</p>}
            {!signedIn && <p className="mt-2 text-center text-xs text-slate-400">{onSignIn ? <button type="button" onClick={onSignIn} className="font-semibold text-indigo-300 hover:underline">Sign in</button> : <Link href="/login" className="font-semibold text-indigo-300 hover:underline">Sign in</Link>} to see your own progress here.</p>}
          </div>
        )}

        {races.length > 0 && (
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400"><Trophy size={13} className="text-amber-300" />Races on this track</h3>
            <ul className="space-y-1.5">
              {races.slice(0, 3).map((r) => (
                <li key={r.id}><Link href={`/competitions/${r.slug}`} className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#fbfaf6] px-3 py-2 hover:border-indigo-400">
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold">{r.title}</span><span className="block text-[12px] text-slate-400">{r.state === "live" ? "Live now" : "Starts soon"} · {r.humans} racing · {r.headline}</span></span>
                  <ArrowRight size={15} className="shrink-0 text-slate-400" /></Link></li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          {prev ? <button type="button" onClick={() => onGo(prev)} className="btn btn-ghost min-w-0 flex-1 !justify-start !px-3 text-left text-[13px]"><span className="truncate">← {prev.name}</span></button> : <span className="flex-1" />}
          {nxt ? <button type="button" onClick={() => onGo(nxt)} className="btn btn-ghost min-w-0 flex-1 !justify-end !px-3 text-right text-[13px]"><span className="truncate">{nxt.name} →</span></button> : <span className="flex-1" />}
        </div>
      </div>
    </div>
  );
}

/** What a company at this stage is doing, where to start, where it usually goes wrong, and what comes next. */
function ProblemPanel({ p, onStop }: { p: import("@/lib/lifecycle/problems").ProblemDef; onStop: (id: string) => void }) {
  const M = useModel();
  const stops = p.stops.map((id) => M.STATION_BY_ID.get(id)).filter((s): s is Station => !!s);
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl bg-amber-400" />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">You said</p>
          <h2 className="mt-1 text-[1.3rem] font-bold leading-tight">{p.say}</h2>
        </div>
        <div className="rounded-2xl bg-amber-50 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-amber-700">One thing to do today</p>
          <p className="mt-1 text-[14px]">{p.first}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Learn these, in this order</p>
          <ol className="mt-1.5 space-y-1">
            {stops.map((s, i) => (
              <li key={s.id}><button type="button" onClick={() => onStop(s.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-black/5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-[#fff]" style={{ background: M.LINE_COLOUR[s.line] }}>{i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{s.name}</span><span className="block text-[12px] text-slate-400">{M.LINE_BY_ID[s.line].name}</span></span><ArrowRight size={14} className="shrink-0 text-slate-400" /></button></li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">You will know it helped when</p>
          <p className="mt-1 text-[14px]">{p.done}</p>
        </div>
        {p.pro && <p className="rounded-2xl border border-black/10 p-3 text-[13px] text-slate-400"><b className="font-semibold text-slate-300">Where learning stops.</b> {p.pro}</p>}
      </div>
    </div>
  );
}

function StagePanel({ id, count, onStop, onGate, onStage }: { id: StageId; count: number; onStop: (id: string) => void; onGate: (id: string) => void; onStage: (id: StageId) => void }) {
  const M = useModel();
  const i = M.STAGES.findIndex((g) => g.id === id), g = M.STAGES[i], nxt = M.STAGES[i + 1] ?? null, first = M.STATION_BY_ID.get(g.start)!;
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl bg-[#14161f]" />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">{M.words.stageWord ?? "Company stage"} {i + 1} of {M.STAGES.length}</p>
          <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{g.label}</h2>
          <p className="mt-1 text-sm text-slate-400">{g.blurb}</p>
        </div>
        <div className="flex items-center gap-1" aria-hidden>{M.STAGES.map((x, n) => <span key={x.id} className={`h-1.5 flex-1 rounded-full ${n < i ? "bg-indigo-300" : n === i ? "bg-indigo-500" : "bg-black/10"}`} />)}</div>
        <p className="text-sm"><b>{count} stops</b> on the map matter at this stage. They are lit; the rest can wait.</p>
        <button type="button" onClick={() => onStop(first.id)} className="btn w-full justify-center">Start with {first.name}<ArrowRight size={16} /></button>
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-rose-300">Where it usually goes wrong</h3>
          <ul className="space-y-2">
            {g.watch.map((gid) => { const gate = M.GATE_BY_ID.get(gid)!; return (
              <li key={gid} className="rounded-2xl border-l-4 border-rose-400 bg-rose-50 p-3 text-sm">
                <p>{gate.fail}</p>
                <button type="button" onClick={() => onGate(gid)} className="mt-1 text-[13px] font-semibold text-indigo-300 hover:underline">{gate.name} →</button>
              </li>
            ); })}
          </ul>
        </div>
        {nxt && (
          <div className="rounded-2xl border border-black/10 bg-[#fbfaf6] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">What comes next</p>
            <p className="mt-0.5 text-base font-bold">{nxt.label}</p>
            <p className="mt-0.5 text-sm text-slate-400">{nxt.ask}.</p>
            <button type="button" onClick={() => onStage(nxt.id)} className="btn btn-ghost mt-2 !px-3 text-[13px]">Show that stage<ArrowRight size={14} /></button>
          </div>
        )}
        <p className="text-xs text-slate-400">Click any lit stop on the map to see what it asks for and how to learn it.</p>
      </div>
    </div>
  );
}

/** What an organisation of this size looks like, what changes on the map, what usually goes wrong, and what can wait until it is bigger. */
function SectorPanel({ id, onStop, onRoute }: { id: string; onStop: (id: string) => void; onRoute: () => void }) {
  const M = useModel();
  const z = M.SECTOR_BY_ID.get(id);
  if (!z) return null;
  const stops = z.key.map((sid) => M.STATION_BY_ID.get(sid)).filter((s): s is Station => !!s);
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl bg-sky-500" />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Kind of business</p>
          <h2 className="mt-1 text-[1.6rem] font-bold leading-tight">{z.label}</h2>
          <p className="mt-1 text-sm text-slate-400">{z.blurb}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Who sets the rules</p>
          <p className="mt-1 text-[14px]">{z.watch}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Rules you will meet</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px]">{z.rules.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Stops that matter most here</p>
          <ol className="mt-1.5 space-y-1">
            {stops.map((s, i) => (
              <li key={s.id}><button type="button" onClick={() => onStop(s.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-black/5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-[#fff]" style={{ background: M.LINE_COLOUR[s.line] }}>{i + 1}</span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold">{s.name}</span><ArrowRight size={14} className="shrink-0 text-slate-400" /></button></li>
            ))}
          </ol>
          <button type="button" onClick={onRoute} className="btn mt-3 w-full !py-1.5 text-[13px]">Light up just these stops</button>
        </div>
        {z.pro && <p className="rounded-2xl border border-black/10 p-3 text-[13px] text-slate-400"><b className="font-semibold text-slate-300">Where learning stops.</b> {z.pro}</p>}
        {M.draftNote && <p className="text-[12px] italic text-slate-400">{M.draftNote}</p>}
      </div>
    </div>
  );
}

function SizePanel({ id, later, onSize }: { id: string; later: number; onSize: (id: string) => void }) {
  const M = useModel();
  const i = M.SIZES.findIndex((z) => z.id === id), z = M.SIZES[i], bigger = M.SIZES[i + 1] ?? null;
  if (!z) return null;
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl bg-indigo-500" />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Organisation size {i + 1} of {M.SIZES.length}</p>
          <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{z.label}</h2>
          <p className="mt-0.5 text-sm font-semibold text-slate-300">{z.people}</p>
          <p className="mt-1 text-sm text-slate-400">{z.blurb}</p>
        </div>
        <div className="flex items-center gap-1" aria-hidden>{M.SIZES.map((x, n) => <span key={x.id} className={`h-1.5 flex-1 rounded-full ${n < i ? "bg-indigo-300" : n === i ? "bg-indigo-500" : "bg-black/10"}`} />)}</div>
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">What changes at this size</h3>
          <ul className="space-y-1.5 text-sm">{z.changes.map((t) => <li key={t} className="flex gap-1.5"><span className="text-slate-500">→</span>{t}</li>)}</ul>
        </div>
        {later > 0 && <p className="text-sm"><b>{later} stop{later === 1 ? "" : "s"}</b> on this route can wait until you are bigger. They are dimmed, not removed.</p>}
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-rose-300">Where it usually goes wrong</h3>
          <ul className="space-y-1.5">{z.challenges.map((t) => <li key={t} className="rounded-2xl border-l-4 border-rose-400 bg-rose-50 p-3 text-sm">{t}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-black/10 bg-[#fbfaf6] p-3.5 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Who usually owns a stop</p>
          <p className="mt-0.5">{z.owner}</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">How formal a handoff is</p>
          <p className="mt-0.5">{z.formal}</p>
        </div>
        {bigger && <button type="button" onClick={() => onSize(bigger.id)} className="btn btn-ghost !px-3 text-[13px]">See {bigger.label}<ArrowRight size={14} /></button>}
      </div>
    </div>
  );
}

function GateCard({ g, tracks, formal }: { g: Gate; tracks: Record<string, TrackInfo>; formal: { label: string; text: string } | null }) {
  const M = useModel();
  const z = M.zoneOf(g.x);
  const near = [...new Set(M.STATIONS.filter((s) => g.lines.includes(s.line) && Math.abs(s.x - g.x) <= 3).map((s) => s.track))].map((slug) => tracks[slug]).filter(Boolean).slice(0, 5);
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl bg-[#14161f]" />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Handoff gate · {M.ZONES[z].name}</p>
          <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{g.name}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">{g.lines.map((id: LineId) => <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#fbfaf6] px-2.5 py-0.5 text-xs font-semibold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: M.LINE_COLOUR[id] }} />{M.LINE_BY_ID[id].name}</span>)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Must arrive</h3><ul className="space-y-1">{g.ins.map((t) => <li key={t} className="flex gap-1.5"><span className="text-slate-500">←</span>{t}</li>)}</ul></div>
          <div><h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Leaves the gate</h3><ul className="space-y-1">{g.outs.map((t) => <li key={t} className="flex gap-1.5"><span className="text-slate-500">→</span>{t}</li>)}</ul></div>
        </div>
        <div className="rounded-2xl border-l-4 border-rose-400 bg-rose-50 p-3 text-sm"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-rose-300">Where it usually breaks</p><p className="mt-0.5">{g.fail}</p></div>
        {formal && <div className="rounded-2xl bg-indigo-50 p-3 text-sm"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-indigo-300">At {formal.label} size</p><p className="mt-0.5">{formal.text}</p></div>}
        {near.length > 0 && <div><h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Get this right: learn</h3><div className="flex flex-wrap gap-1.5">{near.map((t) => t.open ? <Link key={t.slug} href={`/tracks/${t.slug}`} className="rounded-full border border-black/15 bg-[#fff] px-3 py-1 text-[13px] font-semibold hover:border-indigo-400 hover:text-indigo-300">{t.name}</Link> : <span key={t.slug} className="rounded-full border border-black/10 px-3 py-1 text-[13px] text-slate-400">{t.name}</span>)}</div></div>}
      </div>
    </div>
  );
}
