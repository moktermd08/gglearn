import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { brands, db, questions, tracks } from "@/lib/db";
import { KIND_LABEL, LEVELS, TIERS } from "@/lib/levels";
import { Avatar } from "@/components/Avatar";
import { SubjectArt } from "@/components/SubjectArt";
import { rivalFor } from "@/lib/rivals";
import { hiddenTrackIds } from "@/lib/tracks";
import { currentUser } from "@/lib/auth";
import { openTo } from "@/lib/paths";
import { StatTile, PALETTE } from "@/components/charts";
import { ArrowRight, BookOpen, Building2, GraduationCap, Layers, ShieldCheck, Swords, Target, Trophy, Users } from "lucide-react";

const STEPS = [
  { Icon: Target, title: "Get your path", text: "Sign in and see the subjects your role, brand and project require, each with a deadline.", cls: "text-indigo-300 bg-indigo-500/10" },
  { Icon: BookOpen, title: "Learn in short bursts", text: "Study guides, flashcards and five-question drills with instant feedback.", cls: "text-sky-300 bg-sky-500/10" },
  { Icon: Trophy, title: "Pass level exams", text: "Fresh questions every attempt. Score 80% to unlock the next of 20 levels.", cls: "text-emerald-300 bg-emerald-500/10" },
  { Icon: GraduationCap, title: "Earn proof", text: "Verifiable certificates, and a clear route to your next promotion.", cls: "text-amber-300 bg-amber-500/10" },
] as const;

const AUDIENCES = [
  { Icon: Users, title: "Your team", text: "Required learning is assigned by job role and brand, tracked to a deadline, and tied to the promotion ladder for each role." },
  { Icon: Building2, title: "Your customers", text: "Customers get getting-started and product training for the brands and projects they bought, and nothing else." },
  { Icon: ShieldCheck, title: "Managers and admins", text: "See who is on track and who is overdue, manage the question bank, and approve promotions with the evidence in hand." },
] as const;

