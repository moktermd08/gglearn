import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Flag, MapPin, Rocket, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import { chooseMyRoleAction } from "@/app/journey-actions";
import { mayChooseOwnRole } from "@/lib/ownRole";
import { routeRoles, startedRoleTargets } from "@/lib/routeRole";
import { myStudyRoles, roleLabel, roleList, roleSummary } from "@/lib/termStudy";
import { termsAvailable } from "@/lib/terms";
import { termUrl } from "@/lib/termUrls";
import type { users } from "@/lib/db";

/**
 * What a career page shows to someone who has no career path yet: why it is empty, the one thing that fills it, what can be done without it,
 * and whatever they already have under way. A page with nothing on it should always say what to do next.
 */
type Person = typeof users.$inferSelect;

const input = "w-full rounded-xl border border-black/20 bg-[#fff] px-3 py-2.5";

function Way({ href, Icon, color, title, children, action }: { href: string; Icon: LucideIcon; color: string; title: string; children: React.ReactNode; action: string }) {
  return (
    <li>
      <Link href={href} className="card card-hover flex h-full flex-col gap-2 p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${color}1a`, color }} aria-hidden><Icon size={22} /></span>
        <b>{title}</b>
        <span className="text-sm text-slate-400">{children}</span>
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-indigo-300">{action}<ArrowRight size={14} aria-hidden /></span>
      </Link>
    </li>
  );
}

/** The terms and routes a person has already started, so nothing they did is out of sight. */
export function UnderWay({ user }: { user: Person }) {
  const words = termsAvailable() ? myStudyRoles(user.id).flatMap((r) => { const list = roleList(r.role, r.level); return list ? [{ r, list, sum: roleSummary(user.id, list) }] : []; }) : [];
  const routes = startedRoleTargets(user.id);
  if (!words.length && !routes.length) return null;
  return (
    <section className="space-y-2" aria-labelledby="under-way">
      <h2 id="under-way" className="text-lg font-extrabold">Already under way</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {routes.map((t) => (
          <li key={t.slug}><Link href={`/route/${t.slug}`} className="card card-hover flex items-center gap-3 p-3">
            <Compass size={20} className="shrink-0 text-emerald-300" aria-hidden />
            <span className="min-w-0 flex-1"><b className="block text-sm">Route to {t.short}</b><span className="text-xs text-slate-400">Your check and dated plan</span></span>
            <ArrowRight size={15} aria-hidden />
          </Link></li>
        ))}
        {words.map(({ r, list, sum }) => (
          <li key={r.id}><Link href={termUrl("role", r.role, r.level)} className="card card-hover flex items-center gap-3 p-3">
            <BookOpen size={20} className="shrink-0 text-indigo-300" aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-sm">Words for {roleLabel(r.role)}</b>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/10" aria-hidden><i className="block h-full rounded-full bg-emerald-500" style={{ width: `${sum.total ? (sum.counts.known / sum.total) * 100 : 0}%` }} /></span>
              <span className="text-xs text-slate-400">{list.title} · {sum.counts.known} of {sum.total} known</span>
            </span>
            <ArrowRight size={15} aria-hidden />
          </Link></li>
        ))}
      </ul>
    </section>
  );
}

export function RoleChooser({ current, label }: { current: string; label: string }) {
  const roles = routeRoles();
  const families = [...new Set(roles.map((r) => r.family))].sort();
  return (
    <form action={chooseMyRoleAction} className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 flex-[1_1_16rem] gap-1 text-sm font-semibold">
        The job you do now, or the closest one
        <select name="role" required defaultValue={roles.some((r) => r.role === current) ? current : ""} className={input}>
          <option value="" disabled>Choose a job…</option>
          {families.map((f) => <optgroup key={f} label={f}>{roles.filter((r) => r.family === f).map((r) => <option key={r.role} value={r.role}>{r.name}</option>)}</optgroup>)}
        </select>
      </label>
      <button className="btn">{label}<ArrowRight size={16} aria-hidden /></button>
    </form>
  );
}

export function CareerStart({ user, error }: { user: Person; error?: string | null }) {
  const choose = mayChooseOwnRole(user);
  const customer = user.audience === "customer";
  const noRole = user.jobRole === "general";
  const why = customer ? "Career journeys are for staff accounts. You can still learn any subject and the words of any job."
    : noRole ? "Your journey starts from the job you do now, and you have not said what that is yet."
    : `There is no career ladder for the role “${user.jobRole}” yet, so there is nothing to climb from here.`;
  const steps: [LucideIcon, string, string][] = [[MapPin, "Where you are", "your job now"], [Flag, "Where you want to be", "your goal and date"], [Rocket, "How to get there", "steps, in order"]];
  return (
    <div className="space-y-5">
      {error && <p role="alert" className="card p-3 text-sm text-amber-300">{error}</p>}
      <section className="card space-y-4 p-5" aria-label="Start your journey">
        <div>
          <h2 className="text-xl font-extrabold">{customer ? "What you can do here" : "Start your journey"}</h2>
          <p className="text-sm text-slate-300">{why}</p>
        </div>
        {!customer && (
          <ol className="grid gap-2 sm:grid-cols-3">
            {steps.map(([Icon, title, sub], i) => (
              <li key={title} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${i === 0 ? "border-indigo-500 bg-indigo-500/10" : "border-black/10"}`} aria-current={i === 0 ? "step" : undefined}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-indigo-500 text-[#fff]" : "bg-black/5 text-slate-400"}`} aria-hidden><Icon size={18} /></span>
                <span><b className="block text-sm">{i + 1}. {title}</b><span className="text-xs text-slate-400">{sub}</span></span>
              </li>
            ))}
          </ol>
        )}
        {choose ? (
          <>
            <RoleChooser current={user.jobRole} label="Show my journey" />
            <p className="text-xs text-slate-400">You start at the first level of that job; your exams show how far you have really got. You can change it later. Not working yet? Use one of the choices below.</p>
          </>
        ) : !customer && (
          <p className="flex items-start gap-2 rounded-xl bg-sky-500/10 p-3 text-sm text-slate-300">
            <UserRound size={17} className="mt-0.5 shrink-0 text-sky-300" aria-hidden />
            <span>Your job role is set by whoever runs your team, because it decides what you must learn. {user.role === "admin"
              ? <>Nobody changes their own: ask another admin to set yours on <Link href="/admin/people" className="underline">People</Link>.</>
              : "Ask them to set it, and your journey appears here."}</span>
          </p>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="ways">
        <h2 id="ways" className="text-lg font-extrabold">{customer ? "Start here" : "Or start now, without a job role"}</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {!customer && <Way href="/route/role" Icon={Compass} color="#047857" title="Aim for any job" action="Choose a job">See what it takes, check where you stand and get a dated plan.</Way>}
          <Way href="/terms/start" Icon={BookOpen} color="#4f46e5" title="Learn the words" action="Start learning">Every job has words you are expected to know. Start from nothing or find your level.</Way>
          {!customer && <Way href="/career-doctor" Icon={Stethoscope} color="#be123c" title="Not sure yet?" action="Ask the career doctor">Find out which kinds of work could suit you.</Way>}
          {customer && <Way href="/#subjects" Icon={Rocket} color="#b45309" title="Browse subjects" action="Pick a subject">Learn a product or topic, one level at a time.</Way>}
        </ul>
      </section>

      <UnderWay user={user} />
    </div>
  );
}
