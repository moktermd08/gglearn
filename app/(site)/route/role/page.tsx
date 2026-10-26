import Link from "next/link";
import { ArrowRight, Compass, Search } from "lucide-react";
import { PageHero } from "@/components/charts";
import { roleRouteSlug, routeRoles, routeRungs } from "@/lib/routeRole";

export const metadata = { title: "Choose a role — gglearn" };

const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";

/** Step 1: find a role. Step 2: pick the level to aim for. Then the same check and plan as any other route. */
export default async function RoleRoute({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const { q = "", role = "" } = await searchParams;
  const roles = routeRoles();
  const chosen = roles.find((r) => r.role === role) ?? null;
  const term = q.trim().toLowerCase();
  const shown = term ? roles.filter((r) => [r.name, r.family, r.blurb, ...r.aliases].some((x) => x.toLowerCase().includes(term))) : roles;
  const families = [...new Set(shown.map((r) => r.family))].sort();

  if (chosen) {
    const rungs = routeRungs(chosen.role);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero Icon={Compass} tone="emerald" title={chosen.name} sub={chosen.blurb || "Which level do you want to reach?"} />
        <ul className="grid gap-3">
          {rungs.map((r) => (
            <li key={r.level} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="min-w-0 flex-[1_1_16rem]"><b>{r.title}</b>{r.summary && <span className="block text-sm text-slate-400">{r.summary}</span>}</span>
              {r.steps > 0
                ? <Link href={`/route/${roleRouteSlug(chosen.role, r.level)}`} className="btn">Aim for this<ArrowRight size={16} /></Link>
                : <span className="text-xs text-slate-400">Nothing to learn is set for this level yet</span>}
            </li>
          ))}
        </ul>
        <p className="text-sm"><Link href="/route/role" className="underline">Choose a different role</Link></p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Compass} tone="emerald" title="Choose a role" sub="Find the role you want to grow into. You pick the level next, then we check where you stand and plan the way there." />
      <form className="flex gap-2" role="search">
        <label className="sr-only" htmlFor="q">Search roles</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search a role, such as accountant, developer or grade 7" className={input} />
        <button className="btn"><Search size={16} aria-hidden />Search</button>
      </form>
      {!shown.length && <p className="card p-5 text-sm text-slate-400">No role matches that. Try a shorter word, or <Link href="/route/role" className="underline">see them all</Link>.</p>}
      {families.map((f) => (
        <section key={f} className="space-y-2">
          <h2 className="text-lg font-extrabold">{f}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {shown.filter((r) => r.family === f).map((r) => (
              <li key={r.role}>
                <Link href={`/route/role?role=${encodeURIComponent(r.role)}`} className="card block p-3 hover:border-black/30">
                  <b>{r.name}</b>{r.blurb && <span className="block text-xs text-slate-400">{r.blurb}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
