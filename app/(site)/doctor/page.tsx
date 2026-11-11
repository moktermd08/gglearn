import Link from "next/link";
import { ArrowRight, Compass, Gauge, Stethoscope } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHero } from "@/components/charts";
import { diagnose, type FamilyFit, type RoleFit } from "@/lib/careerDoctor";
import { rolesWithLadders } from "@/lib/careers";
import { checkMyLevel } from "./actions";

export const metadata = { title: "Career doctor — gglearn" };

const pct = (n: number) => `${Math.round(n * 100)}%`;
/** How far to trust a fit: one tested area out of six says little. */
const trust = (c: number) => (c >= 0.6 ? { label: "Solid evidence", cls: "bg-emerald-500/15 text-emerald-700" } : c >= 0.3 ? { label: "Some evidence", cls: "bg-amber-500/15 text-amber-700" } : { label: "Early signs", cls: "bg-sky-500/15 text-sky-700" });

function Bar({ value }: { value: number }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-black/10" role="img" aria-label={pct(value)}><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: pct(value) }} /></div>;
}

function RoleCard({ r, mine }: { r: RoleFit; mine: boolean }) {
  const t = trust(r.coverage), strong = r.areas.filter((a) => a.have >= a.need), weak = r.areas.filter((a) => a.tested && a.have < a.need), blank = r.areas.filter((a) => !a.tested);
  return (
    <li className="card space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{r.name}</h3>
        {mine && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">your role now</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.cls}`}>{t.label}</span>
        <span className="ml-auto text-sm font-semibold">{pct(r.fit)} fit</span>
      </div>
      <Bar value={r.fit} />
      {r.blurb && <p className="text-sm text-slate-600">{r.blurb}</p>}
      <p className="text-xs text-slate-600">
        {strong.length > 0 && <>Already there: {strong.map((a) => a.name).join(", ")}. </>}
        {weak.length > 0 && <>Growing: {weak.map((a) => a.name).join(", ")}. </>}
        {blank.length > 0 && <>Not tried yet: {blank.length} of {r.areas.length} areas.</>}
      </p>
      <div className="flex flex-wrap gap-2 pt-1 text-sm">
        <Link href={`/route/role?role=${encodeURIComponent(r.role)}`} className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline"><Compass size={14} />See the route</Link>
        <Link href="/goal" className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline"><Gauge size={14} />Set it as my goal</Link>
      </div>
    </li>
  );
}

function Family({ f, open, myRole }: { f: FamilyFit; open: boolean; myRole: string }) {
  const t = trust(f.coverage);
  return (
    <details open={open} className="card group p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">{f.family}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.cls}`}>{t.label}</span>
        <span className="ml-auto text-sm font-semibold">{pct(f.fit)}</span>
        <div className="basis-full"><Bar value={f.fit} /></div>
      </summary>
      <ul className="mt-3 space-y-3">{f.roles.slice(0, 4).map((r) => <RoleCard key={r.role} r={r} mine={r.role === myRole} />)}</ul>
      {f.untested.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-600">To sharpen this, find your level in an area you have not tried (about a minute each):</p>
          <div className="flex flex-wrap gap-2">
            {f.untested.map((a) => <form key={a.slug} action={checkMyLevel.bind(null, a.trackId)}><button className="btn btn-ghost text-sm">{a.name}</button></form>)}
          </div>
        </div>
      )}
    </details>
  );
}

export default async function CareerDoctor() {
  const user = await requireUser();
  const d = diagnose(user);
  const mine = user.jobRole.trim().toLowerCase();
  const known = d.families.filter((f) => f.coverage > 0);
  const best = known[0], top = known.flatMap((f) => f.roles).filter((r) => r.coverage > 0).sort((a, b) => b.fit - a.fit || b.coverage - a.coverage).slice(0, 3);
  const thin = d.testedAreas < 4;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Stethoscope} tone="violet" title="Career doctor" sub="Not sure what you would be best at? We read what you have already shown in coding, management, marketing, sales and more, and point to where it fits." />

      {!best ? (
        <EmptyState Icon={Stethoscope} title="No results to read yet" tone="violet">
          <p className="text-sm text-slate-600">Take a placement check in two or three different areas and come back. Each one takes a few minutes.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {d.families.slice(0, 8).flatMap((f) => f.untested.slice(0, 1).map((a) => <form key={a.slug} action={checkMyLevel.bind(null, a.trackId)}><button className="btn btn-ghost text-sm" title={f.family}>{a.name}</button></form>))}
          </div>
          <Link href="/start" className="mt-3 inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline">Or pick any topic <ArrowRight size={14} /></Link>
        </EmptyState>
      ) : (
        <>
          <section className="card space-y-2 p-5" aria-label="Diagnosis">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your results point to</p>
            <h2 className="text-2xl font-extrabold">{best.family}</h2>
            <p className="text-sm text-slate-700">
              {top.length ? <>Closest roles: {top.map((r) => `${r.name} (${pct(r.fit)})`).join(", ")}. </> : null}
              Based on {d.testedAreas} of {d.totalAreas} areas you have tried.
              {thin && <> That is not much yet, so treat this as a first guess: the more areas you try, the sharper it gets.</>}
            </p>
          </section>

          <section className="space-y-3" aria-label="Fields ranked">
            <h2 className="text-lg font-bold">Every field, strongest first</h2>
            {d.families.map((f, i) => <Family key={f.family} f={f} open={i < 2 && f.coverage > 0} myRole={mine} />)}
          </section>
        </>
      )}
      {rolesWithLadders().length === 0 && <p className="text-sm text-slate-500">No career ladders are set up yet.</p>}
      <p className="text-xs text-slate-500">Fit counts placement results as well as passed exams, because it shows where you are likely to do well. What your exams prove for a role is on <Link href="/goal" className="underline">Goal assessment</Link>.</p>
    </div>
  );
}
