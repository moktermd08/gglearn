import { createElement, type ReactNode } from "react";
import {
  Activity, BarChart3, Blocks, BookOpen, BrainCircuit, Check, Clock, Cloud, Code2, Database, EyeOff, Handshake, ListChecks, Lock, Mail, Network, PoundSterling,
  Scale, ShieldCheck, Sparkles, Target, Users, UsersRound, Wrench, X, type LucideIcon,
} from "lucide-react";
import { StackBar } from "@/components/charts";
import { BOX_DAYS, KNOWN_BOX, RANKS, type StudyState } from "@/lib/termsCore";
import type { TermDetail } from "@/lib/termDetails";

/** The pictures on a study card. Everything is drawn from the term's own data: no images to load and nothing to keep up to date by hand. */

// ---- an icon for a topic: the first rule whose words appear in the group's heading (then the bank's name) wins
const ICONS: [RegExp, LucideIcon][] = [
  [/privacy/, EyeOff], [/security|attack|identity|crypt|threat|vulnerab/, Lock], [/machine learning|generative|\bai\b/, BrainCircuit],
  [/network|connectivity/, Network], [/cloud|platform|data cent/, Cloud], [/database|storage|\bdata\b|pipeline/, Database],
  [/communicat|writing|email/, Mail], [/meeting|discussion/, Users], [/project|planning|delivery|organisation and time|time and/, ListChecks],
  [/report|information|analytics|measure|insight/, BarChart3], [/working pattern|time/, Clock], [/money|finance|pay\b|budget|cost|commercial|business/, PoundSterling],
  [/people|team|working with|hiring|career|performance/, UsersRound], [/customer|selling|service|supplier|vendor/, Handshake], [/tool|digital|files/, Wrench],
  [/law|legal|ethic|conduct|governance|compliance|rules|risk|parliament|constitution/, Scale], [/reliab|resilien|observab|operations|incident/, Activity],
  [/strategy|policy|goal/, Target], [/architecture|design|structure/, Blocks], [/program|code|develop|front|back|web|testing/, Code2], [/culture|quality/, Sparkles], [/safety/, ShieldCheck],
];
export function topicIcon(group: string, bank: string): LucideIcon {
  for (const text of [group.toLowerCase(), bank.toLowerCase()]) {
    const hit = ICONS.find(([re]) => re.test(text));
    if (hit) return hit[1];
  }
  return BookOpen;
}

export const TopicIcon = ({ group, bank, size }: { group: string; bank: string; size: number }) => createElement(topicIcon(group, bank), { size });

const HUES = ["#4f46e5", "#0369a1", "#047857", "#9333ea", "#be123c", "#b45309"];
/** A steady colour per topic, so the same group always looks the same. */
export const topicHue = (group: string) => HUES[[...group].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];

/** One colour a rank, from Initiate to Titan. */
export const RANK_COLOR = ["#0369a1", "#047857", "#4f46e5", "#9333ea", "#b45309"];

/** Five small bars, filled up to the term's rank. */
export function Pips({ tier }: { tier: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" role="img" aria-label={`${RANKS[tier - 1]} rank`}>
      {RANKS.map((r, i) => <i key={r} className="w-1 rounded-sm" style={{ height: 5 + i * 2, background: i < tier ? RANK_COLOR[tier - 1] : "#e5e2d9" }} />)}
    </span>
  );
}

export function Section({ Icon, title, color = "#4f46e5", children }: { Icon: LucideIcon; title: string; color?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-black/10 pt-4">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${color}1a`, color }} aria-hidden><Icon size={15} /></span>{title}
      </h3>
      {children}
    </section>
  );
}

/** Five steps from Initiate to Titan, filled up to the term's rank. */
export function RankLadder({ tier }: { tier: number }) {
  return (
    <div role="img" aria-label={`Rank ${tier} of 5: ${RANKS[tier - 1]}`} className="flex items-end gap-1.5">
      {RANKS.map((r, i) => (
        <div key={r} className="flex-1 text-center">
          <div className="rounded-md" style={{ height: 8 + i * 5, background: i + 1 === tier ? "#4f46e5" : i + 1 < tier ? "#c7d2fe" : "#ece9e0" }} />
          <div className={`mt-1 truncate text-[10px] ${i + 1 === tier ? "font-bold text-indigo-300" : "text-slate-400"}`}>{r}</div>
        </div>
      ))}
    </div>
  );
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
/** A term name on up to two lines. */
function lines(s: string, width = 16): string[] {
  const words = s.split(" ");
  let first = "";
  while (words.length && (first + " " + words[0]).trim().length <= width) first = (first + " " + words.shift()).trim();
  if (!first) return [clip(s, width)];
  return words.length ? [first, clip(words.join(" "), width)] : [first];
}

function Node({ x, y, label, w, fill, stroke, ink, bold }: { x: number; y: number; label: string; w: number; fill: string; stroke: string; ink: string; bold?: boolean }) {
  const text = lines(label, bold ? 17 : 16), h = 36;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
      {text.map((t, i) => <text key={i} x={x} y={y + 3.5 + (i - (text.length - 1) / 2) * 12} textAnchor="middle" fontSize={bold ? 11.5 : 10.5} fontWeight={bold ? 700 : 500} fill={ink}>{t}</text>)}
    </g>
  );
}

