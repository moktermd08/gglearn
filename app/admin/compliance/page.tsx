import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { catalog, complianceReport, requirementsFor, scopeLabels, scopeOptions } from "@/lib/paths";
import { AlertTriangle, CheckCircle2, Clock, FileQuestion, ShieldCheck, UserX } from "lucide-react";

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
  const rows = complianceReport();
  const options = scopeOptions();
  const cat = catalog();
  const count = (s: keyof typeof STATE) => rows.filter((r) => r.state === s).length;
  // required by policy but with no questions yet: nobody can be held to it
  const empty = cat.filter((t) => (t.tier === "mandatory" || t.tier === "role") && t.reach < t.requiredLevel);
  const tiles = [
    { Icon: CheckCircle2, label: "Up to date", value: count("ok"), cls: "text-emerald-300" },
    { Icon: Clock, label: "In progress", value: count("due"), cls: "text-sky-300" },
    { Icon: AlertTriangle, label: "Overdue", value: count("overdue"), cls: "text-rose-300" },
    { Icon: UserX, label: "Not assigned", value: count("no-scope"), cls: "text-amber-300" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="text-emerald-300" />Who is up to date</h1>
        {me.role === "admin" && <Link href="/admin/paths" className="btn btn-ghost !py-1 text-sm">Set what is required</Link>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label, value, cls }, i) => (
          <div key={label} className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
            <Icon size={22} className={`mx-auto ${cls}`} />
            <div className="mt-1 text-2xl font-extrabold">{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <ul className="space-y-3">
        {rows.map((r, i) => {
          const st = STATE[r.state];
          const open = r.state === "overdue" || r.state === "due" ? requirementsFor(r.person, r.scopes, cat).filter((q) => !q.done) : [];
          const labels = scopeLabels(r.scopes, options);
          return (
            <li key={r.person.id} className="card rise p-4" style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">{r.person.name}
                    {r.person.audience === "customer" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">customer</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">{r.person.jobRole} · {labels.length ? labels.join(" · ") : "no company, brand or project"}</div>
                </div>
                {r.required > 0 && (
                  <div className="w-40 text-right text-xs text-slate-400">
                    {r.done}/{r.required} required passed
                    <div className="bar !h-1.5 mt-1"><i style={{ width: `${(r.done / r.required) * 100}%`, background: r.done === r.required ? "#34d399" : r.overdue ? "#fb7185" : undefined }} /></div>
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
