import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { pendingFor } from "@/lib/freshness";
import { acknowledgeChange } from "@/app/actions";
import { BellRing, CheckCircle2 } from "lucide-react";

export const metadata = { title: "What changed — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function Updates() {
  const user = await requireUser();
  const pending = pendingFor(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BellRing className="text-amber-300" />What changed</h1>
        <p className="mt-1 text-sm text-slate-400">Company knowledge you have studied has been updated. Read each change, then confirm so your team knows you are current.</p>
      </div>
      {pending.length === 0 && (
        <div className="card flex items-center gap-3 p-6 text-emerald-300"><CheckCircle2 />You are up to date. Nothing new to read.</div>
      )}
      {pending.map(({ change, track, dueAt, overdue }) => (
        <section key={change.id} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{change.title}</h2>
            <Link href={`/tracks/${track.slug}`} className="text-xs text-slate-400 underline">{track.name}</Link>
            <span className={`ml-auto text-xs ${overdue ? "text-rose-300" : "text-slate-400"}`}>changed {date(change.createdAt)} · read by {date(dueAt)}{overdue && " · overdue"}</span>
          </div>
          {change.note && <p className="rounded bg-amber-500/10 px-3 py-2 text-sm text-amber-200"><b>What changed:</b> {change.note}</p>}
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">Now</div>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{change.after}</p>
          </div>
          {change.before && (
            <details>
              <summary className="cursor-pointer text-xs uppercase tracking-wider text-slate-500">Before (no longer correct)</summary>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500 line-through decoration-slate-600">{change.before}</p>
            </details>
          )}
          <form action={acknowledgeChange.bind(null, change.id)}>
            <button className="btn"><CheckCircle2 size={16} />I have read this</button>
          </form>
        </section>
      ))}
    </div>
  );
}
