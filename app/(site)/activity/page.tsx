import Link from "next/link";
import { Activity, BookOpen, ClipboardList, GraduationCap, Medal } from "lucide-react";
import { EmptyState, PageHero, PALETTE, StatTile } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { activityHistoryFor, KINDS, type Kind } from "@/lib/activityHistory";

export const metadata = { title: "Activity history — gglearn" };
export const dynamic = "force-dynamic";

const PAGE = 30;
const ICON = { exam: GraduationCap, quest: BookOpen, plan: ClipboardList, earned: Medal } as const;
const TONE = { exam: "bg-sky-500/15 text-sky-300", quest: "bg-emerald-500/15 text-emerald-300", plan: "bg-indigo-500/15 text-indigo-300", earned: "bg-yellow-500/15 text-yellow-500" } as const;

const dayKey = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
function dayLabel(key: string) {
  const today = dayKey(Math.floor(Date.now() / 1000)), yest = dayKey(Math.floor(Date.now() / 1000) - 86400);
  if (key === today) return "Today";
  if (key === yest) return "Yesterday";
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function ActivityHistory({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string }> }) {
  const { kind: kq, page: pq } = await searchParams;
  const me = await requireUser();
  const all = activityHistoryFor(me.id);
  const count = (k: Kind) => all.filter((e) => e.kind === k).length;
  const kind = KINDS.find((k) => k.key === kq)?.key;
  const rows = kind ? all.filter((e) => e.kind === kind) : all;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(pq)) || 1));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const groups: { day: string; items: typeof shown }[] = [];
  for (const e of shown) { const d = dayKey(e.at), g = groups[groups.length - 1]; if (g?.day === d) g.items.push(e); else groups.push({ day: d, items: [e] }); }

  const href = (k: Kind | undefined, p: number) => { const q = new URLSearchParams(); if (k) q.set("kind", k); if (p > 1) q.set("page", String(p)); const s = q.toString(); return `/activity${s ? `?${s}` : ""}`; };
  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-sky-400 bg-sky-500/20 text-sky-200" : "border-slate-600/50 text-slate-300 hover:border-slate-400"}`;
  const activeDays = new Set(all.map((e) => dayKey(e.at))).size;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Activity} tone="indigo" title="Activity history" sub="Every exam, daily quest, plan entry, badge and level up, newest first." />

      {all.length === 0 ? (
        <EmptyState Icon={Activity} title="Nothing here yet">Finish a daily quest or an exam and it shows up here. <Link href="/dashboard" className="font-bold text-indigo-300 underline">Go to my quest</Link></EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile i={0} Icon={Activity} label="Entries" value={all.length.toLocaleString("en-GB")} color={PALETTE.indigo} />
            <StatTile i={1} Icon={GraduationCap} label="Exams passed" value={all.filter((e) => e.kind === "exam" && e.good).length} color={PALETTE.sky} />
            <StatTile i={2} Icon={BookOpen} label="Active days" value={activeDays} color={PALETTE.emerald} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
            <Link href="/activity" scroll={false} className={chip(!kind)} aria-current={!kind ? "true" : undefined}>All <span className="opacity-70">{all.length}</span></Link>
            {KINDS.filter((k) => count(k.key) > 0).map((k) => { const Icon = ICON[k.key]; return <Link key={k.key} href={href(k.key, 1)} scroll={false} className={chip(kind === k.key)} aria-current={kind === k.key ? "true" : undefined}><Icon size={13} />{k.label} <span className="opacity-70">{count(k.key)}</span></Link>; })}
          </div>

          <div className="space-y-5">
            {groups.map(({ day, items }) => (
              <section key={day} aria-label={dayLabel(day)}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">{dayLabel(day)}<span className="h-px flex-1 bg-black/10" /></h2>
                <ul className="card divide-y divide-black/5 overflow-hidden">
                  {items.map((e) => { const Icon = ICON[e.kind]; return (
                    <li key={e.id}>
                      <Link href={e.href} className="flex items-center gap-3 p-3.5 transition hover:bg-black/[.03]">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE[e.kind]}`}><Icon size={17} /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{e.title}</span>{e.detail && <span className="block truncate text-xs text-slate-400">{e.detail}</span>}</span>
                      </Link>
                    </li>
                  ); })}
                </ul>
              </section>
            ))}
          </div>

          {pages > 1 && (
            <nav className="flex items-center justify-between text-sm" aria-label="Pages">
              {page > 1 ? <Link href={href(kind, page - 1)} className="btn btn-ghost">Newer</Link> : <span />}
              <span className="text-xs text-slate-400">Page {page} of {pages}</span>
              {page < pages ? <Link href={href(kind, page + 1)} className="btn btn-ghost">Older</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
