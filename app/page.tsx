import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { brands, db, questions, tracks } from "@/lib/db";
import { KIND_LABEL, LEVELS, TIERS } from "@/lib/levels";
import { Avatar } from "@/components/Avatar";
import { SubjectArt } from "@/components/SubjectArt";
import { rivalFor } from "@/lib/rivals";
import { hiddenTrackIds } from "@/lib/tracks";
import { ArrowRight, BookOpen, Crown, GraduationCap, Layers, LogIn, Mountain, Swords, Target, Trophy, Users, Zap } from "lucide-react";

const STEPS = [
  { Icon: BookOpen, title: "Study", text: "Short guides and flashcards for the next level.", cls: "text-sky-300 bg-sky-500/15" },
  { Icon: Zap, title: "Drill", text: "Five quick questions with instant feedback.", cls: "text-amber-300 bg-amber-500/15" },
  { Icon: Trophy, title: "Pass the exam", text: "Score 80% to conquer a level.", cls: "text-emerald-300 bg-emerald-500/15" },
  { Icon: GraduationCap, title: "Earn certificates", text: "Verifiable, shareable, printable.", cls: "text-pink-300 bg-pink-500/15" },
] as const;

export default function Home() {
  const all = db
    .select({ track: tracks, brand: brands, n: sql<number>`(select count(*) from ${questions} q where q.track_id = ${tracks.id} and q.status = 'active')` })
    .from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).orderBy(asc(brands.name), asc(tracks.name)).all();
  const hidden = hiddenTrackIds();
  const rows = all.filter((r) => !hidden.has(r.track.id));
  const featured = rows.find((r) => r.track.slug === "git-titan");
  const totalQ = rows.reduce((a, r) => a + r.n, 0), maxN = Math.max(1, ...rows.map((r) => r.n));
  const byBrand = new Map<string, typeof rows>();
  for (const r of rows) byBrand.set(r.brand.name, [...(byBrand.get(r.brand.name) ?? []), r]);

  return (
    <div className="space-y-12">
      <section className="card relative overflow-hidden p-6 sm:p-10">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-indigo-300"><Swords size={16} />Learn head-to-head</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">Race a rival to <span className="gradient-text">Titan</span></h1>
          <p className="mt-4 text-slate-300">
            Every subject comes with a rival who trains every single day. Do daily quests, pass level exams, earn certificates, and
            climb {LEVELS.length} levels before they do.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={featured ? `/tracks/${featured.track.slug}` : "/login"} className="btn">Start with Git<ArrowRight size={16} /></Link>
            <Link href="/login" className="btn btn-ghost"><LogIn size={16} />Sign in</Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 items-end justify-center gap-2 sm:flex" aria-hidden>
          <div className="mb-4 bob"><Avatar kind="human" level={1} size={120} /></div>
          <div className="mb-10 text-3xl font-black text-white/30">VS</div>
          <div className="mb-4 bob [animation-delay:.6s]"><Avatar kind="rival" level={1} hue={rivalFor("git-titan").hue} size={120} /></div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { Icon: Layers, label: "Subjects", value: rows.length, cls: "text-sky-300" },
          { Icon: BookOpen, label: "Questions", value: totalQ, cls: "text-violet-300" },
          { Icon: Mountain, label: "Levels each", value: LEVELS.length, cls: "text-emerald-300" },
          { Icon: Users, label: "Rival per subject", value: 1, cls: "text-pink-300" },
        ].map(({ Icon, label, value, cls }, i) => (
          <div key={label} className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
            <Icon size={22} className={`mx-auto ${cls}`} />
            <div className="mt-1 text-3xl font-extrabold">{value}</div>
            <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Target size={22} className="text-pink-300" />How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text, cls }, i) => (
            <li key={title} className="card card-hover rise relative p-4" style={{ "--i": i } as React.CSSProperties}>
              <span className="absolute right-3 top-3 text-xs font-black text-white/20">{i + 1}</span>
              <div className={`mb-2 grid h-11 w-11 place-items-center rounded-xl ${cls}`}><Icon size={22} /></div>
              <div className="font-semibold">{title}</div>
              <p className="text-sm text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card flex flex-wrap items-center gap-4 p-6">
        <Swords size={36} className="pulse-glow text-pink-300" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">Race a bot, a friend or a whole group</h2>
          <p className="text-slate-300">Any topic, hard skill or soft skill. Set a goal and a deadline, pick your opponents, and keep the contest public to watch or private to your group.</p>
        </div>
        <Link href="/competitions" className="btn">See contests<ArrowRight size={16} /></Link>
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Crown size={22} className="text-amber-300" />Five ranks, twenty levels</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TIERS.map((t, i) => (
            <div key={t.name} className="card card-hover rise p-3 text-center" style={{ "--i": i } as React.CSSProperties}>
              <Avatar kind="human" level={t.from} size={72} className="mx-auto" />
              <div className="mt-1 font-bold" style={{ color: `hsl(${t.hue} 85% 70%)` }}>{t.name}</div>
              <div className="text-xs text-slate-400">Levels {t.from}–{i === 4 ? 20 : t.from + 3}</div>
            </div>
          ))}
        </div>
      </section>

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
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10" title={`${n} questions`}><i className="grow block h-full rounded-full bg-sky-400/70" style={{ width: `${(n / maxN) * 100}%` }} /></div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Swords size={11} className="text-pink-300" />{n} questions · vs {rv.name}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
