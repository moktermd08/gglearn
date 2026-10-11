import { PageHero } from "@/components/charts";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db, questions } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { updateTrackPolicy } from "@/app/actions";
import { catalog } from "@/lib/paths";
import { MAX_LEVEL } from "@/lib/levels";
import { Save, Route } from "lucide-react";

export const metadata = { title: "What is required — gglearn" };

export default async function Paths() {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const cat = catalog();
  const waiting = new Map(db.select({ id: questions.trackId, n: sql<number>`count(*)` }).from(questions).where(eq(questions.status, "review")).groupBy(questions.trackId).all().map((r) => [r.id, r.n]));
  const byBrand = new Map<string, typeof cat>();
  for (const t of cat) byBrand.set(t.brand.name, [...(byBrand.get(t.brand.name) ?? []), t]);
  const groups = [...byBrand].map(([name, list]) => ({ name, list: list.sort((a, b) => a.name.localeCompare(b.name)), kind: list[0].brand.kind }))
    .sort((a, b) => Number(a.kind === "shared") - Number(b.kind === "shared") || a.name.localeCompare(b.name));
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

  return (
    <div className="space-y-6">
      <PageHero Icon={Route} title="What is required" sub={<>
          <b>Mandatory</b>: everyone it applies to must pass. <b>Role</b>: required for the job roles listed on the track. <b>Growth</b>: optional, counts toward promotion.
          Saving enrols everyone affected straight away; the deadline runs from the day they are enrolled.
        </>} />
      {groups.map((g) => (
        <details key={g.name} open={g.kind !== "shared"} className="card p-4">
          <summary className="cursor-pointer font-semibold">{g.name} <span className="text-xs font-normal text-slate-500">{g.list.length} tracks{g.kind === "shared" ? " · shared academy" : ""}</span></summary>
          <ul className="mt-3 space-y-2">
            {g.list.map((t) => (
              <li key={t.id}>
                <form action={updateTrackPolicy} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="trackId" value={t.id} />
                  <span className="min-w-48 flex-1 truncate" title={t.slug}>{t.name}
                    <span className="ml-2 text-xs text-slate-500">{t.questions} questions{t.roles && ` · roles: ${t.roles}`}</span>
                    {waiting.get(t.id) ? <Link href={`/admin/review/${t.slug}`} className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">{waiting.get(t.id)} to review</Link> : null}</span>
                  <select name="tier" defaultValue={t.tier} className={input} aria-label="Requirement"><option value="mandatory">Mandatory</option><option value="role">Role</option><option value="growth">Growth</option></select>
                  <select name="audience" defaultValue={t.audience} className={input} aria-label="Audience"><option value="staff">Staff</option><option value="customer">Customers</option><option value="both">Both</option></select>
                  <label className="flex items-center gap-1 text-xs text-slate-400">pass level<input name="requiredLevel" type="number" min={1} max={MAX_LEVEL} defaultValue={t.requiredLevel} className={`${input} w-16`} /></label>
                  <label className="flex items-center gap-1 text-xs text-slate-400">within<input name="dueDays" type="number" min={1} max={365} defaultValue={t.dueDays} className={`${input} w-16`} />days</label>
                  <button className="btn btn-ghost !px-3 !py-1"><Save size={14} />Save</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
