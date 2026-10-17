import { Initials, PageHero } from "@/components/charts";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { blueprintRoles, pillarStance, type Stance } from "@/lib/blueprint";
import { catalog } from "@/lib/paths";
import { roleLabel } from "@/lib/journey";
import { Grid3x3 } from "lucide-react";
import { isGlobal, reachOf } from "@/lib/tenancy";

export const metadata = { title: "Role and pillar matrix — gglearn" };

const DOT: Record<Stance, string> = {
  required: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.18)]",
  recommended: "border-2 border-sky-500 bg-sky-500/10",
  optional: "bg-black/10 !h-1.5 !w-1.5",
};

/** Which pillars each role must pass, is advised to learn, or may skip. Read-only: the data is content/blueprints/pillars.json. */
export default async function Matrix() {
  const me = await requireManager();
  if (me.role !== "admin" || !isGlobal(reachOf(me.id))) redirect("/admin/compliance"); // the role-by-pillar policy is shared by every company
  const cat = catalog();
  const pillars = [...new Set(cat.map((t) => t.pillar).filter((p): p is string => !!p))].sort();
  const ready = (p: string) => cat.filter((t) => t.pillar === p && t.reach >= t.requiredLevel).length;
  const roles = blueprintRoles();

  return (
    <div className="space-y-4">
      <PageHero Icon={Grid3x3} title="Role and pillar matrix" sub={<>Which pillars each role must pass, is advised to learn, or may skip. The number under each pillar is how many of its tracks can be examined today. A track you set by hand on{" "}
          <Link href="/admin/paths" className="underline">What is required</Link> is left alone. Edit <code>content/blueprints/pillars.json</code>.</>} />
      <ul className="flex flex-wrap gap-4 text-sm text-slate-300" aria-label="Legend">
        <li className="flex items-center gap-2"><i className={`inline-block h-3 w-3 rounded-full ${DOT.required}`} /><b>Required</b> becomes mandatory learning for the role</li>
        <li className="flex items-center gap-2"><i className={`inline-block h-3 w-3 rounded-full ${DOT.recommended}`} /><b>Recommended</b> shapes a new joiner&apos;s starter plan</li>
        <li className="flex items-center gap-2"><i className={`inline-block h-1.5 w-1.5 rounded-full ${DOT.optional.split(" ")[0]}`} />Optional</li>
      </ul>
      <div className="card relative overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="sticky left-0 bg-[#fff] py-1 pr-3">Role</th>
              {pillars.map((p) => (
                <th key={p} className="px-1 text-center font-normal"><div className="[writing-mode:vertical-rl] rotate-180">{p}</div><div className="mt-1 text-slate-500">{ready(p)}</div></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r} className="border-t border-black/5 transition hover:bg-indigo-500/5">
                <td className="sticky left-0 whitespace-nowrap bg-[#fff] py-1 pr-3 font-medium"><span className="inline-flex items-center gap-2"><Initials name={roleLabel(r)} size={22} />{roleLabel(r)}</span></td>
                {pillars.map((p) => {
                  const s = pillarStance(r, p);
                  return <td key={p} className="px-1 py-1.5 text-center" title={`${roleLabel(r)} · ${p}: ${s}`}><i className={`inline-block h-3 w-3 rounded-full align-middle ${DOT[s]}`}><span className="sr-only">{s}</span></i></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
