import Link from "next/link";
import { AlertTriangle, ArrowUpRight, FileQuestion, Hourglass, MailPlus, ShieldCheck, Stamp, UserX } from "lucide-react";
import { glanceCounts } from "@/lib/glance";
import { EXPIRED_NOTICE_DAYS, RENEW_WINDOW_DAYS } from "@/lib/certs";
import { awaitingSignoff } from "@/lib/onboarding";

/**
 * What a manager or admin has to act on, on the page they land on after signing in. Each tile goes straight to
 * the screen where the thing is fixed, and a tile with nothing to do stays quiet instead of showing a zero. Every number is
 * counted over the companies this person runs only (lib/glance.ts).
 */
export function ManagerGlance({ admin, viewer }: { admin: boolean; viewer: { id: number; role: string } }) {
  const g = glanceCounts(viewer);
  const signoffs = awaitingSignoff(viewer).length;
  const { overdue, unassigned, invitesWaiting: waiting, held, unread } = g;
  const certLine = [g.certs.expiring && `${g.certs.expiring} certificate${g.certs.expiring === 1 ? "" : "s"} expire${g.certs.expiring === 1 ? "s" : ""} within ${RENEW_WINDOW_DAYS} days`, g.certs.expired && `${g.certs.expired} expired in the last ${EXPIRED_NOTICE_DAYS} days`].filter(Boolean).join(", ");

  const items = [
    signoffs > 0 && { Icon: Stamp, tone: "bg-violet-500/12 text-violet-500", href: "/admin/people", text: `${signoffs} onboarding phase${signoffs === 1 ? " is" : "s are"} finished and waiting for your sign-off` },
    certLine && { Icon: Hourglass, tone: "bg-amber-500/12 text-amber-500", href: "/admin/certificates?show=expiring", text: certLine },
    overdue > 0 && { Icon: AlertTriangle, tone: "bg-rose-500/12 text-rose-500", href: "/admin/compliance", text: `${overdue} ${overdue === 1 ? "person is" : "people are"} overdue on required learning` },
    unassigned > 0 && { Icon: UserX, tone: "bg-amber-500/12 text-amber-500", href: "/admin/people", text: `${unassigned} ${unassigned === 1 ? "person has" : "people have"} no company, brand or project, so no path` },
    waiting > 0 && { Icon: MailPlus, tone: "bg-sky-500/12 text-sky-300", href: "/admin/people", text: `${waiting} invite${waiting === 1 ? "" : "s"} not accepted yet` },
    unread > 0 && { Icon: ShieldCheck, tone: "bg-violet-500/12 text-violet-500", href: "/admin/freshness", text: `${unread} company update${unread === 1 ? "" : "s"} still unread by someone` },
    admin && held > 0 && { Icon: FileQuestion, tone: "bg-indigo-500/12 text-indigo-500", href: "/admin/paths", text: `${held.toLocaleString("en-GB")} question${held === 1 ? " is" : "s are"} held for approval` },
  ].filter(Boolean) as { Icon: typeof AlertTriangle; tone: string; href: string; text: string }[];

  return (
    <section aria-label="Needs your attention" className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400"><ShieldCheck size={17} /></span>Needs your attention</h2>
        <Link href="/admin/people" className="text-xs text-sky-300 underline">People</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing is waiting on you: nobody is overdue and everyone has a path. <Link href="/admin/people" className="underline">Invite someone</Link> or check <Link href="/admin/compliance" className="underline">who is up to date</Link>.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(({ Icon, tone, href, text }) => (
            <li key={text}>
              <Link href={href} className="group flex items-center gap-3 rounded-xl p-2 text-sm transition hover:bg-black/[.03]">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={16} /></span>
                <span className="min-w-0 flex-1">{text}</span>
                <ArrowUpRight size={15} className="shrink-0 text-slate-400 transition group-hover:text-slate-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
