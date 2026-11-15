import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Where you are, and a way back up each level. The last item is the page itself. */
export function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-slate-500">
        {trail.map((t, i) => (
          <li key={t.label} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={14} aria-hidden className="shrink-0 text-slate-300" />}
            {t.href && i < trail.length - 1
              ? <Link href={t.href} className="rounded px-0.5 font-medium text-sky-800 hover:underline">{t.label}</Link>
              : <span aria-current="page" className="truncate font-semibold text-slate-700">{t.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