export default async function Home() {
  const viewer = await currentUser();
  const all = db
    .select({ track: tracks, brand: brands, n: sql<number>`(select count(*) from ${questions} q where q.track_id = ${tracks.id} and q.status = 'active')` })
    .from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).orderBy(asc(brands.name), asc(tracks.name)).all();
  const hidden = hiddenTrackIds();
  const rows = all.filter((r) => !hidden.has(r.track.id) && (!viewer || openTo(viewer.audience, r.track.audience)));
    const totalQ = rows.reduce((a, r) => a + r.n, 0), maxN = Math.max(1, ...rows.map((r) => r.n));
  const byBrand = new Map<string, typeof rows>();
  for (const r of rows) byBrand.set(r.brand.name, [...(byBrand.get(r.brand.name) ?? []), r]);

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 pt-4 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#fff] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-300"><GraduationCap size={14} />Training academy</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Learn what your role needs. <span className="gradient-text">Prove it. Move up.</span></h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            gglearn gives every person on your team, and every customer, a clear learning path. Pass level exams, earn certificates,
            and climb {LEVELS.length} levels from Novice to Titan, with a daily rival to keep you showing up.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={viewer ? "/dashboard" : "/login"} className="btn">{viewer ? "Go to my path" : "Sign in to see your path"}<ArrowRight size={16} /></Link>
            <a href="#subjects" className="btn btn-ghost">Browse subjects</a>
          </div>
          <p className="mt-3 text-sm text-slate-400">{rows.length} subjects · {totalQ} questions · accounts are created by your admin</p>
        </div>
        <div className="card-soft p-5" aria-hidden>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">A learner&apos;s path</div>
          {[{ n: "Git and GitHub", l: 8, d: "Required · due in 14 days" }, { n: "Company security basics", l: 5, d: "Required · done" }, { n: "Client communication", l: 3, d: "Next promotion step" }].map((p, i) => (
            <div key={p.n} className="mb-2 flex items-center gap-3 rounded-xl border border-black/10 bg-[#fff] p-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-500/10 text-sm font-extrabold text-indigo-300">L{p.l}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{p.n}</div><div className="text-xs text-slate-400">{p.d}</div>
                <div className="bar mt-1.5 !h-1.5"><i style={{ width: `${[40, 100, 15][i]}%` }} /></div></div>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#fff] p-3 ring-1 ring-black/10">
            <div className="bob"><Avatar kind="human" level={8} size={56} /></div>
            <div className="text-center text-xs font-black text-slate-500">VS</div>
            <div className="bob [animation-delay:.6s]"><Avatar kind="rival" level={9} hue={rivalFor("git-titan").hue} size={56} /></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="The academy in numbers">
        <StatTile i={0} Icon={BookOpen} label="Subjects" value={rows.length} color={PALETTE.indigo} />
        <StatTile i={1} Icon={Target} label="Questions" value={totalQ.toLocaleString("en-GB")} color={PALETTE.sky} />
        <StatTile i={2} Icon={Layers} label="Brands" value={byBrand.size} color={PALETTE.violet} />
        <StatTile i={3} Icon={Trophy} label="Levels to Titan" value={LEVELS.length} color={PALETTE.amber} />
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold">How it works</h2>
        <p className="mb-4 text-slate-400">Four steps, repeated until you reach Titan.</p>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text, cls }, i) => (
            <li key={title} className="card rise relative p-5" style={{ "--i": i } as React.CSSProperties}>
              <span className="absolute right-4 top-3 text-sm font-black text-slate-600">{i + 1}</span>
              <div className={`mb-3 grid h-11 w-11 place-items-center rounded-xl ${cls}`}><Icon size={22} /></div>
              <div className="font-semibold">{title}</div>
              <p className="mt-1 text-sm text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold">Who it is for</h2>
        <p className="mb-4 text-slate-400">One platform, three kinds of people.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {AUDIENCES.map(({ Icon, title, text }) => (
            <div key={title} className="card p-5"><Icon size={22} className="text-indigo-300" /><div className="mt-2 font-semibold">{title}</div><p className="mt-1 text-sm text-slate-400">{text}</p></div>
          ))}
        </div>
      </section>

      <section className="card-soft p-6 sm:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold"><Swords size={22} className="text-pink-300" />A rival keeps you consistent</h2>
            <p className="mt-2 text-slate-300">Every subject has a rival who trains every day. Do your daily quest, pass your exam, and stay ahead. It is a motivator on top of the learning, not a replacement for it.</p>
            <Link href="/competitions" className="mt-4 inline-flex items-center gap-1 font-semibold text-indigo-300 hover:underline">Or run a contest against friends or a group<ArrowRight size={15} /></Link>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {TIERS.map((t, i) => (
              <div key={t.name} className="rounded-xl border border-black/10 bg-[#fff] p-2 text-center">
                <Avatar kind="human" level={t.from} size={52} className="mx-auto" />
                <div className="mt-1 text-xs font-bold" style={{ color: `hsl(${t.hue} 70% 35%)` }}>{t.name}</div>
                <div className="text-[10px] text-slate-400">L{t.from}–{i === 4 ? 20 : t.from + 3}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="subjects" className="scroll-mt-20 space-y-8">
        <div><h2 className="text-2xl font-bold">Subjects</h2><p className="text-slate-400">Everything currently available, grouped by brand.</p></div>
      {[...byBrand].map(([brand, items]) => (
        <section key={brand}>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Layers size={20} className="text-sky-300" />{brand} <span className="text-sm font-normal text-slate-400">· {items.length}</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ track, n }, i) => {
              const rv = rivalFor(track.slug);
              return (
                <Link key={track.id} href={`/tracks/${track.slug}`} className="card card-hover rise flex items-center gap-3 p-4" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                  <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-400">{KIND_LABEL[track.kind]}</div>
                    <div className="truncate font-semibold">{track.name}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10" title={`${n} questions`}><i className="grow block h-full rounded-full bg-sky-400/70" style={{ width: `${(n / maxN) * 100}%` }} /></div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Swords size={11} className="text-pink-300" />{n} questions · vs {rv.name}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}
