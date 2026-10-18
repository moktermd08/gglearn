import Link from "next/link";
import { Building2, Info, Users } from "lucide-react";
import { membershipOf } from "@/lib/membership";
import { scopeLabels, scopeOptions, scopesOf } from "@/lib/paths";

/** What belonging to none, one or several companies means for this person, in plain words. The full card is for the profile; the short note is for pages where it changes what they see. */
export function WhereYouBelong({ userId, variant = "card" }: { userId: number; variant?: "card" | "note" }) {
  const m = membershipOf(userId);
  if (variant === "note") {
    if (m.kind !== "many") return null; // only people in several companies are surprised by the open arena and the default look
    return (
      <p role="note" className="flex items-start gap-2 rounded-xl bg-sky-500/10 p-3 text-sm text-sky-800"><Info size={16} className="mt-0.5 shrink-0" /><span><b>{m.headline}.</b> That is why you race in the open arena and see gglearn&apos;s own look. <Link href="/profile#belong" className="font-semibold underline">What this means</Link></span></p>
    );
  }
  const places = scopeLabels(scopesOf(userId), scopeOptions());
  return (
    <section id="belong" className="card scroll-mt-24 p-5" aria-label="Where you belong">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">{m.kind === "many" ? <Users size={18} className="text-sky-500" /> : <Building2 size={18} className="text-indigo-400" />}Where you belong</h2>
      <p className="font-semibold">{m.headline}</p>
      <p className="mt-1 text-sm text-slate-400">{m.body}</p>
      {places.length > 0 && <p className="mt-2 text-xs text-slate-400">Set by whoever runs your team: <span className="text-slate-300">{places.join(", ")}</span></p>}
    </section>
  );
}
