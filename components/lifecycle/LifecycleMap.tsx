"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Crosshair, Minus, Plus, Search, Trophy, X } from "lucide-react";
import {
  AI_MODES, FOCUS, FOCUS_START, GATES, GATE_BY_ID, H, LINES, LINE_BLURB, LINE_BY_ID, LINE_COLOUR, SEQ, STATIONS, STATION_BY_ID, W, ZONES, gateBottom, gateRow, px, py, stationsOn, zoneOf,
  aiRoleName, buildRoute, type AiMode, type FocusId, type Gate, type LineId, type MapData, type RaceInfo, type RoleInfo, type Station, type TrackInfo,
} from "@/lib/lifecycle/model";

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

/** `standalone` makes the map a page of its own: full height, with its own slim top bar (brand and a way back) instead of the site header. */
export function LifecycleMap({ data, signage, standalone }: { data: MapData; signage: string; standalone?: { brand: string } }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ k: 0.5, x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const [focus, setFocus] = useState<FocusId>(data.defaultRole ? "all" : data.defaultFocus);
  const [roleKey, setRoleKey] = useState<string | null>(data.defaultRole);
  const [picker, setPicker] = useState(false);
  const [pq, setPq] = useState("");
  const [races, setRaces] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [hint, setHint] = useState(true);
  const [legend, setLegend] = useState(false);
  const [mode, setMode] = useState<AiMode>("human");
  const narrow = size.w > 0 && size.w < 900;
  const chrome = standalone ? 40 : 0; // room taken by the standalone top bar

  const role = useMemo<RoleInfo | null>(() => data.roles.find((r) => r.key === roleKey) ?? null, [roleKey, data.roles]);
  /* The route: the stops a role's career ladder asks for (or an area's hand-picked stops), seen through the chosen AI lens. */
  const route = useMemo(() => buildRoute(role, focus, mode), [role, focus, mode]);
  const routeIds = route.ids;
  const litLines = useMemo(() => new Set<LineId>(STATIONS.filter((s) => routeIds.has(s.id)).map((s) => s.line)), [routeIds]);
  const dimming = routeIds.size < STATIONS.length;

  /* The next stop: the first required, unfinished stop in your lines; else the first one you have not yet passed at level 5. */
  const next = useMemo<Station | null>(() => {
    const mine = STATIONS.filter((s) => routeIds.has(s.id)).sort((a, b) => a.x - b.x || a.row - b.row);
    const t = (s: Station) => data.tracks[s.track];
    const start = mode !== "human" ? STATION_BY_ID.get("aiuse") : !role ? STATION_BY_ID.get(FOCUS_START[focus] ?? "") : undefined;
    return mine.find((s) => t(s)?.open && t(s)?.required && t(s)!.passed < t(s)!.requiredLevel)
      ?? (start && routeIds.has(start.id) && (t(start)?.passed ?? 0) < 5 ? start : undefined)
      ?? mine.find((s) => t(s)?.open && (t(s)?.passed ?? 0) < 5) ?? mine[0] ?? null;
  }, [routeIds, role, focus, mode, data.tracks]);

  /* Races: live or upcoming campaigns on the tracks of this route. One flag per track, on the first stop of that track on the route. */
  const routeTracks = useMemo(() => role ? new Set([...role.tracks, ...(mode !== "human" ? ["ai-llm-practice"] : [])]) : new Set(STATIONS.filter((s) => routeIds.has(s.id)).map((s) => s.track)), [role, mode, routeIds]);
  const raceList = useMemo(() => data.races.filter((r) => routeTracks.has(r.track)).sort((a, b) => Number(b.state === "live") - Number(a.state === "live") || b.humans - a.humans), [data.races, routeTracks]);
  const racesByTrack = useMemo(() => { const m = new Map<string, RaceInfo[]>(); for (const r of data.races) m.set(r.track, [...(m.get(r.track) ?? []), r]); return m; }, [data.races]);
  const raceAnchor = useMemo(() => {
    const m = new Map<string, number>(), seen = new Set<string>();
    for (const st of STATIONS.filter((x) => routeIds.has(x.id)).sort((a, b) => a.x - b.x || a.row - b.row)) {
      if (seen.has(st.track) || !racesByTrack.has(st.track)) continue;
      seen.add(st.track); m.set(st.id, racesByTrack.get(st.track)!.length);
    }
    return m;
  }, [routeIds, racesByTrack]);

  /* ---------- camera ---------- */
  const fitK = size.w && size.h ? Math.min(size.w / W, size.h / H) : 0.5;
  const move = useCallback((v: View, smooth: boolean) => { setAnimate(smooth); setView(v); }, []);
  const centreOn = useCallback((cx: number, cy: number, k: number, smooth = true, rightInset = 0, sheet = false) => {
    const kk = Math.min(MAX_K, Math.max(fitK * 0.5, k));
    const top = (narrow ? (size.w < 640 ? 130 : 215) : 0) + chrome, bottom = sheet ? size.h * 0.4 : size.h;
    move({ k: kk, x: (size.w - rightInset) / 2 - cx * kk, y: (top + bottom) / 2 - cy * kk }, smooth);
  }, [fitK, size, narrow, chrome, move]);
  const frameLines = useCallback((lines: Set<LineId>, smooth = true, ids?: ReadonlySet<string>) => {
    const on = (st: Station) => (ids ? ids.has(st.id) : lines.has(st.line));
    if (narrow) { const s = STATIONS.filter(on).sort((a, b) => a.x - b.x)[0], rs = LINES.filter((l) => lines.has(l.id)).map((l) => l.row); if (s) centreOn(px(s.x) + 120, py((Math.min(...rs) + Math.max(...rs)) / 2), 0.75, smooth); return; }
    const rows = LINES.filter((l) => lines.has(l.id)).map((l) => l.row);
    const y0 = py(Math.min(...rows)) - 120, y1 = py(Math.max(...rows)) + 80, top = (narrow ? 100 : 136) + chrome, bottom = narrow ? 96 : 64;
    // readable first: about 0.9 unless the lit lines would not fit up and down; the fit button shows the whole map
    const kk = Math.min(1.1, Math.max(0.6, Math.min(0.95, (size.h - top - bottom) / (y1 - y0))));
    const first = STATIONS.filter(on).sort((p, q) => p.x - q.x)[0], x0 = first ? px(first.x) - 300 : 0;
    move({ k: kk, x: 16 - Math.max(0, x0) * kk, y: top + Math.max(0, size.h - top - bottom - (y1 - y0) * kk) / 2 - y0 * kk }, smooth);
  }, [narrow, size, chrome, centreOn, move]);

  const fitAll = () => { const k = Math.min((size.w - 32) / W, (size.h - 200 - chrome) / H); move({ k, x: (size.w - W * k) / 2, y: 136 + chrome + (size.h - 200 - chrome - H * k) / 2 }, true); };
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const first = useRef(true);
  useLayoutEffect(() => { if (size.w && first.current) { first.current = false; frameLines(litLines, false, routeIds); } }, [size.w, litLines, routeIds, frameLines]);

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
    const n = s.kind === "st" ? STATION_BY_ID.get(s.id)! : null, g = s.kind === "gt" ? GATE_BY_ID.get(s.id)! : null;
    const cx = n ? px(n.x) : px(g!.x), cy = n ? py(n.row) : (py(gateRow(g!)) + py(gateBottom(g!))) / 2;
    centreOn(cx, cy, Math.max(viewRef.current.k, narrow ? 0.8 : 1.05), true, narrow ? 0 : 380, narrow);
  };
  const choose = (id: FocusId) => { setFocus(id); setRoleKey(null); setSel(null); setHint(false); setPicker(false); const r = buildRoute(null, id, mode); frameLines(new Set<LineId>(STATIONS.filter((st) => r.ids.has(st.id)).map((st) => st.line)), true, r.ids); };
  const chooseRole = (key: string | null) => {
    setRoleKey(key); setPicker(false); setPq(""); setSel(null); setHint(false);
    const r = data.roles.find((x) => x.key === key);
    if (!r) { setFocus("all"); frameLines(new Set<LineId>(LINES.map((l) => l.id))); return; }
    const rt = buildRoute(r, "all", mode);
    frameLines(new Set<LineId>(STATIONS.filter((st) => rt.ids.has(st.id)).map((st) => st.line)), true, rt.ids);
  };
  const chooseMode = (m: AiMode) => {
    setMode(m); setSel(null); setHint(false);
    const rt = buildRoute(role, focus, m);
    frameLines(new Set<LineId>(STATIONS.filter((st) => rt.ids.has(st.id)).map((st) => st.line)), true, rt.ids);
  };
  const goNext = () => { if (next) pick({ kind: "st", id: next.id }); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const showLabels = view.k >= 0.55;
  const selStation = sel?.kind === "st" ? STATION_BY_ID.get(sel.id) ?? null : null;
  const selGate = sel?.kind === "gt" ? GATE_BY_ID.get(sel.id) ?? null : null;

  return (
    <section aria-label="Software lifecycle map" className={`lm relative isolate overflow-hidden bg-[#fbfaf6] ${signage}`} style={{ height: standalone ? "100svh" : "calc(100svh - 3.4rem)", minHeight: 520 }}>
      <style>{`
        .lm .ln{animation:draw 1.6s cubic-bezier(.4,0,.2,1) both}
        .lm .pulse{animation:lmpulse 2s ease-out infinite;transform-box:fill-box;transform-origin:center}
        @keyframes lmpulse{0%{transform:scale(.7);opacity:.9}100%{transform:scale(2.1);opacity:0}}
        .lm .st:hover .nm,.lm .st:focus-visible .nm{text-decoration:underline}
        @media (prefers-reduced-motion:reduce){.lm .ln,.lm .pulse{animation:none}.lm .train{display:none}}
      `}</style>

      {/* the map */}
      <div ref={boxRef} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing" onPointerDown={onPointerDown}>
        <svg width={size.w} height={size.h} role="group" aria-label="Map of the software lifecycle: ten lines, seven phases, nine handoff gates">
          <g style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transition: animate ? "transform .75s cubic-bezier(.2,.8,.2,1)" : "none" }}>
            {/* phases */}
            {ZONES.map((z, i) => {
              const x0 = i === 0 ? 0 : px(z.from), x1 = i === ZONES.length - 1 ? W : px(z.to);
              return (
                <g key={z.name}>
                  <rect x={x0} y={0} width={x1 - x0} height={H} fill={i % 2 ? "#f4f2ea" : "#fbfaf6"} />
                  {i > 0 && <line x1={x0} x2={x0} y1={0} y2={H} stroke="#14161f" strokeOpacity={0.12} strokeDasharray="3 5" />}
                  <text x={x0 + 14} y={36} fontSize={21} fontWeight={700} letterSpacing=".14em" fill="#14161f" fillOpacity={0.78}>{i + 1}  {z.name.toUpperCase()}</text>
                  <text x={x0 + 14} y={60} fontSize={16} fontWeight={500} fill="#5b6375">{z.sub}</text>
                </g>
              );
            })}

            {/* lines */}
            {LINES.map((l) => {
              const xs = SEQ[l.id].map((n) => (n.kind === "st" ? n.st.x : n.gate.x)), a = px(Math.min(...xs)), b = px(Math.max(...xs)), y = py(l.row), c = LINE_COLOUR[l.id];
              const on = !dimming || litLines.has(l.id), pw = l.name.length * 9.4 + 34;
              return (
                <g key={l.id} style={{ opacity: on ? 1 : 0.16, transition: "opacity .4s" }}>
                  <line className="ln" pathLength={1} strokeDasharray={1} x1={a} x2={b} y1={y} y2={y} stroke={c} strokeWidth={l.hollow ? 13 : 10} strokeLinecap="butt" />
                  {l.hollow && <line x1={a} x2={b} y1={y} y2={y} stroke="#fbfaf6" strokeWidth={4} />}
                  <rect x={a - 18 - pw} y={y - 17} width={pw} height={34} rx={17} fill={c} />
                  <text x={a - 18 - pw / 2} y={y + 6.5} textAnchor="middle" fontSize={18} fontWeight={600} fill={l.id === "doc" ? "#14161f" : "#fff"}>{l.name}</text>
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
            {GATES.map((g) => {
              const X = px(g.x), r0 = gateRow(g), r1 = gateBottom(g), wl = wrapWords(g.name, 12), top0 = 92;
              const on = !dimming || g.lines.some((id) => litLines.has(id)), isSel = sel?.kind === "gt" && sel.id === g.id;
              return (
                <g key={g.id} role="button" tabIndex={0} aria-label={`Handoff gate: ${g.name}`} className="cursor-pointer outline-none" style={{ opacity: on ? 1 : 0.2, transition: "opacity .4s" }}
                  onClick={() => { if (!moved.current) pick({ kind: "gt", id: g.id }); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick({ kind: "gt", id: g.id }); } }}>
                  <line x1={X} x2={X} y1={top0 + wl.length * 23 - 8} y2={py(r0) - 12} stroke="#5b6375" strokeWidth={1.2} strokeDasharray="2 3" />
                  {r1 > r0 && <rect x={X - 8} y={py(r0)} width={16} height={py(r1) - py(r0)} fill="#fbfaf6" stroke="#14161f" strokeWidth={3} />}
                  {g.lines.map((id) => <circle key={id} cx={X} cy={py(LINE_BY_ID[id].row)} r={11} fill="#fbfaf6" stroke={isSel ? "#4f46e5" : "#14161f"} strokeWidth={isSel ? 4 : 3} />)}
                  {wl.map((t, i) => <text key={i} x={X} y={top0 + i * 23} textAnchor="middle" fontSize={20} fontWeight={700} fill={isSel ? "#4f46e5" : "#14161f"}>{t}</text>)}
                  <rect x={X - 72} y={top0 - 20} width={144} height={wl.length * 23 + 10} fill="transparent" />
                  <rect x={X - 15} y={py(r0) - 15} width={30} height={py(r1) - py(r0) + 30} fill="transparent" />
                </g>
              );
            })}

            {/* stations */}
            {STATIONS.map((st) => {
              const X = px(st.x), Y = py(st.row), c = LINE_COLOUR[st.line], t = data.tracks[st.track], mk = markOf(t);
              const on = !dimming || routeIds.has(st.id), isNext = next?.id === st.id, isSel = sel?.kind === "st" && sel.id === st.id, lift = st.tier * 26;
              const tx = st.anchor === "start" ? st.L : st.anchor === "end" ? st.R : X, frac = Math.min(1, (t?.passed ?? 0) / 20), C = 2 * Math.PI * 16;
              const label = showLabels && (on || isSel) || isNext || isSel;
              return (
                <g key={st.id} role="button" tabIndex={0} aria-label={`${st.name}${t ? `, ${t.passed > 0 ? `level ${t.passed} of 20` : "not started"}` : ""}`} className="st cursor-pointer outline-none"
                  style={{ opacity: on ? 1 : 0.14, transition: "opacity .4s" }}
                  onClick={() => { if (!moved.current) pick({ kind: "st", id: st.id }); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick({ kind: "st", id: st.id }); } }}>
                  {isNext && !isSel && <circle className="pulse" cx={X} cy={Y} r={16} fill="none" stroke={c} strokeWidth={4} />}
                  {(isSel || mk === "learning" || mk === "solid") && <circle cx={X} cy={Y} r={16} fill="none" stroke={isSel ? "#4f46e5" : c} strokeOpacity={isSel ? 1 : 0.9} strokeWidth={isSel ? 4.5 : 4} strokeDasharray={isSel ? undefined : `${C * frac} ${C}`} transform={`rotate(-90 ${X} ${Y})`} />}
                  <circle cx={X} cy={Y} r={mk === "titan" ? 11 : 9} fill={mk === "titan" ? "#f5b800" : mk === "solid" ? c : "#fbfaf6"} stroke={mk === "titan" ? "#14161f" : c} strokeWidth={4} />
                  {t?.required && t.overdue && <circle cx={X + 11} cy={Y - 11} r={5.5} fill="#e11d48" stroke="#fbfaf6" strokeWidth={1.5} />}
                  {route.agent.has(st.id) && <circle cx={X} cy={Y} r={17} fill="none" stroke="#6d28d9" strokeWidth={3} strokeDasharray="5 4" />}
                  {mode === "ai" && route.ai.has(st.id) && (
                    <g transform={`translate(${X - 19},${Y + 19})`}><circle r={10} fill="#6d28d9" stroke="#fbfaf6" strokeWidth={2} /><text y={3.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#fff">AI</text></g>
                  )}
                  {mode === "agent" && (route.review.has(st.id) || route.ai.has(st.id)) && (
                    <g transform={`translate(${X - 19},${Y + 19})`}><circle r={10} fill="#14161f" stroke="#fbfaf6" strokeWidth={2} /><path d="M-4.5,0.5 l3,3 l6,-6.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></g>
                  )}
                  {raceAnchor.has(st.id) && (
                    <g transform={`translate(${X + 19},${Y + 19})`}>
                      <circle r={11} fill="#f5b800" stroke="#14161f" strokeWidth={2} />
                      <path d="M-4.5,-4 h9 v2.5 a4.5,4.5 0 0 1 -9,0 z M-1,3 h2 v2.5 h-2 z M-3.5,5.5 h7" fill="none" stroke="#14161f" strokeWidth={1.6} strokeLinejoin="round" />
                    </g>
                  )}
                  {label && (
                    <text className="nm" x={tx} y={Y - 24 - lift} textAnchor={st.anchor} fontSize={20} fontWeight={isNext || isSel ? 700 : 500} fill={isSel ? "#4f46e5" : "#14161f"} stroke="#fbfaf6" strokeWidth={4.5} paintOrder="stroke" strokeLinejoin="round">{st.name}</text>
                  )}
                  {isNext && !isSel && (
                    <g transform={`translate(${X},${Y - 66 - lift})`}>
                      <rect x={-48} y={-14} width={96} height={27} rx={13} fill="#14161f" />
                      <text y={5} textAnchor="middle" fontSize={15} fontWeight={700} letterSpacing=".06em" fill="#fff">{data.signedIn ? "NEXT STOP" : "START HERE"}</text>
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-[#fbfaf6] via-[#fbfaf6]/92 to-transparent px-3 pb-6 pt-3 sm:px-5 sm:pt-4">
        {standalone && (
          <div className="pointer-events-auto mb-2 flex items-center gap-3 text-sm">
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#fff] px-3 py-1 font-semibold shadow-sm hover:shadow-md"><ArrowLeft size={14} />{standalone.brand}</Link>
            <span className="ml-auto flex items-center gap-2">
              {data.signedIn ? <Link href="/dashboard" className="font-semibold text-indigo-300 hover:underline">My quest</Link> : <Link href="/login" className="btn !px-3.5 !py-1 text-[13px]">Sign in</Link>}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2" style={{ paddingRight: !narrow && sel ? "23.5rem" : undefined }}>
          <div className="pointer-events-auto">
            <p className="hidden text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400 sm:block">The software lifecycle, as a map</p>
            <h1 className="mt-0.5 text-[1.2rem] font-bold leading-[1.05] sm:text-[1.6rem]">
              {data.signedIn ? <>Welcome back, {data.firstName}. <span className="text-indigo-300">Here is your route.</span></> : <>Idea to shutdown. <span className="text-indigo-300">Learn every stop.</span></>}
            </h1>
          </div>
          <div className="pointer-events-auto min-w-0 flex-1 basis-[22rem]">
            <div className="relative mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-300">
              <span>I am a</span>
              <button type="button" onClick={() => setPicker((v) => !v)} aria-expanded={picker} aria-haspopup="listbox"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[14px] font-bold shadow-sm transition ${role ? "border-indigo-400 bg-indigo-50 text-indigo-300" : "border-black/20 bg-[#fff] hover:border-indigo-400"}`}>
                {role ? aiRoleName(role.name, mode) : "Choose your role"}<ChevronDown size={15} />
              </button>
              <span className="inline-flex overflow-hidden rounded-full border border-black/15 bg-[#fff] text-[13px] font-semibold shadow-sm" role="group" aria-label="Role as a person or with AI">
                {AI_MODES.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id} title={m.hint} onClick={() => chooseMode(m.id)}
                  className={`px-3 py-1 transition ${mode === m.id ? (m.id === "human" ? "bg-[#14161f] text-[#fff]" : "bg-violet-600 text-[#fff]") : "hover:bg-black/5"}`}>{m.label}</button>)}
              </span>
              <span className="hidden lg:inline">or pick an area. We will light up your route.</span>
              {picker && (
                <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-[#fff] p-2 shadow-2xl">
                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#fbfaf6] px-3 py-2"><Search size={15} className="text-slate-400" />
                    <input autoFocus value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Project manager, sales manager, full stack developer…" aria-label="Find your role" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" /></label>
                  <ul role="listbox" aria-label="Roles" className="mt-1.5 max-h-72 overflow-auto">
                    {role && <li><button type="button" onClick={() => chooseRole(null)} className="w-full rounded-lg px-3 py-2 text-left text-[14px] text-slate-400 hover:bg-black/5">Any role: show everything</button></li>}
                    {data.roles.filter((r) => !pq.trim() || [r.name, ...r.aliases].some((n) => n.toLowerCase().includes(pq.trim().toLowerCase()))).map((r) => (
                      <li key={r.key}><button type="button" role="option" aria-selected={r.key === roleKey} onClick={() => chooseRole(r.key)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-black/5">
                        <span className="flex-1 font-semibold">{r.name}</span>{r.key === roleKey && <Check size={15} className="text-indigo-300" />}</button></li>
                    ))}
                    {pq.trim() && !data.roles.some((r) => [r.name, ...r.aliases].some((n) => n.toLowerCase().includes(pq.trim().toLowerCase()))) && <li className="px-3 py-2 text-[14px] text-slate-400">No role matches. Try an area below.</li>}
                  </ul>
                </div>
              )}
            </div>
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="What do you do?">
              {FOCUS.map((f) => (
                <button key={f.id} type="button" aria-pressed={!role && focus === f.id} onClick={() => choose(f.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-semibold transition ${!role && focus === f.id ? "border-[#14161f] bg-[#14161f] text-[#fff]" : "border-black/15 bg-[#fff] hover:border-indigo-400 hover:text-indigo-300"}`}>{f.label}</button>
              ))}
            </div>
          </div>
          {!standalone && <a href="#below" className="pointer-events-auto hidden shrink-0 items-center gap-1 rounded-full border border-black/10 bg-[#fff] px-3.5 py-1.5 text-[13px] font-semibold shadow-sm hover:shadow-md lg:inline-flex">Explore the academy<ChevronDown size={15} /></a>}
        </div>
      </div>

      {/* controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 sm:bottom-5 sm:right-5" style={{ right: !narrow && sel ? "25rem" : undefined }}>
        <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in" title="Zoom in" className="hidden sm:grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff]/95 shadow-md transition hover:bg-[#fff]"><Plus size={18} /></button>
        <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out" title="Zoom out" className="hidden sm:grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff]/95 shadow-md transition hover:bg-[#fff]"><Minus size={18} /></button>
        <button type="button" onClick={() => fitAll()} aria-label="See the whole map" title="See the whole map" className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff]/95 shadow-md transition hover:bg-[#fff]"><Crosshair size={18} /></button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2 sm:bottom-5">
        {hint && <p className="pointer-events-auto rounded-full bg-[#14161f]/85 px-3.5 py-1.5 text-[13px] font-medium text-[#fff]">{narrow ? "Drag to move · pinch to zoom · tap a stop" : "Drag to move · ctrl or ⌘ + scroll to zoom · click a stop"}</p>}
        <button type="button" onClick={goNext} disabled={!next} className="btn pointer-events-auto !rounded-full !px-4 !py-3 text-[15px] shadow-xl sm:!px-5 sm:text-base">Take me to my next stop<ArrowRight size={18} /></button>
      </div>

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
                  const anchor = STATIONS.filter((st) => st.track === r.track && routeIds.has(st.id)).sort((a, b) => a.x - b.x)[0];
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
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><circle cx="17" cy="13" r="11" fill="#f5b800" stroke="#14161f" strokeWidth="2" /></svg><span><b>Gold flag</b>: a live or upcoming race on this track</span></li>
              <li className="flex items-center gap-2.5"><svg width="34" height="26"><rect x="11" y="1" width="12" height="24" fill="#fbfaf6" stroke="#14161f" strokeWidth="2.5" /><circle cx="17" cy="6" r="6" fill="#fbfaf6" stroke="#14161f" strokeWidth="2.5" /><circle cx="17" cy="20" r="6" fill="#fbfaf6" stroke="#14161f" strokeWidth="2.5" /></svg><span><b>Gate</b>: a handoff where lines meet. Most projects fail here</span></li>
            </ul>
          </div>
        )}
      </div>

      {/* what is at this stop */}
      {(selStation || selGate) && (
        <aside aria-live="polite" className="absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-auto rounded-t-3xl border border-black/10 bg-[#fff] shadow-[0_-18px_44px_-20px_rgba(20,22,31,.5)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-5 sm:max-h-none sm:w-[22.5rem] sm:rounded-3xl">
          <button type="button" onClick={() => setSel(null)} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/5 hover:bg-black/10"><X size={16} /></button>
          {selStation && <StationCard st={selStation} info={data.tracks[selStation.track]} lens={mode === "agent" ? (route.agent.has(selStation.id) ? "agent" : route.review.has(selStation.id) || route.ai.has(selStation.id) ? "review" : null) : mode === "ai" && route.ai.has(selStation.id) ? "ai" : null} roleName={role?.name ?? null} races={racesByTrack.get(selStation.track) ?? []} signedIn={data.signedIn} onGo={(s) => pick({ kind: "st", id: s.id })} />}
          {selGate && <GateCard g={selGate} tracks={data.tracks} />}
        </aside>
      )}
    </section>
  );
}

function StationCard({ st, info, races, lens, roleName, signedIn, onGo }: { st: Station; info: TrackInfo | undefined; races: RaceInfo[]; lens: "agent" | "review" | "ai" | null; roleName: string | null; signedIn: boolean; onGo: (s: Station) => void }) {
  const line = LINE_BY_ID[st.line], c = LINE_COLOUR[st.line], z = zoneOf(st.x);
  const seq = stationsOn(st.line), i = seq.findIndex((s) => s.id === st.id), prev = seq[i - 1], nxt = seq[i + 1];
  const lvl = info?.passed ?? 0;
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl" style={{ background: c }} />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{line.name} line · {ZONES[z].name}</p>
          <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{st.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{LINE_BLURB[st.line]} Usually owned by a {st.owner.toLowerCase()}.</p>
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

        {info && (
          <div className="rounded-2xl border border-black/10 bg-[#fbfaf6] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Learn it in</p>
            <p className="mt-0.5 text-base font-bold">{info.name}</p>
            <div className="bar mt-2" title={`Level ${lvl} of 20`}><i style={{ width: `${(lvl / 20) * 100}%` }} /></div>
            <p className="mt-1.5 text-sm text-slate-400">{lvl > 0 ? `You are on level ${lvl} of 20.` : "20 levels, from Novice to Titan."}{info.required && <> <b className={info.overdue ? "text-rose-300" : "text-amber-300"}>{lvl >= info.requiredLevel ? "Required: done." : info.overdue ? "Required: overdue." : `Required${info.dueAt ? `, due ${fmtDate(info.dueAt)}` : ""}.`}</b></>}</p>
            {info.rival && <p className="mt-1 text-sm text-slate-400">{info.rival.name} is on level {info.rival.level}{info.rival.level > lvl ? ". Catch up." : lvl > info.rival.level ? ". You are ahead." : ". Dead level."}</p>}
            {info.open
              ? <Link href={`/tracks/${info.slug}`} className="btn mt-3 w-full justify-center">{lvl > 0 ? "Continue" : "Start learning"}<ArrowRight size={16} /></Link>
              : <p className="mt-3 text-sm text-slate-400">This track is not part of your plan.</p>}
            {!signedIn && <p className="mt-2 text-center text-xs text-slate-400"><Link href="/login" className="font-semibold text-indigo-300 hover:underline">Sign in</Link> to see your own progress here.</p>}
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

function GateCard({ g, tracks }: { g: Gate; tracks: Record<string, TrackInfo> }) {
  const z = zoneOf(g.x);
  const near = [...new Set(STATIONS.filter((s) => g.lines.includes(s.line) && Math.abs(s.x - g.x) <= 3).map((s) => s.track))].map((slug) => tracks[slug]).filter(Boolean).slice(0, 5);
  return (
    <div>
      <div className="h-2.5 rounded-t-3xl bg-[#14161f]" />
      <div className="space-y-4 p-5">
        <div className="pr-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Handoff gate · {ZONES[z].name}</p>
          <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{g.name}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">{g.lines.map((id: LineId) => <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#fbfaf6] px-2.5 py-0.5 text-xs font-semibold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLOUR[id] }} />{LINE_BY_ID[id].name}</span>)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Must arrive</h3><ul className="space-y-1">{g.ins.map((t) => <li key={t} className="flex gap-1.5"><span className="text-slate-500">←</span>{t}</li>)}</ul></div>
          <div><h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Leaves the gate</h3><ul className="space-y-1">{g.outs.map((t) => <li key={t} className="flex gap-1.5"><span className="text-slate-500">→</span>{t}</li>)}</ul></div>
        </div>
        <div className="rounded-2xl border-l-4 border-rose-400 bg-rose-50 p-3 text-sm"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-rose-300">Where it usually breaks</p><p className="mt-0.5">{g.fail}</p></div>
        {near.length > 0 && <div><h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Get this right: learn</h3><div className="flex flex-wrap gap-1.5">{near.map((t) => t.open ? <Link key={t.slug} href={`/tracks/${t.slug}`} className="rounded-full border border-black/15 bg-[#fff] px-3 py-1 text-[13px] font-semibold hover:border-indigo-400 hover:text-indigo-300">{t.name}</Link> : <span key={t.slug} className="rounded-full border border-black/10 px-3 py-1 text-[13px] text-slate-400">{t.name}</span>)}</div></div>}
      </div>
    </div>
  );
}
