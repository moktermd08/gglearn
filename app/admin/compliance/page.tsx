import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { pendingCounts } from "@/lib/freshness";
import { coverageFor, hasNoRolePath } from "@/lib/roles";
import { catalog, complianceReport, requirementsFor, scopeLabels, scopeOptions } from "@/lib/paths";
import { Donut, EmptyState, Initials, PageHero, PALETTE } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { AlertTriangle, CheckCircle2, Clock, FileQuestion, ShieldCheck, UserX } from "lucide-react";
import { limitOptions, reachOf, trackInReach, usersInReach } from "@/lib/tenancy";

export const metadata = { title: "Who is up to date — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATE = {
  ok: { label: "Up to date", cls: "bg-emerald-500/20 text-emerald-300" },
  due: { label: "In progress", cls: "bg-sky-500/20 text-sky-300" },
  overdue: { label: "Overdue", cls: "bg-rose-500/20 text-rose-300" },
  none: { label: "Nothing required", cls: "bg-white/10 text-slate-300" },
  "no-scope": { label: "Not assigned", cls: "bg-amber-500/20 text-amber-300" },
} as const;

export default async function Compliance() {
  const me = await requireManager();
  const reach = reachOf(me.id), mine = usersInReach(reach);
  const rows = complianceReport().filter((r) => !mine || mine.has(r.person.id));
  const options = limitOptions(scopeOptions(), reach);
  const cat = catalog().filter((t) => trackInReach(reach, t));
  const behind = pendingCounts();
  const count = (s: keyof typeof STATE) => rows.filter((r) => r.state === s).length;
  // required by policy but with no questions yet: nobody can be held to it
  const empty = cat.filter((t) => (t.tier === "mandatory" || t.tier === "role") && t.reach < t.requiredLevel);

  return (
    <div className="space-y-8">
      <PageHero Icon={ShieldCheck} tone="emerald" title="Who is up to date" sub="Required learning for every person, against its deadline.">
        {me.role === "admin" && <Link href="/admin/setup" className="btn btn-ghost !py-1 text-sm">Set up companies and tracks</Link>}
        {me.role === "admin" && <Link href="/admin/paths" className="btn btn-ghost !py-1 text-sm">Set what is required</Link>}
        {me.role === "admin" && <Link href="/admin/matrix" className="btn btn-ghost !py-1 text-sm">Role and pillar matrix</Link>}
      </PageHero>
      <section className="card grid items-center gap-6 p-5 md:grid-cols-[auto_1fr]">
        <Donut size={150} sub="people" center={rows.length} parts={[
          { label: "Up to date", value: count("ok"), color: PALETTE.emerald },
          { label: "In progress", value: count("due"), color: PALETTE.sky },
          { label: "Overdue", value: count("overdue"), color: PALETTE.rose },
          { label: "Not assigned", value: count("no-scope"), color: PALETTE.amber },
          { label: "Nothing required", value: count("none"), color: PALETTE.slate },
        ]} />
        <div className="space-y-2" aria-label="Needs attention">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Needs attention</h2>
          {count("overdue") + count("no-scope") + empty.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300"><CheckCircle2 size={16} />Nobody is overdue and everyone has a path.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {count("overdue") > 0 && <li className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 p-2.5 text-rose-300"><AlertTriangle size={16} className="shrink-0" /><span><b>{count("overdue")}</b> {count("overdue") === 1 ? "person is" : "people are"} overdue</span></li>}
              {count("no-scope") > 0 && <li className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 p-2.5 text-amber-300"><UserX size={16} className="shrink-0" /><span><b>{count("no-scope")}</b> not assigned to a company, brand or project. <Link href="/admin/people" className="underline">Assign them</Link></span></li>}
              {empty.length > 0 && <li className="flex items-center gap-2.5 rounded-xl bg-sky-500/10 p-2.5 text-sky-300"><FileQuestion size={16} className="shrink-0" /><span><b>{empty.length}</b> required {empty.length === 1 ? "subject has" : "subjects have"} too few questions to examine yet</span></li>}
            </ul>
          )}
        </div>
      </section>

      <ul className="space-y-3">
        {rows.map((r, i) => {
          const st = STATE[r.state];
          const open = r.state === "overdue" || r.state === "due" ? requirementsFor(r.person, r.scopes, cat).filter((q) => !q.done) : [];
          const labels = scopeLabels(r.scopes, options);
          return (
            <li key={r.person.id} className={`card rise border-l-4 p-4 ${r.state === "overdue" ? "!border-l-rose-400" : r.state === "ok" ? "!border-l-emerald-400" : r.state === "due" ? "!border-l-sky-400" : r.state === "no-scope" ? "!border-l-amber-400" : "!border-l-slate-300"}`} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
              <div className="flex flex-wrap items-center gap-3">
                <Initials name={r.person.name} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">{r.person.name}
                    {r.person.audience === "customer" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">customer</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                    {r.person.audience === "staff" && hasNoRolePath(coverageFor(r.person.jobRole, cat)) && <Link href="/admin/people" title={`Nothing is set up for the role "${r.person.jobRole}". Change their role or add learning for it.`} className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">no role learning</Link>}
                    {behind.get(r.person.id) ? <Link href="/admin/freshness" className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">{behind.get(r.person.id)} update{behind.get(r.person.id) === 1 ? "" : "s"} unread</Link> : null}
                  </div>
                  <div className="truncate text-xs text-slate-500">{r.person.jobRole} · {labels.length ? labels.join(" · ") : "no company, brand or project"}</div>
                </div>
                {r.required > 0 && (
                  <div className="flex items-center gap-2.5 text-right text-xs text-slate-400">
                    <span>{r.done}/{r.required}<br />required passed</span>
                    <Ring pct={r.done / r.required} label={`${Math.round((r.done / r.required) * 100)}%`} size={56} color={r.done === r.required ? "#34d399" : r.overdue ? "#fb7185" : "#6366f1"} />
                  </div>
                )}
              </div>
              {r.state === "no-scope" && <p className="mt-2 text-sm text-amber-300">Assign them on <Link href="/admin/people" className="underline">People</Link> so they get the right path.</p>}
              {open.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {open.map((q) => (
                    <li key={q.track.id} className="flex flex-wrap items-center gap-2">
                      <span className={q.overdue ? "text-rose-300" : "text-slate-300"}>{q.track.name}</span>
                      <span className="text-xs text-slate-500">level {q.passed}/{q.track.requiredLevel} · due {date(q.dueAt)}{q.overdue && " · overdue"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {empty.length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="flex items-center gap-2 font-semibold"><FileQuestion size={18} className="text-amber-300" />Required, but not enough questions yet</h2>
          <p className="text-sm text-slate-400">These are set as required, but nobody can be held to them until exam questions reach the pass level. They are not counted above.</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {empty.map((t) => <li key={t.id} className="text-slate-300">{t.name} <span className="text-xs text-slate-500">({t.audience === "customer" ? "customers" : "staff"} · {t.tier} · questions reach level {t.reach} of {t.requiredLevel})</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
