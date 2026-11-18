import Link from "next/link";
import { ArrowRight, Compass, Gauge } from "lucide-react";
import type { Diagnosis, FamilyFit, RoleFit } from "@/lib/careerDoctor";
import { WEEKS, type FamilyMomentum } from "@/lib/careerMomentum";
import { hasOthers, type FamilyOthers, type Others } from "@/lib/careerOthers";
import { checkMyLevel } from "@/app/(site)/doctor/actions";

/**
 * The Career doctor's reading of one person, shared by the person's own page and the read-only view a manager gets of someone they run.
 * `self` shows the person their own reading, with the buttons that act as them (take the taster, find a level, set a goal, a link to all feedback).
 * `manager` is a reference: the same fit, consistency and what others said, in the third person, with nothing to press. What others said is only
 * ever counts (how many people, how often, when), never their words, because exam notes and CV comments are private between the writer and the person.
 */
export type Reader = { kind: "self"; others: Others } | { kind: "manager"; first: string; others: Others };

export const pct = (n: number) => `${Math.round(n * 100)}%`;
/** How far to trust a fit: one tested area out of six says little. */
export const trust = (c: number) => (c >= 0.6 ? { label: "Solid evidence", cls: "bg-emerald-500/15 text-emerald-700" } : c >= 0.3 ? { label: "Some evidence", cls: "bg-amber-500/15 text-amber-700" } : { label: "Early signs", cls: "bg-sky-500/15 text-sky-700" });
const MOM_CLS = { Steady: "bg-emerald-500/15 text-emerald-700", Building: "bg-amber-500/15 text-amber-700", Fading: "bg-slate-500/15 text-slate-600", "Not yet": "bg-black/5 text-slate-500" } as const;
const since = (d: number | null) => (d === null ? "" : d <= 1 ? "today or yesterday" : d < 14 ? `${d} days ago` : `${Math.round(d / 7)} weeks ago`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const when = (sec: number | null) => (sec === null ? "" : new Date(sec * 1000).toLocaleDateString("en-GB", { month: "short", year: "numeric" }));

/** One line on how consistently someone keeps at a field: how many of the recent weeks they were active, how well they scored, when they last did anything. */
export function momentumLine(m: FamilyMomentum) {
  if (m.label === "Not yet") return "No practice recorded here yet.";
  if (m.label === "Fading") return `Nothing in the last ${WEEKS} weeks. Last activity ${since(m.daysSince)}.`;
  return `Active in ${m.weeks} of the last ${WEEKS} weeks${m.reliability !== null ? `, scoring ${pct(m.reliability)} on average` : ""}${m.gained > 0 ? `, ${m.gained} new ${m.gained === 1 ? "level" : "levels"} in one area` : ""}. Last activity ${since(m.daysSince)}.`;
}

/** What other people said or decided in this field, in words, or null when there is nothing (so a quiet field says nothing rather than something sad). */
function othersLine(o: FamilyOthers, self: boolean) {
  const parts: string[] = [];
  if (o.notes > 0) parts.push(`${plural(o.people, "reviewer")} praised ${self ? "your" : "their"} answers in this field (${plural(o.notes, "note")} over ${plural(o.periods, "month")}, latest ${when(o.lastPraiseAt)})`);
  if (o.promotions > 0) parts.push(`a manager promoted ${self ? "you" : "them"} into ${plural(o.promotions, "role")} here (latest ${when(o.lastPromotionAt)})`);
  return parts.length ? `${parts.join("; ")}.` : null;
}

/** What belongs to the person and not to one field: references a manager or mentor wrote and they approved, and praise on their CV. */
function generalLine(o: Others, self: boolean) {
  const refs = o.references.manager + o.references.mentor, parts: string[] = [], their = self ? "your" : "their";
  if (refs > 0) parts.push(`${plural(refs, "reference")} on ${their} CV (${[o.references.manager && `${o.references.manager} from a manager`, o.references.mentor && `${o.references.mentor} from a mentor`].filter(Boolean).join(", ")})`);
  if (o.cvPraise.comments > 0) parts.push(`${plural(o.cvPraise.people, "reviewer")} praised ${their} CV`);
  return parts.length ? `${parts.join("; ")}.` : null;
}

function Bar({ value }: { value: number }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-black/10" role="img" aria-label={pct(value)}><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: pct(value) }} /></div>;
}

function RoleCard({ r, mine, reader }: { r: RoleFit; mine: boolean; reader: Reader }) {
  const t = trust(r.coverage), strong = r.areas.filter((a) => a.have >= a.need), weak = r.areas.filter((a) => a.tested && a.have < a.need), blank = r.areas.filter((a) => !a.tested);
  return (
    <li className="card space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{r.name}</h3>
        {mine && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{reader.kind === "self" ? "your role now" : "their role now"}</span>}
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
      {reader.kind === "self" && (
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          <Link href={`/route/role?role=${encodeURIComponent(r.role)}`} className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline"><Compass size={14} />See the route</Link>
          <Link href={`/goal?role=${encodeURIComponent(r.role)}`} className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline"><Gauge size={14} />Set it as my goal</Link>
        </div>
      )}
    </li>
  );
}

function Family({ f, open, myRole, m, reader, o }: { f: FamilyFit; open: boolean; myRole: string; m: FamilyMomentum; reader: Reader; o?: FamilyOthers }) {
  const t = trust(f.coverage), self = reader.kind === "self";
  return (
    <details open={open} className="card group p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">{f.family}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.cls}`}>{t.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${MOM_CLS[m.label]}`} title={`How consistently ${self ? "you keep" : "they keep"} at this field`}>{m.label === "Not yet" ? "No practice yet" : m.label}</span>
        <span className="ml-auto text-sm font-semibold">{pct(f.fit)}</span>
        <div className="basis-full"><Bar value={f.fit} /></div>
      </summary>
      <p className="mt-3 text-sm text-slate-700"><b>Consistency:</b> {momentumLine(m)}</p>
      {o && hasOthers(o) && <p className="mt-1 text-sm text-slate-700"><b>Others say:</b> {othersLine(o, self)}</p>}
      <ul className="mt-3 space-y-3">{f.roles.slice(0, 4).map((r) => <RoleCard key={r.role} r={r} mine={r.role === myRole} reader={reader} />)}</ul>
      {self && f.untested.length > 0 && (
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

/** The diagnosis, where the person keeps showing up, and every field ranked. The caller supplies the page around it. */
export function DoctorReading({ d, mom, jobRole, reader }: { d: Diagnosis; mom: Map<string, FamilyMomentum>; jobRole: string; reader: Reader }) {
  const self = reader.kind === "self", others = reader.others;
  const who = self ? "you" : reader.kind === "manager" ? reader.first : "they";
  const mine = jobRole.trim().toLowerCase();
  const known = d.families.filter((f) => f.coverage > 0);
  const best = known[0], top = known.flatMap((f) => f.roles).filter((r) => r.coverage > 0).sort((a, b) => b.fit - a.fit || b.coverage - a.coverage).slice(0, 3);
  const thin = d.testedAreas < 4;
  const general = generalLine(others, self);
  const steady = d.families.map((f) => ({ f, m: mom.get(f.family)! })).filter((x) => x.m.label === "Steady" || x.m.label === "Building").sort((a, b) => b.m.score - a.m.score).slice(0, 3);

  if (!best) return null;
  return (
    <>
      <section className="card space-y-2 p-5" aria-label="Diagnosis">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{self ? "Your results point to" : `${who}'s results point to`}</p>
        <h2 className="text-2xl font-extrabold">{best.family}</h2>
        <p className="text-sm text-slate-700">
          {top.length ? <>Closest roles: {top.map((r) => `${r.name} (${pct(r.fit)})`).join(", ")}. </> : null}
          Based on {d.testedAreas} of {d.totalAreas} areas {self ? "you have" : "they have"} tried.
          {thin && (self ? <> That is not much yet, so treat this as a first guess: the more areas you try, the sharper it gets.</> : <> That is not much yet, so treat this as a first guess, not a judgement.</>)}
        </p>
        {self && <Link href="/doctor/taster" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">Sharpen it with the career taster <ArrowRight size={14} /></Link>}
      </section>

      <section className="card space-y-2 p-5" aria-label={self ? "Where you keep showing up" : "Where they keep showing up"}>
        <h2 className="text-lg font-bold">{self ? "Where you keep showing up" : "Where they keep showing up"}</h2>
        {steady.length ? (
          <ul className="space-y-1 text-sm text-slate-700">
            {steady.map(({ f, m }) => <li key={f.family}><b>{f.family}</b> <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${MOM_CLS[m.label]}`}>{m.label}</span> {momentumLine(m)}</li>)}
          </ul>
        ) : <p className="text-sm text-slate-600">{self ? "Nothing recent yet. A field shows up here once you have practised or sat an exam in it over a few different weeks." : "Nothing recent yet. A field shows up here once they have practised or sat an exam in it over a few different weeks."}</p>}
        {general && <p className="text-sm text-slate-700"><b>Others say:</b> {general}{self && <> <Link href="/feedback" className="font-semibold text-indigo-700 hover:underline">See all feedback</Link></>}</p>}
        <p className="text-xs text-slate-500">
          {self
            ? "Consistency is about habit: how often you practise and how well your results hold. What others say is kept apart because it is their view, not a score. Neither measures the value you add at work, and a field with nothing said is simply untouched, not weak."
            : "Consistency is about habit: how often they practise and how well their results hold. What others say is only counted here, never quoted, because notes and comments are private between the writer and the person; it is kept apart because it is their view, not a score. Neither measures the value they add at work, and a field with nothing said is simply untouched, not weak."}
        </p>
      </section>

      <section className="space-y-3" aria-label="Fields ranked">
        <h2 className="text-lg font-bold">Every field, strongest first</h2>
        {d.families.map((f, i) => <Family key={f.family} f={f} open={i < 2 && f.coverage > 0} myRole={mine} m={mom.get(f.family)!} reader={reader} o={others.byFamily.get(f.family)} />)}
      </section>
    </>
  );
}

/** True when there is anything to read yet. */
export const hasReading = (d: Diagnosis) => d.families.some((f) => f.coverage > 0);
