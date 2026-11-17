import { CalendarClock, Download, Eye, EyeOff, FileCheck2, Globe, KeyRound, Lock, Mail, MapPin, Phone, Link2, Search, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { SECTION_KEYS, SECTION_TITLE, type View } from "@/lib/cv/types";

export type Day = { day: number; views: number; pdfs: number };
type Kind = "public" | "private" | "passcode";

/** One look per kind of link, so a list of them can be read at a glance. */
export const KIND = {
  public: { Icon: Globe, name: "Public", help: "Anyone can open it", tint: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25", bar: "bg-emerald-500", fill: "bg-emerald-500", edge: "border-l-emerald-500" },
  private: { Icon: Lock, name: "Private", help: "Only people you send it to", tint: "bg-sky-500/10 text-sky-700 ring-sky-500/25", bar: "bg-sky-500", fill: "bg-sky-500", edge: "border-l-sky-500" },
  passcode: { Icon: KeyRound, name: "Passcode", help: "Link plus a code", tint: "bg-violet-500/10 text-violet-700 ring-violet-500/25", bar: "bg-violet-500", fill: "bg-violet-500", edge: "border-l-violet-500" },
} as const satisfies Record<Kind, unknown>;

const fmt = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sum = (d: Day[], k: "views" | "pdfs") => d.reduce((a, x) => a + x[k], 0);

/** 30 days as bars, tallest scaled to the box, with the first and last date under it. */
export function Bars({ days, tone = "bg-sky-500", height = "h-16", label }: { days: Day[]; tone?: string; height?: string; label: string }) {
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <div>
      <div role="img" aria-label={label} className={`flex ${height} items-end gap-[3px]`}>
        {days.map((d) => (
          <span key={d.day} title={`${fmt(d.day)}: ${plural(d.views, "view")}${d.pdfs ? `, ${plural(d.pdfs, "PDF")}` : ""}`}
            className={`relative flex-1 rounded-t-[3px] transition-opacity hover:opacity-70 ${d.views ? tone : "bg-black/[0.07]"}`}
            style={{ height: `${d.views ? Math.max(14, Math.round((d.views / max) * 100)) : 5}%` }}>
            {d.pdfs > 0 && <span className="absolute -top-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-500 ring-2 ring-white" />}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{days.length ? fmt(days[0].day) : ""}</span><span>Today</span></div>
    </div>
  );
}

/** A number with a word under it, and a small trend against the week before. */
function Stat({ Icon, value, label, note, tone }: { Icon: typeof Eye; value: ReactNode; label: string; note?: ReactNode; tone: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-3.5">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}><Icon size={16} aria-hidden /></span>
      <div className="mt-2 text-2xl font-extrabold leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-600">{label}</div>
      {note && <div className="mt-0.5 text-[11px] text-slate-400">{note}</div>}
    </div>
  );
}

function Trend({ now, before }: { now: number; before: number }) {
  if (now === 0 && before === 0) return <>Nothing yet this week</>;
  const up = now > before, same = now === before, Ic = same ? Minus : up ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 font-semibold ${same ? "text-slate-500" : up ? "text-emerald-600" : "text-rose-600"}`}><Ic size={11} aria-hidden />{now} this week, {before} the week before</span>;
}

/** The top of the Share section: what all the links did together in 30 days. */
export function LinksOverview({ links }: { links: { id: number; label: string; kind: Kind; days: Day[] }[] }) {
  if (links.length === 0) return null;
  const len = links[0].days.length;
  const all: Day[] = Array.from({ length: len }, (_, i) => ({ day: links[0].days[i].day, views: links.reduce((a, l) => a + l.days[i].views, 0), pdfs: links.reduce((a, l) => a + l.days[i].pdfs, 0) }));
  const views = sum(all, "views"), pdfs = sum(all, "pdfs");
  const w1 = sum(all.slice(-7), "views"), w0 = sum(all.slice(-14, -7), "views");
  const top = [...links].map((l) => ({ ...l, v: sum(l.days, "views") })).sort((a, b) => b.v - a.v)[0];
  const quiet = links.filter((l) => sum(l.days, "views") === 0).length;
  return (
    <div className="space-y-3 rounded-2xl bg-gradient-to-br from-sky-500/[0.07] via-white to-violet-500/[0.07] p-4 ring-1 ring-black/5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat Icon={Link2} value={links.length} label={links.length === 1 ? "Live link" : "Live links"} note={quiet ? `${quiet} unread in 30 days` : "All have been read"} tone="bg-sky-500/10 text-sky-700" />
        <Stat Icon={Eye} value={views} label="Views, 30 days" note={<Trend now={w1} before={w0} />} tone="bg-emerald-500/10 text-emerald-700" />
        <Stat Icon={Download} value={pdfs} label="PDF downloads" note={pdfs ? "A download usually means real interest" : "None in 30 days"} tone="bg-amber-500/10 text-amber-700" />
        <Stat Icon={FileCheck2} value={top.v ? <span className="block max-w-full truncate text-base leading-tight">{top.label || "Untitled link"}</span> : "—"} label="Most read" note={top.v ? plural(top.v, "view") : "No reads yet"} tone="bg-violet-500/10 text-violet-700" />
      </div>
      <div className="rounded-xl border border-black/5 bg-white p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><b className="text-slate-700">All links together, last 30 days</b><span className="flex items-center gap-3 text-slate-400"><i className="inline-flex items-center gap-1 not-italic"><span className="h-2 w-2 rounded-sm bg-sky-500" />views</i><i className="inline-flex items-center gap-1 not-italic"><span className="h-2 w-2 rounded-full bg-amber-500" />PDF downloaded</i></span></div>
        <Bars days={all} height="h-20" label={`${plural(views, "view")} and ${plural(pdfs, "PDF download")} across all links in the last 30 days`} />
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><EyeOff size={12} aria-hidden />Counts only. We never record who looked. Link previews, crawlers and you reading your own link are not counted.</p>
    </div>
  );
}

/** How long a link has left, drawn as the share of its life already used. */
export function Lifespan({ createdAt, expiresAt, now }: { createdAt: number; expiresAt: number | null; now: number }) {
  if (expiresAt == null) return <div className="flex items-center gap-2 text-xs text-slate-500"><CalendarClock size={13} aria-hidden />Never ends. Revoke it when you are done.</div>;
  const total = Math.max(1, expiresAt - createdAt), used = Math.min(1, Math.max(0, (now - createdAt) / total)), left = Math.max(0, Math.ceil((expiresAt - now) / 86400));
  const hot = left <= 7;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs"><span className={`flex items-center gap-1.5 font-semibold ${hot ? "text-amber-700" : "text-slate-600"}`}><CalendarClock size={13} aria-hidden />{left === 0 ? "Ends today" : `Ends in ${plural(left, "day")}`}</span><span className="text-slate-400">{fmt(expiresAt)}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]" role="img" aria-label={`${Math.round(used * 100)} percent of this link's life used`}><div className={`h-full rounded-full ${hot ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${Math.round(used * 100)}%` }} /></div>
    </div>
  );
}

/** What a reader of this link will see: every section on or off, then contact, PDF and search. */
export function Exposure({ view, allowPdf, indexable, kind }: { view: View; allowPdf: boolean; indexable: boolean; kind: Kind }) {
  const on = SECTION_KEYS.filter((k) => view.sections[k]).length;
  const contact = [["email", Mail, "Email"], ["phone", Phone, "Phone"], ["location", MapPin, "Location"], ["links", Link2, "Links"]] as const;
  const chip = (yes: boolean) => `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${yes ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25" : "bg-black/[0.03] text-slate-400 line-through ring-black/5"}`;
  return (
    <div className="space-y-2 rounded-xl bg-black/[0.025] p-3">
      <div className="flex items-center justify-between text-xs"><b className="text-slate-700">What a reader sees</b><span className="text-slate-400">{on} of {SECTION_KEYS.length} sections</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((on / SECTION_KEYS.length) * 100)}%` }} /></div>
      <div className="flex flex-wrap gap-1">{SECTION_KEYS.map((k) => <span key={k} className={chip(view.sections[k])}>{SECTION_TITLE[k]}</span>)}</div>
      <div className="flex flex-wrap gap-1 border-t border-black/5 pt-2">
        {contact.map(([k, Ic, n]) => <span key={k} className={chip(view.contact[k])}><Ic size={11} aria-hidden />{n}</span>)}
        <span className={chip(allowPdf)}><Download size={11} aria-hidden />PDF</span>
        {kind === "public" && <span className={chip(indexable)}><Search size={11} aria-hidden />Search engines</span>}
      </div>
    </div>
  );
}

/** The header of a link card: a coloured badge for the kind, the note, and a status line. */
export function LinkHead({ label, kind, views, last }: { label: string; kind: Kind; views: number; last: string | null }) {
  const K = KIND[kind];
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${K.tint}`}><K.Icon size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1"><b className="block truncate text-base">{label || "Untitled link"}</b><span className="text-xs text-slate-500">{K.name} · {K.help}</span></div>
      <div className="text-right"><div className="text-xl font-extrabold leading-none">{views}</div><div className="text-[11px] text-slate-400">{views === 1 ? "view" : "views"} total{last ? ` · last ${last}` : ""}</div></div>
    </div>
  );
}

/** One link's 30 days with the week-on-week change in words. */
export function LinkActivity({ days }: { days: Day[] }) {
  const total = sum(days, "views"), pdfs = sum(days, "pdfs"), w1 = sum(days.slice(-7), "views"), w0 = sum(days.slice(-14, -7), "views");
  if (total === 0 && pdfs === 0) return <p className="rounded-xl border border-dashed border-black/10 p-3 text-center text-xs text-slate-400">No reads in the last 30 days. Send the link, or open “Preview as this reader” to check it first.</p>;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs"><b className="text-slate-700">{plural(total, "view")} in 30 days{pdfs ? ` · ${plural(pdfs, "PDF")}` : ""}</b><span className="text-slate-500"><Trend now={w1} before={w0} /></span></div>
      <Bars days={days} label={`${plural(total, "view")} and ${plural(pdfs, "PDF download")} in the last 30 days`} />
    </div>
  );
}
