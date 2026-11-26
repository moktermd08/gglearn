import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Gauge, type LucideIcon } from "lucide-react";
import { roleList } from "@/lib/termStudy";
import { termsAvailable } from "@/lib/terms";
import { termUrl } from "@/lib/termUrls";
import { slugify } from "@/lib/urlText";
import { routeRungs } from "@/lib/routeRole";

/** From a career page to everything else about the same job: its words, a check and plan for it, and the gap against it. */
export function ConnectedWith({ role, level, aiming }: { role: string; level: number; aiming: boolean }) {
  const list = termsAvailable() ? roleList(role, level) : null;
  const links: { href: string; Icon: LucideIcon; title: string; text: string }[] = [
    ...(list ? [{ href: termUrl("role", role, level), Icon: BookOpen, title: "The words you need", text: `${list.terms.length} terms for ${list.title}: study them and test yourself.` }] : []),
    ...(routeRungs(role).length ? [{ href: `/route/role/${slugify(role)}`, Icon: Compass, title: "Check and plan", text: "Answer a short check and get a dated plan for a level of this job." }] : []),
    ...(aiming ? [{ href: "/goal", Icon: Gauge, title: "Your gap to the goal", text: "What you have proved, what is left and what to do first." }] : []),
  ];
  if (!links.length) return null;
  return (
    <section className="space-y-2" aria-labelledby="connected">
      <h2 id="connected" className="text-lg font-extrabold">{aiming ? "Everything for your goal" : "Everything for your job"}</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {links.map(({ href, Icon, title, text }) => (
          <li key={href}><Link href={href} className="card card-hover flex h-full flex-col gap-2 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-300" aria-hidden><Icon size={20} /></span>
            <b className="text-sm">{title}</b><span className="text-xs text-slate-400">{text}</span>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-indigo-300">Open<ArrowRight size={13} aria-hidden /></span>
          </Link></li>
        ))}
      </ul>
    </section>
  );
}
