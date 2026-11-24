import Link from "next/link";

const TABS = [{ key: "cv", href: "/profile/cv", label: "Your CV" }, { key: "behaviours", href: "/profile/behaviours", label: "Behaviour stories" }] as const;

/** The two documents that go with an application, side by side, so a person moves between them without going back to the profile. */
export function CareerTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Career documents" className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
      {TABS.map((t) => t.key === current
        ? <span key={t.key} aria-current="page" className="flex-1 rounded-lg bg-[#fff] px-3 py-1.5 text-center text-slate-900 shadow-sm sm:flex-none">{t.label}</span>
        : <Link key={t.key} href={t.href} className="flex-1 rounded-lg px-3 py-1.5 text-center text-slate-600 hover:bg-[#fff]/70 sm:flex-none">{t.label}</Link>)}
    </nav>
  );
}
