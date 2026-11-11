import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Compass, Gauge, ListChecks, Stethoscope, Target } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { loadRoles } from "@/lib/lifecycle/roles";

const description = "Not sure what you would be best at? The Career doctor reads what you already know in coding, management, marketing, sales, finance and more, and shows which fields and roles fit you, with what to do next.";
export const metadata: Metadata = { title: "Career doctor: find the field you fit — gglearn", description, openGraph: { title: "Career doctor on gglearn", description, type: "website" } };

const STEPS = [
  { Icon: ListChecks, title: "Show what you know", text: "Take the career taster: one area from each of six fields, three questions each, about three minutes. Or find your level in any single topic. Anything you have already passed on gglearn counts too." },
  { Icon: Stethoscope, title: "Get a reading", text: "Every field is ranked by how well your results fit the roles in it, with the closest roles named and what you already have, what is growing and what you have not tried yet." },
  { Icon: Target, title: "Pick a direction", text: "Choose a role and see the route to it, or set it as your goal and measure yourself against it, with the gaps and where to start." },
];

const FAQ = [
  { q: "Is this a personality test?", a: "No. It reads what you can do, from real questions and exams, not how you describe yourself. It cannot tell you what you will enjoy, only where your results already match what a role asks for." },
  { q: "How accurate is it?", a: "It says how much evidence a result rests on: Early signs, Some evidence or Solid evidence. A field you have barely tried shows as early signs, so treat that as a first guess and try more areas to sharpen it." },
  { q: "What if I miss a field in the taster?", a: "Nothing is held against you. Three questions is a small sample, so a miss simply leaves that field untried. You can find your level in it properly at any time." },
  { q: "Does it replace a real career conversation?", a: "No. It is a starting point, and the roles it names are the ones on gglearn's career ladders. Use it to decide what to look into, then talk to people who do the job." },
];

/** The fields a reading can point to, with how many roles each holds, straight from the career ladders. */
function fields() {
  const by = new Map<string, string[]>();
  for (const r of loadRoles()) by.set(r.family, [...(by.get(r.family) ?? []), r.name]);
  return [...by.entries()].filter(([f]) => f !== "Other").map(([family, names]) => ({ family, n: names.length, names })).sort((a, b) => b.n - a.n || a.family.localeCompare(b.family));
}

export default async function CareerDoctorInfo() {
  const me = await currentUser();
  const all = fields();
  const start = me ? "/doctor/taster" : `/signup?next=${encodeURIComponent("/doctor/taster")}`;
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <section className="card pop space-y-4 p-6 text-center sm:p-10" style={{ background: "linear-gradient(135deg, rgba(139,92,246,.16), #fff 70%)" }}>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-600"><Stethoscope size={24} /></span>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Not sure what you would be best at?</h1>
        <p className="mx-auto max-w-2xl text-slate-600">The Career doctor reads what you can already do and shows which fields and roles fit you, from coding to management, marketing and sales, then what to do next.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={start} className="btn !px-8 !py-3 text-base">{me ? "Take the career taster" : "Create an account and take the taster"}<ArrowRight size={18} /></Link>
          {me ? <Link href="/doctor" className="font-semibold underline">Open my Career doctor</Link> : <Link href="/login?next=%2Fdoctor" className="font-semibold underline">I have an account</Link>}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-bold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="card space-y-2 p-5">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-600"><Icon size={16} />Step {i + 1}</span>
              <h3 className="font-bold">{title}</h3>
              <p className="text-sm text-slate-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4" aria-labelledby="get">
        <h2 id="get" className="text-2xl font-bold">What you get</h2>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="card space-y-3 p-5" aria-label="Example reading">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example reading (made up, to show the layout)</p>
            <p className="text-sm text-slate-500">Your results point to</p>
            <p className="text-xl font-extrabold">Data &amp; AI</p>
            <ul className="space-y-2 text-sm">
              {[["Data Analyst", 72, "Some evidence"], ["Data Engineer", 55, "Some evidence"], ["BI Analyst", 40, "Early signs"]].map(([role, fit, badge]) => (
                <li key={role as string} className="space-y-1">
                  <span className="flex items-center justify-between"><span className="font-semibold">{role}</span><span>{fit}% fit · <span className="text-slate-500">{badge}</span></span></span>
                  <span className="block h-2 overflow-hidden rounded-full bg-black/10"><span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${fit}%` }} /></span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" /><span><b>Every field, ranked</b> by how well your results fit its roles, strongest first.</span></li>
            <li className="flex gap-3"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" /><span><b>The closest roles</b> in each field, with what you already have, what is growing and what you have not tried.</span></li>
            <li className="flex gap-3"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" /><span><b>An honest evidence label</b> on every result, so a guess is never presented as a fact.</span></li>
            <li className="flex gap-3"><Compass size={18} className="mt-0.5 shrink-0 text-indigo-600" /><span><b>The route to a role</b>: the learning each level asks for, in order.</span></li>
            <li className="flex gap-3"><Gauge size={18} className="mt-0.5 shrink-0 text-indigo-600" /><span><b>A goal you can measure</b>: set a role as your goal and see the gaps and where to start.</span></li>
          </ul>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="fields">
        <h2 id="fields" className="text-2xl font-bold">The fields it covers</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((f) => (
            <li key={f.family} className="card p-4">
              <h3 className="font-bold">{f.family}</h3>
              <p className="text-xs text-slate-500">{f.n} {f.n === 1 ? "role" : "roles"}</p>
              <p className="mt-1 text-sm text-slate-600">{f.names.slice(0, 3).join(", ")}{f.n > 3 ? " and more" : ""}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold">Questions</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="card p-4">
            <summary className="cursor-pointer font-semibold">{f.q}</summary>
            <p className="mt-2 text-sm text-slate-600">{f.a}</p>
          </details>
        ))}
      </section>

      <section className="card space-y-3 p-6 text-center">
        <h2 className="text-xl font-bold">Find out where you fit</h2>
        <Link href={start} className="btn !px-8 !py-3 text-base">{me ? "Take the career taster" : "Create an account and take the taster"}<ArrowRight size={18} /></Link>
      </section>
    </div>
  );
}
