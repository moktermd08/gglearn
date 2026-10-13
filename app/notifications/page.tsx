import Link from "next/link";
import { ArrowRight, Bell, BellRing, CalendarDays, CheckCheck, Flame, Medal, Sparkles, Swords } from "lucide-react";
import { EmptyState, PageHero, PALETTE, StatTile } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { listNotes, unreadCount } from "@/lib/notifications";
import { progressionFor } from "@/lib/progression";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notifications — gglearn" };
export const dynamic = "force-dynamic";

const ICON = { badge: Medal, level: Sparkles, season: CalendarDays, contest: Swords, system: Bell } as const;
const LABEL = { badge: "Badges", level: "Levels", season: "Seasons", contest: "Contests", system: "System" } as const;
const EDGE = { badge: "#eab308", level: "#0ea5e9", season: "#9333ea", contest: "#ec4899", system: "#94a3b8" } as const;
type Kind = keyof typeof ICON;
const TONE = { badge: "bg-yellow-500/15 text-yellow-500", level: "bg-sky-500/15 text-sky-300", season: "bg-violet-500/15 text-violet-300", contest: "bg-pink-500/15 text-pink-300", system: "bg-slate-500/15 text-slate-300" } as const;

const dayOf = (sec: number) => Math.floor(sec / 86400);
function bucket(sec: number) {
  const d = dayOf(Math.floor(Date.now() / 1000)) - dayOf(sec);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? "This week" : "Earlier";
}

function ago(sec: number) {
  const d = Math.floor(Date.now() / 1000) - sec;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function Notifications({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: kq } = await searchParams;
  const me = await requireUser();
  const p = progressionFor(me.id); // records anything newly earned so it is in the list below
  const all = listNotes(me.id), unread = unreadCount(me.id);
  const count = (k: Kind) => all.filter((n) => n.kind === k).length;
  const kinds = (Object.keys(ICON) as Kind[]).filter((k) => count(k) > 0);
  const kind = kinds.find((k) => k === kq);
  const notes = kind ? all.filter((n) => n.kind === kind) : all;
  const groups = ["Today", "Yesterday", "This week", "Earlier"].map((g) => ({ g, items: notes.filter((n) => bucket(n.createdAt) === g) })).filter((x) => x.items.length > 0);
  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-sky-400 bg-sky-500/20 text-sky-300" : "border-slate-600/50 text-slate-300 hover:border-slate-400"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Bell} tone="sky" title="Notifications" sub="Badges you earn, level ups, season results and contest invitations. They stay here until you read them.">
        {unread > 0 && <form action={markAllReadAction}><button className="btn btn-ghost" type="submit"><CheckCheck size={16} />Mark all read</button></form>}
      </PageHero>

      {p.streak.atRisk && (
        <Link href="/dashboard" className="card card-hover flex items-center gap-3 border border-orange-400/40 p-4" aria-label="Streak reminder">
          <Flame size={28} className="shrink-0 text-orange-500" fill="#f97316" />
          <div><div className="font-bold">Your {p.streak.current}-day streak ends tonight (UTC)</div><p className="text-sm text-slate-400">Finish one quest or exam today to keep it alive.</p></div>
        </Link>
      )}

      {all.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile i={0} Icon={BellRing} label="Unread" value={unread} color={unread ? PALETTE.sky : PALETTE.slate} />
            <StatTile i={1} Icon={Medal} label="Badges" value={count("badge")} color={PALETTE.amber} />
            <StatTile i={2} Icon={CalendarDays} label="Season results" value={count("season")} color={PALETTE.violet} />
          </div>
          {kinds.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
              <Link href="/notifications" scroll={false} className={chip(!kind)} aria-current={!kind ? "true" : undefined}>All <span className="opacity-70">{all.length}</span></Link>
              {kinds.map((k) => { const Icon = ICON[k]; return <Link key={k} href={`/notifications?kind=${k}`} scroll={false} className={chip(kind === k)} aria-current={kind === k ? "true" : undefined}><Icon size={13} />{LABEL[k]} <span className="opacity-70">{count(k)}</span></Link>; })}
            </div>
          )}
        </>
      )}

      {all.length === 0 ? (
        <EmptyState Icon={Bell} tone="sky" title="All quiet for now">Pass a level, earn a badge, finish a season or get invited to a contest and it will show up here. <Link href="/dashboard" className="font-bold text-indigo-300 underline">Go to my quest</Link></EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(({ g, items }) => (
            <section key={g} aria-label={g}>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">{g}<span className="h-px flex-1 bg-black/10" /></h2>
              <ul className="card divide-y divide-black/5 overflow-hidden" aria-label={g}>
                {items.map((n) => {
                  const Icon = ICON[n.kind], inner = (
                    <div className={`flex items-start gap-3 border-l-4 px-4 py-3 ${n.readAt ? "" : "bg-sky-500/[.07]"}`} style={{ borderLeftColor: n.readAt ? "transparent" : EDGE[n.kind] }}>
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[n.kind]}`}><Icon size={19} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2"><span className={`text-sm ${n.readAt ? "font-semibold" : "font-bold"}`}>{n.title}</span>{!n.readAt && <><i className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden /><span className="sr-only">Unread</span></>}</div>
                        {n.body && <p className="text-sm text-slate-400">{n.body}</p>}
                        <span className="mt-1 inline-block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{LABEL[n.kind]}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-400"><span>{ago(n.createdAt)}</span>{n.href && <ArrowRight size={14} />}</div>
                    </div>);
                  return <li key={n.id}>{n.href ? <Link href={n.href} className="block transition hover:bg-black/[.03]">{inner}</Link> : inner}</li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
