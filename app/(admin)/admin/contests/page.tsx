import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe, Link2Off, Lock, Trophy } from "lucide-react";
import { PageHero } from "@/components/charts";
import { ConfirmForm } from "@/components/ConfirmForm";
import { requireManager } from "@/lib/auth";
import { contestsInReach, isOwner } from "@/lib/contestAdmin";
import { scopeLabels, scopeOptions, scopesOf } from "@/lib/paths";
import { topicLabel } from "@/lib/topicName";
import { cancelCompetition, switchOffLinkAsAdmin } from "@/app/(site)/competitions/actions";

export const metadata = { title: "Contests — gglearn" };

const STATES = ["live", "upcoming", "finished", "canceled"] as const;
const PAGE = 50;
const CHIP = { live: "bg-emerald-500/15 text-emerald-300", upcoming: "bg-sky-500/15 text-sky-300", finished: "bg-slate-500/15 text-slate-500", canceled: "bg-rose-500/15 text-rose-300" } as const;

export default async function Contests({ searchParams }: { searchParams: Promise<{ state?: string; campaigns?: string; page?: string }> }) {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance"); // moderating contests is an admin's job
  const q = await searchParams, owner = isOwner(me);
  const state = STATES.find((s) => s === q.state), campaigns = owner && q.campaigns === "1", page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const { rows, total } = contestsInReach(me, { state, campaigns, limit: PAGE, offset: (page - 1) * PAGE });
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const scope = owner ? "everyone on the site" : scopeLabels(scopesOf(me.id), scopeOptions()).join(", ");
  const href = (over: Record<string, string | undefined>) => { const p = new URLSearchParams(Object.entries({ state: q.state, campaigns: q.campaigns, ...over }).filter(([, v]) => v) as [string, string][]); return `/admin/contests${p.size ? `?${p}` : ""}`; };
  return (
    <div className="space-y-6">
      <PageHero Icon={Trophy} tone="amber" title="Contests" sub={`The contests run by ${scope}. You can cancel one, or switch off its invite link. Anything else stays with whoever organised it.`} />
      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filter">
        <Link href={href({ state: undefined, page: undefined })} className={`rounded-full px-3 py-1 font-semibold ${!state ? "bg-indigo-500 text-[#fff]" : "bg-black/5"}`}>All</Link>
        {STATES.map((s) => <Link key={s} href={href({ state: s, page: undefined })} className={`rounded-full px-3 py-1 font-semibold capitalize ${state === s ? "bg-indigo-500 text-[#fff]" : "bg-black/5"}`}>{s === "canceled" ? "Cancelled" : s}</Link>)}
        {owner && <Link href={href({ campaigns: campaigns ? undefined : "1", page: undefined })} className={`ml-auto rounded-full px-3 py-1 font-semibold ${campaigns ? "bg-violet-500 text-[#fff]" : "bg-black/5"}`}>{campaigns ? "Hide" : "Show"} public campaign rounds</Link>}
        <span className="text-slate-400 sm:ml-2">{total} contest{total === 1 ? "" : "s"}</span>
      </div>
      {rows.length === 0 ? <p className="card p-8 text-center text-slate-400">No contests to show{owner ? "" : " for the people you run"}.</p> : (
        <ul className="card divide-y divide-black/5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
              <span className="min-w-0 flex-1 basis-60"><Link href={`/competitions/${r.slug}`} className="block truncate font-bold hover:underline">{r.title}</Link>
                <span className="text-xs text-slate-400">{topicLabel(r.topic)} · run by {r.campaign ? "the platform" : r.organiser}</span></span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${CHIP[r.state as keyof typeof CHIP]}`}>{r.state === "canceled" ? "cancelled" : r.state}</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">{r.visibility === "public" ? <><Globe size={12} />Public</> : <><Lock size={12} />Private</>}</span>
              <span className="text-xs text-slate-400">{r.humans} {r.humans === 1 ? "person" : "people"}{r.bots > 0 ? `, ${r.bots} simulated` : ""}</span>
              <span className="flex items-center gap-3">
                {r.linkOn && r.state !== "finished" && r.state !== "canceled" && <ConfirmForm action={switchOffLinkAsAdmin.bind(null, r.id)} message="Switch off this contest's invite link? People who have not used it yet will not be able to."><button className="inline-flex items-center gap-1 text-xs text-slate-500 underline"><Link2Off size={12} />Switch off link</button></ConfirmForm>}
                {(r.state === "live" || r.state === "upcoming") && <ConfirmForm action={cancelCompetition.bind(null, r.id)} message={`Cancel "${r.title}" for everyone in it? This cannot be undone.`}><button className="text-xs font-semibold text-rose-300 underline">Cancel contest</button></ConfirmForm>}
              </span>
            </li>))}
        </ul>
      )}
      {pages > 1 && <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pages">{page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-ghost !py-1">Newer</Link>}<span className="text-slate-400">Page {page} of {pages}</span>{page < pages && <Link href={href({ page: String(page + 1) })} className="btn btn-ghost !py-1">Older</Link>}</nav>}
    </div>
  );
}
