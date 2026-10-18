import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Award, BookOpen, Swords } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { themeStyle } from "@/lib/brand";
import { entryOf } from "@/lib/entry";
import { scopesOf } from "@/lib/paths";
import { byTopicName, topicLabel } from "@/lib/topicName";
import { KIND_LABEL } from "@/lib/levels";
import { SubjectArt } from "@/components/SubjectArt";
import { siteUrl } from "@/lib/share";
import EntryForm from "./form";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = entryOf((await params).slug);
  if (!e) return { title: "Page not found — gglearn", robots: { index: false, follow: false } };
  const title = `${e.look.name}: learn with ${e.company.name}`, description = e.company.entryText || `Getting-started training from ${e.company.name}. Free to join: find your level, take exams and earn certificates.`;
  return { metadataBase: new URL(await siteUrl()), title, description, openGraph: { title, description, type: "website" }, twitter: { card: "summary_large_image", title, description } };
}

/** A company's own front door: its name, logo and colour, what a customer can learn, and a one-step sign-up. Only exists while the company has switched it on. */
export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug, e = entryOf(slug);
  if (!e) notFound();
  const { company, look, topics } = e, me = await currentUser();
  const mine = !!me && scopesOf(me.id).some((s) => s.kind === "company" && s.id === company.id);
  const byBrand = new Map<string, typeof topics>();
  for (const t of [...topics].sort((a, b) => byTopicName(a.name, b.name))) byBrand.set(t.brand, [...(byBrand.get(t.brand) ?? []), t]);
  const welcome = company.entryText || `Getting-started training from ${company.name}. Find your level, take short exams and earn certificates.`;
  return (
    <div className="mx-auto max-w-5xl space-y-8" style={themeStyle(look) as React.CSSProperties | undefined}>
      <section className="card pop grid gap-6 overflow-hidden p-6 sm:p-8 md:grid-cols-[1.2fr_1fr]" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand) 14%, white), #fff 65%)" }}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {look.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- a company's own logo, served by our logo route
              <img src={look.logo} alt={`${company.name} logo`} className="h-12 w-12 rounded-xl border border-black/10 bg-[#fff] object-contain p-1" />
            )}
            <div><div className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{company.name}</div><div className="text-lg font-bold">{look.name}</div></div>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Learn it. Prove it. <span style={{ color: "var(--brand)" }}>Get certified.</span></h1>
          <p className="max-w-xl text-lg text-slate-300">{welcome}</p>
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            {[{ Icon: BookOpen, t: "Short lessons and drills" }, { Icon: Swords, t: "Race a rival, climb 20 levels" }, { Icon: Award, t: `Certificates from ${look.issuer}` }].map(({ Icon, t }) => (
              <li key={t} className="flex items-center gap-2 rounded-xl bg-[#fff]/70 p-2.5"><Icon size={16} style={{ color: "var(--brand)" }} />{t}</li>))}
          </ul>
        </div>
        <div className="rounded-2xl bg-[#fff] p-5 shadow-sm ring-1 ring-black/5" id="join">
          {mine ? (
            <div className="space-y-3 text-center"><h2 className="text-lg font-extrabold">Welcome back</h2><p className="text-sm text-slate-400">You are already part of {company.name}.</p><Link href="/dashboard" className="btn">Open your path<ArrowRight size={16} /></Link></div>
          ) : me ? (
            <div className="space-y-3 text-center"><h2 className="text-lg font-extrabold">You are signed in</h2><p className="text-sm text-slate-400">You are signed in as {me.name}. To join as a {company.name} customer, sign out and come back to this page.</p></div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-extrabold">Create your free account</h2>
              <EntryForm slug={slug} cta="Start learning" />
              <p className="text-center text-sm text-slate-400">Already have one? <Link href={`/login?next=${encodeURIComponent(`/c/${slug}`)}`} className="font-semibold underline">Sign in</Link></p>
            </div>
          )}
        </div>
      </section>

      {topics.length > 0 && (
        <section aria-label="What you can learn" className="space-y-5">
          <h2 className="text-2xl font-bold">What you can learn</h2>
          {[...byBrand].map(([brand, list]) => (
            <div key={brand} className="space-y-2">
              {byBrand.size > 1 && <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{brand}</h3>}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <li key={t.id} className="card flex items-center gap-3 p-4">
                    <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={48} />
                    <div className="min-w-0"><div className="text-xs uppercase tracking-wide text-slate-400">{KIND_LABEL[t.kind] ?? t.kind}</div><div className="truncate font-semibold">{topicLabel(t.name)}</div><div className="text-xs text-slate-400">{t.n.toLocaleString("en-GB")} questions</div></div>
                  </li>))}
              </ul>
            </div>))}
        </section>
      )}
    </div>
  );
}
