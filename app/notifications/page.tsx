import Link from "next/link";
import { Bell, CalendarDays, CheckCheck, Flame, Medal, Sparkles, Swords, Trophy } from "lucide-react";
import { PageHero } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { listNotes, unreadCount } from "@/lib/notifications";
import { progressionFor } from "@/lib/progression";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notifications — gglearn" };
export const dynamic = "force-dynamic";

const ICON = { badge: Medal, level: Sparkles, season: CalendarDays, contest: Swords, system: Bell } as const;
const TONE = { badge: "bg-yellow-500/15 text-yellow-500", level: "bg-sky-500/15 text-sky-300", season: "bg-violet-500/15 text-violet-300", contest: "bg-pink-500/15 text-pink-300", system: "bg-slate-500/15 text-slate-300" } as const;

function ago(sec: number) {
  const d = Math.floor(Date.now() / 1000) - sec;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function Notifications() {
  const me = await requireUser();
  const p = progressionFor(me.id); // records anything newly earned so it is in the list below
  const notes = listNotes(me.id), unread = unreadCount(me.id);

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

      {notes.length === 0 ? (
        <div className="card p-8 text-center text-slate-300"><Trophy className="mx-auto mb-2 text-amber-300" />Nothing yet. Pass a level, earn a badge or finish a season and it will show up here.</div>
      ) : (
        <ul className="card divide-y divide-black/5 overflow-hidden" aria-label="Notifications">
          {notes.map((n) => {
            const Icon = ICON[n.kind], inner = (
              <div className={`flex items-start gap-3 px-4 py-3 ${n.readAt ? "" : "bg-sky-500/[.07]"}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE[n.kind]}`}><Icon size={18} /></span>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-bold">{n.title}</span>{!n.readAt && <><i className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden /><span className="sr-only">Unread</span></>}</div>
                  {n.body && <p className="text-sm text-slate-400">{n.body}</p>}</div>
                <span className="shrink-0 text-xs text-slate-400">{ago(n.createdAt)}</span>
              </div>);
            return <li key={n.id}>{n.href ? <Link href={n.href} className="block transition hover:bg-black/[.03]">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
