import { redirect } from "next/navigation";
import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { blueprintRoles, pillarStance, type Stance } from "@/lib/blueprint";
import { catalog } from "@/lib/paths";
import { roleLabel } from "@/lib/journey";
import { Grid3x3 } from "lucide-react";

export const metadata = { title: "Role and pillar matrix — gglearn" };

const CELL: Record<Stance, { mark: string; cls: string }> = {
  required: { mark: "●", cls: "text-emerald-300" },
  recommended: { mark: "○", cls: "text-sky-300" },
  optional: { mark: "·", cls: "text-slate-600" },
};

/** Which pillars each role must pass, is advised to learn, or may skip. Read-only: the data is content/blueprints/pillars.json. */
export default async function Matrix() {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const cat = catalog();
  const pillars = [...new Set(cat.map((t) => t.pillar).filter((p): p is string => !!p))].sort();
  const ready = (p: string) => cat.filter((t) => t.pillar === p && t.reach >= t.requiredLevel).length;
  const roles = blueprintRoles();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Grid3x3 className="text-indigo-300" />Role and pillar matrix</h1>
        <p className="mt-1 text-sm text-slate-400">
          <span className={CELL.required.cls}>● required</span> becomes mandatory learning for that role (only for tracks with enough questions; a track you set by hand on{" "}
          <Link href="/admin/paths" className="underline">What is required</Link> is left alone). <span className={CELL.recommended.cls}>○ recommended</span> shapes a new joiner&apos;s starter plan.
          The number under each pillar is how many of its tracks can be examined today. Edit <code>content/blueprints/pillars.json</code>.
        </p>
      </div>
      <div className="card overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="sticky left-0 bg-white py-1 pr-3">Role</th>
              {pillars.map((p) => (
                <th key={p} className="px-1 text-center font-normal"><div className="[writing-mode:vertical-rl] rotate-180">{p}</div><div className="mt-1 text-slate-500">{ready(p)}</div></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r} className="border-t border-white/5">
                <td className="sticky left-0 whitespace-nowrap bg-white py-1 pr-3">{roleLabel(r)}</td>
                {pillars.map((p) => {
                  const s = pillarStance(r, p);
                  return <td key={p} className={`px-1 text-center ${CELL[s].cls}`} title={`${roleLabel(r)} · ${p}: ${s}`}>{CELL[s].mark}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