/** The term in the middle, joined to what it is easy to mix up with (dashed) and to its neighbours in the same group (solid). */
export function ConceptMap({ term, detail, selfId, hue }: { term: string; detail: TermDetail; selfId: number; hue: string }) {
  const alike = detail.compare.map((c) => ({ ...c, alike: true }));
  const skip = new Set([selfId, ...alike.map((a) => a.id)]);
  // neighbours taken from around this term's own place in the group, so nearby cards show different maps
  const others = detail.group.filter((g) => !skip.has(g.id));
  const at = Math.max(0, detail.group.findIndex((g) => g.id === selfId));
  const near = Array.from({ length: Math.min(6 - alike.length, others.length) }, (_, i) => ({ ...others[(at + i) % others.length], alike: false }));
  const nodes = [...alike, ...near];
  if (!nodes.length) return null;
  const pos = (i: number) => { const a = -Math.PI / 2 + (i / nodes.length) * 2 * Math.PI; return [180 + Math.cos(a) * 124, 130 + Math.sin(a) * 100] as const; };
  const label = `Map of ${term}. ${alike.length ? `Easy to mix up with ${alike.map((a) => a.term).join(", ")}. ` : ""}${near.length ? `Same topic: ${near.map((a) => a.term).join(", ")}.` : ""}`;
  return (
    <figure className="space-y-2">
      <svg viewBox="0 0 360 260" className="mx-auto w-full max-w-md" role="img" aria-label={label}>
        {nodes.map((n, i) => { const [x, y] = pos(i); return <line key={n.id} x1="180" y1="130" x2={x} y2={y} stroke={n.alike ? "#b45309" : hue} strokeOpacity={n.alike ? 0.9 : 0.35} strokeWidth="2" strokeDasharray={n.alike ? "5 4" : undefined} />; })}
        {nodes.map((n, i) => { const [x, y] = pos(i); return <Node key={n.id} x={x} y={y} w={104} label={n.term} fill={n.alike ? "#fffbeb" : "#ffffff"} stroke={n.alike ? "#b45309" : "#d6d3c9"} ink="#14161f" />; })}
        <Node x={180} y={130} w={124} label={term} fill={hue} stroke={hue} ink="#ffffff" bold />
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
        {near.length > 0 && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5 border-t-2" style={{ borderColor: hue }} />Same topic</span>}
        {alike.length > 0 && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5 border-t-2 border-dashed border-amber-700" />Easy to mix up</span>}
      </figcaption>
    </figure>
  );
}

/** The five memory boxes as a bar chart: each step up waits longer before the term is shown again. */
export function MemoryChart({ memory }: { memory: TermDetail["memory"] }) {
  const { box, seen, lapses, dueInDays } = memory;
  const next = Math.min(BOX_DAYS.length - 1, box + 1);
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2" role="img" aria-label={box ? `Memory box ${box} of 5` : "Not studied yet"}>
        {BOX_DAYS.slice(1).map((d, i) => {
          const b = i + 1, here = b === box;
          return (
            <div key={b} className="flex-1 text-center">
              <div className="text-[10px] font-bold text-indigo-300">{here ? "You" : " "}</div>
              <div className="rounded-t-md" style={{ height: 16 + i * 13, background: here ? "#4f46e5" : b <= box ? "#c7d2fe" : b >= KNOWN_BOX ? "#d1fae5" : "#ece9e0" }} />
              <div className="mt-1 text-[10px] text-slate-400">{days(d)}</div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-300">
        {seen === 0 ? "First time you meet this term." : <>Met {seen} time{seen === 1 ? "" : "s"}{lapses ? `, forgotten after knowing it ${lapses} time${lapses === 1 ? "" : "s"}` : ""}.{dueInDays ? ` Next due in ${days(dueInDays)}.` : " Due now."}</>}
        {" "}Say you knew it and it comes back in <b>{days(BOX_DAYS[next])}</b>; if not, in 10 minutes. It counts as <b>known</b> from the {days(BOX_DAYS[KNOWN_BOX])} box.
      </p>
    </div>
  );
}

export function TestHistory({ history }: { history: TermDetail["history"] }) {
  if (!history.length) return <p className="text-xs text-slate-300">Not asked in a test yet.</p>;
  const right = history.filter((h) => h.right).length;
  const when = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {history.map((h, i) => (
          <li key={i} className="text-center text-[10px] text-slate-400">
            <span className={`grid h-8 w-8 place-items-center rounded-full ${h.right ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{h.right ? <Check size={15} aria-label="Right" /> : <X size={15} aria-label="Wrong" />}</span>
            {when(h.at)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-300">{right} of {history.length} right in your latest tests.</p>
    </div>
  );
}

const STATE: Record<StudyState, { label: string; color: string; chip: string }> = {
  known: { label: "Known", color: "#059669", chip: "bg-emerald-100 text-emerald-800" },
  learning: { label: "Learning", color: "#d97706", chip: "bg-amber-100 text-amber-800" },
  new: { label: "Not started", color: "#d6d3c9", chip: "bg-black/5 text-slate-300" },
};

/** How far the person has got through this term's group. */
export function GroupProgress({ detail, selfId }: { detail: TermDetail; selfId: number }) {
  const count = (s: StudyState) => detail.group.filter((g) => g.state === s).length;
  return (
    <div className="space-y-2.5">
      <StackBar parts={(["known", "learning", "new"] as const).map((s) => ({ label: STATE[s].label, value: count(s), color: STATE[s].color }))} />
      <ul className="flex flex-wrap gap-1.5">
        {detail.group.map((g) => <li key={g.id} className={`rounded-full px-2.5 py-1 text-xs ${STATE[g.state].chip} ${g.id === selfId ? "font-bold ring-2 ring-indigo-500" : ""}`}>{g.term}<span className="sr-only">, {STATE[g.state].label}{g.id === selfId ? ", this term" : ""}</span></li>)}
      </ul>
    </div>
  );
}
