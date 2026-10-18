import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { brands, db, questions, tracks } from "@/lib/db";
import { KIND_LABEL, LEVELS, TIERS } from "@/lib/levels";
import { Avatar } from "@/components/Avatar";
import { SubjectArt, artFor } from "@/components/SubjectArt";
import { rivalFor } from "@/lib/rivals";
import { hiddenTrackIds } from "@/lib/tracks";
import { currentUser } from "@/lib/auth";
import { openTo } from "@/lib/paths";
import { avatarLooks } from "@/lib/avatars";
import { AvatarPicker } from "@/components/AvatarPicker";
import { StatTile, PALETTE } from "@/components/charts";
import { ArrowRight, BadgeCheck, BookOpen, Briefcase, Building2, Compass, Flame, Gift, GraduationCap, Medal, Radio, RotateCcw, ShieldCheck, Sparkles, Swords, Target, Timer, Trophy, Users, Wand2 } from "lucide-react";
import { SETS, campaignViews, type SetKey } from "@/lib/campaigns";
import { listFor } from "@/lib/competitions";
import { CompetitionCard } from "@/components/CompetitionCard";
import { CertFrame } from "@/components/CertFrame";
import { RankEmblem } from "@/components/RankEmblem";
import { GATES, LINES, LINE_COLOUR, STATIONS } from "@/lib/lifecycle/model";

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
  const looks = await avatarLooks();
  const all = db
    .select({ track: tracks, brand: brands, n: sql<number>`(select count(*) from ${questions} q where q.track_id = ${tracks.id} and q.status = 'active')` })
    .from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).orderBy(asc(brands.name), asc(tracks.name)).all();
  const hidden = hiddenTrackIds();
  const rows = all.filter((r) => !hidden.has(r.track.id) && r.n > 0 && (!viewer || openTo(viewer.audience, r.track.audience)));
    const totalQ = rows.reduce((a, r) => a + r.n, 0), maxN = Math.max(1, ...rows.map((r) => r.n));
  const byBrand = new Map<string, typeof rows>();
  for (const r of rows) byBrand.set(r.brand.name, [...(byBrand.get(r.brand.name) ?? []), r]);
  const brandSlug = (name: string) => `brand-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const camps = campaignViews();
  const prized = camps.filter((v) => v.rewardKind !== "certificate").sort((a, b) => b.reward.cash - a.reward.cash);
  const flagships = prized.slice(0, 3);
  const topPool = flagships[0]?.reward.cash ?? 0;
  const prizeCount = camps.filter((v) => v.rewardKind !== "certificate").length;
  const SET_META: Record<SetKey, { Icon: typeof Briefcase; tone: string; hue: string; blurb: string }> = {
    career: { Icon: Briefcase, tone: "bg-violet-500/15 text-violet-300", hue: "#8b5cf6", blurb: "A race for every role: from first job to CTO." },
    general: { Icon: Compass, tone: "bg-sky-500/15 text-sky-300", hue: "#0ea5e9", blurb: "Leagues and sprints on the skills everyone uses." },
    ai: { Icon: Sparkles, tone: "bg-pink-500/15 text-pink-300", hue: "#ec4899", blurb: "Races on prompting, agents, RAG and the AI toolchain." },
  };
  const contests = listFor(viewer).filter((x) => x.c.visibility === "public" && (x.state === "live" || x.state === "upcoming")).slice(0, 3);
  const logos = rows.filter((r) => artFor(r.track.slug, r.track.name, r.track.kind).glyph.kind === "brand").slice(0, 18);

  const subjectCard = ({ track, n }: (typeof rows)[number], i: number) => {
    const rv = rivalFor(track.slug);
    return (
      <Link key={track.id} href={`/tracks/${track.slug}`} className="card card-hover rise flex min-w-0 items-center gap-3 p-4" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
        <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-slate-400">{KIND_LABEL[track.kind]}</div>
          <div className="truncate font-semibold">{track.name}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10" title={`${n} questions`}><i className="grow block h-full rounded-full bg-sky-400/70" style={{ width: `${(n / maxN) * 100}%` }} /></div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Swords size={11} className="text-pink-300" />{n} questions · vs {rv.name}</div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 overflow-x-clip pt-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="pointer-events-none absolute -left-24 -top-16 -z-10 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-16 top-10 -z-10 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl" aria-hidden />
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#fff] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-300"><GraduationCap size={14} />Training academy</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Learn what your role needs. <span className="gradient-text">Prove it. Move up.</span></h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            gglearn gives every person on your team, and every customer, a clear learning path. Pass level exams, earn certificates,
            and climb {LEVELS.length} levels from Novice to Titan, with a daily rival to keep you showing up. Want a race? Join one of {camps.length} public campaigns.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={viewer ? "/dashboard" : "/login"} className="btn">{viewer ? "Go to my path" : "Sign in to see your path"}<ArrowRight size={16} /></Link>
            <Link href="/campaigns" className="btn btn-ghost"><Flame size={16} className="text-pink-300" />Browse {camps.length} campaigns</Link>
            <Link href="/map" className="btn btn-ghost">Explore the lifecycle map</Link>
            <a href="#subjects" className="btn btn-ghost">Browse subjects</a>
          </div>
          <p className="mt-3 text-sm text-slate-400">{rows.length} subjects · {totalQ.toLocaleString("en-GB")} questions · accounts are created by your admin</p>
        </div>
        <div className="card-soft relative p-5">
          <span className="bob pointer-events-none absolute -right-2 -top-4 z-10 hidden items-center gap-1.5 rounded-full border border-black/10 bg-[#fff] px-3 py-1.5 text-xs font-bold shadow-lg sm:inline-flex" aria-hidden><Flame size={14} className="text-orange-500" fill="#f97316" />5-day streak</span>
          <span className="bob pointer-events-none absolute -bottom-3 -left-4 z-10 hidden items-center gap-1.5 rounded-full border border-black/10 bg-[#fff] px-3 py-1.5 text-xs font-bold shadow-lg [animation-delay:.8s] sm:inline-flex" aria-hidden><Sparkles size={14} className="text-sky-500" />+120 XP</span>
          <span className="bob pointer-events-none absolute -bottom-3 -right-3 z-10 hidden items-center gap-1.5 rounded-full border border-black/10 bg-[#fff] px-3 py-1.5 text-xs font-bold shadow-lg [animation-delay:1.4s] sm:inline-flex" aria-hidden><GraduationCap size={14} className="text-amber-500" />Certificate earned</span>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">A learner&apos;s path</div>
          {[{ n: "Git and GitHub", l: 8, d: "Required · due in 14 days" }, { n: "Company security basics", l: 5, d: "Required · done" }, { n: "Client communication", l: 3, d: "Next promotion step" }].map((p, i) => (
            <div key={p.n} className="mb-2 flex items-center gap-3 rounded-xl border border-black/10 bg-[#fff] p-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-500/10 text-sm font-extrabold text-indigo-300">L{p.l}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{p.n}</div><div className="text-xs text-slate-400">{p.d}</div>
                <div className="bar mt-1.5 !h-1.5"><i style={{ width: `${[40, 100, 15][i]}%` }} /></div></div>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#fff] p-3 ring-1 ring-black/10" aria-hidden>
            <div className="bob"><Avatar kind="human" level={8} size={56} look={looks.me} photoUrl={looks.photoUrl} /></div>
            <div className="text-center text-xs font-black text-slate-500">VS</div>
            <div className="bob [animation-delay:.6s]"><Avatar kind="rival" level={9} hue={rivalFor("git-titan").hue} size={56} look={looks.rival} /></div>
          </div>
          <div className="mt-2 text-center"><AvatarPicker me={looks.me} rival={looks.rival} photoUrl={looks.photoUrl} signedIn={looks.signedIn} level={8} rivalLevel={9} rivalHue={rivalFor("git-titan").hue} /></div>
        </div>
      </section>

      <Link href="/map" className="card card-hover group block overflow-hidden" aria-label="Open the software lifecycle map">
        <div className="grid items-center gap-5 p-5 sm:grid-cols-[1.1fr_1fr] sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-300">The software lifecycle, as a map</p>
            <h2 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">Every stop from idea to shutdown, drawn like a transit map</h2>
            <p className="mt-2 text-slate-300">{LINES.length} lines, {STATIONS.length} stops and {GATES.length} handoff gates. Say what you do, see your route, and learn each stop.</p>
            <span className="btn mt-4 inline-flex">Open the map<ArrowRight size={16} /></span>
          </div>
          <svg viewBox="0 0 360 150" className="w-full" aria-hidden>
            {LINES.map((l, i) => { const y = 10 + i * (130 / LINES.length), a = 8 + (i * 17) % 60, b = 352 - (i * 23) % 70; return (
              <g key={l.id}><line x1={a} x2={b} y1={y} y2={y} stroke={LINE_COLOUR[l.id]} strokeWidth={5} strokeLinecap="round" />
                {[0.18, 0.4, 0.62, 0.84].map((f) => <circle key={f} cx={a + (b - a) * f} cy={y} r={4} fill="#fbfaf6" stroke={LINE_COLOUR[l.id]} strokeWidth={2.5} />)}</g>); })}
            {[84, 176, 268].map((x) => <g key={x}><rect x={x - 4} y={10} width={8} height={130} rx={2} fill="#fbfaf6" stroke="#14161f" strokeWidth={2} /></g>)}
          </svg>
        </div>
      </Link>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="The academy in numbers">
        <StatTile i={0} Icon={BookOpen} label="Subjects" value={rows.length} color={PALETTE.indigo} />
        <StatTile i={1} Icon={Target} label="Questions" value={totalQ.toLocaleString("en-GB")} color={PALETTE.sky} />
        <StatTile i={2} Icon={Flame} label="Public campaigns" value={camps.length} color={PALETTE.pink} />
        <StatTile i={3} Icon={Trophy} label="Levels to Titan" value={LEVELS.length} color={PALETTE.amber} />
      </section>

      <section aria-label="Subjects you can learn" className="space-y-4">
        <p className="text-center text-xs font-semibold uppercase tracking-[.3em] text-slate-400">Learn anything your work needs</p>
        <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="marquee gap-4">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 gap-4 pr-4" aria-hidden={copy === 1 || undefined}>
                {logos.map(({ track }) => <Link key={track.id} href={`/tracks/${track.slug}`} title={track.name} tabIndex={copy === 1 ? -1 : undefined} className="transition hover:-translate-y-1"><SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={60} className="shadow-md" /></Link>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold">How it works</h2>
        <p className="mb-4 text-slate-400">Four steps, repeated until you reach Titan.</p>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text, cls }, i) => (
            <li key={title} className="card rise relative p-5" style={{ "--i": i } as React.CSSProperties}>
              {i < 3 && <span className="pointer-events-none absolute -right-3.5 top-9 z-10 hidden h-7 w-7 place-items-center rounded-full border border-black/10 bg-[#fff] text-slate-400 shadow-sm lg:grid" aria-hidden><ArrowRight size={14} /></span>}
              <span className="absolute right-4 top-3 grid h-6 w-6 place-items-center rounded-full text-xs font-black text-[#fff]" style={{ background: "linear-gradient(135deg,#4f46e5,#9333ea)" }}>{i + 1}</span>
              <div className={`mb-3 grid h-11 w-11 place-items-center rounded-xl ${cls}`}><Icon size={22} /></div>
              <div className="font-semibold">{title}</div>
              <p className="mt-1 text-sm text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Campaigns" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2.5 text-2xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Flame size={19} /></span>{camps.length} public campaigns, one for every career</h2>
            <p className="text-slate-400">Pick one, climb the leaderboard and earn a certificate. {prizeCount} of them add prizes for the best.</p>
          </div>
          <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-300 hover:underline">All campaigns<ArrowRight size={14} /></Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {(Object.keys(SETS) as SetKey[]).map((k, i) => { const { Icon, tone, hue, blurb } = SET_META[k]; const n = camps.filter((v) => v.kind === k).length; return (
              <Link key={k} href={`/campaigns?set=${k}#browse`} className="card card-hover rise group relative flex items-center gap-3 overflow-hidden p-4" style={{ "--i": i } as React.CSSProperties}>
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: hue }} aria-hidden />
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={21} /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{SETS[k]} <span className="text-sm font-normal text-slate-400">· {n} campaigns</span></span><span className="block text-xs text-slate-400">{blurb}</span></span>
                <ArrowRight size={16} className="hidden shrink-0 text-slate-400 transition group-hover:translate-x-0.5 lg:block" />
              </Link>); })}
          </div>
          <div className="card relative overflow-hidden p-4" style={{ background: "linear-gradient(140deg, rgba(251,191,36,.18), #fff 65%)" }}>
            <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-amber-300"><Trophy size={14} />{topPool >= 10000 ? "Flagship races · $100 prize pools" : "Races with prizes"}</div>
            <ul className="space-y-2">
              {flagships.map((v) => (
                <li key={v.id}><Link href={`/competitions/${v.slug}`} className="group flex items-center gap-3 rounded-xl bg-[#fff]/80 p-2.5 transition hover:bg-[#fff] hover:shadow-md">
                  <SubjectArt slug={v.track} name={v.trackName} kind={v.trackKind as never} size={40} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{v.title}</span><span className="block truncate text-xs text-slate-400">{v.hook}</span></span>
                  <span className="shrink-0 rounded-full bg-amber-400/25 px-2 py-0.5 text-xs font-extrabold text-amber-300">{v.reward.cash > 0 ? `$${v.reward.cash / 100}` : "Prize"}</span>
                </Link></li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Gift size={13} className="text-emerald-400" />Plus Amazon vouchers and certificates, paid by the organiser. gglearn never holds the money.</p>
          </div>
        </div>
      </section>

      <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]" aria-label="Certificates">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-300"><BadgeCheck size={14} />Proof you can share</p>
          <h2 className="mt-3 text-3xl font-extrabold">Certificates anyone can verify</h2>
          <p className="mt-2 text-slate-300">Pass level 5, 10, 15 or 20 and earn a certificate with its own verification code. Share the link, print it as a PDF, and anyone can confirm it is real.</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {["Earned by real level exams, never by clicking through", "A public page with the score, level and date", "Contest winners get a Champion certificate too"].map((t) => <li key={t} className="flex items-start gap-2"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />{t}</li>)}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <span className="absolute -right-2 -top-3 z-10 rounded-full bg-slate-800 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#fff] shadow-lg">Sample</span>
          <CertFrame hue={TIERS[2].hue} code="SAMPLE-0001" seal={<RankEmblem level={10} size={60} />}>
            <p className="mt-4 text-xs uppercase tracking-[.4em] text-slate-400">Certificate of achievement</p>
            <h3 className="mt-2 text-2xl font-extrabold gradient-text">Practitioner · Your subject</h3>
            <p className="mt-4 text-slate-400">This certifies that</p>
            <p className="mt-1 border-b border-slate-200 pb-2 font-serif text-3xl font-bold italic">Your Name</p>
            <p className="mt-3 text-sm text-slate-300">passed level 10 (Proficient) with a score of 92%</p>
          </CertFrame>
        </div>
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
          <div>
            <svg viewBox="0 0 400 130" className="mb-3 w-full" role="img" aria-label="Twenty levels grouped into five ranks">
              {Array.from({ length: 20 }, (_, n) => { const tier = TIERS[Math.min(4, Math.floor(n / 4))]; const h = 14 + n * 5.4; return <rect key={n} x={n * 20 + 1} y={120 - h} width="18" height={h} rx="4" fill={`hsl(${tier.hue} 75% 55%)`} className="grow" style={{ "--i": n, transformOrigin: "bottom" } as React.CSSProperties} />; })}
              <text x="296" y="14" textAnchor="end" fontSize="11" fontWeight="800" fill="#6f7788">Titan 👑</text>
            </svg>
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
        </div>
      </section>

      <section aria-label="Contest features" className="space-y-4">
        <div><h2 className="flex items-center gap-2.5 text-2xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Timer size={19} /></span>Race the clock, and the record</h2><p className="text-slate-400">Contests are not just a leaderboard. Every finish is timed, ranked and kept.</p></div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[{ Icon: Radio, t: "Live leaderboard", d: "Ranked by who reaches the goal first, then levels gained, then XP. Bots are always labelled as simulated.", tone: "bg-emerald-500/15 text-emerald-300" },
            { Icon: Timer, t: "Exam clock", d: "Exams show a live clock and, in a contest you race in, the level record to beat.", tone: "bg-sky-500/15 text-sky-300" },
            { Icon: Trophy, t: "Time records and Hall of Fame", d: "Finish times, ranks, splits and how many people you beat, all read from real exams.", tone: "bg-amber-500/15 text-amber-300" },
            { Icon: RotateCcw, t: "Come back and beat it", d: "When a contest ends, anyone who can see it can start a record attempt and chase the fastest time.", tone: "bg-violet-500/15 text-violet-300" },
            { Icon: Medal, t: "Badges, never handed out", d: "Record holder, Podium, Flawless, Speed demon and more, earned from what you actually did.", tone: "bg-pink-500/15 text-pink-300" },
            { Icon: Wand2, t: "An optional twist", d: "Organisers can switch on the Architect: one racer per level may rewrite a question, checked by an AI referee, with the organiser able to veto it.", tone: "bg-indigo-500/15 text-indigo-300" }].map(({ Icon, t, d, tone }, i) => (
            <li key={t} className="card rise flex items-start gap-3 p-4" style={{ "--i": i } as React.CSSProperties}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
              <div><div className="text-sm font-bold">{t}</div><p className="mt-0.5 text-xs text-slate-400">{d}</p></div>
            </li>
          ))}
        </ul>
      </section>

      {contests.length > 0 && (
        <section aria-label="Contests">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="flex items-center gap-2.5 text-2xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Trophy size={19} /></span>Contests you can watch</h2><p className="text-slate-400">Public races, live right now or starting soon.</p></div>
            <Link href="/competitions" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-300 hover:underline">All contests<ArrowRight size={14} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{contests.map((x) => <CompetitionCard key={x.c.id} card={x} />)}</div>
        </section>
      )}

      <div id="subjects" className="scroll-mt-20 space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Subjects</h2><p className="text-slate-400">Everything currently available, grouped by brand.</p>
          <nav aria-label="Jump to a brand" className="mt-3 flex flex-wrap gap-2">{[...byBrand].map(([name, items]) => <a key={name} href={`#${brandSlug(name)}`} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#fff] px-3 py-1 text-sm font-semibold transition hover:border-indigo-400 hover:text-indigo-300">{name}<span className="text-xs font-normal text-slate-400">{items.length}</span></a>)}</nav>
        </div>
      {[...byBrand].map(([brand, items]) => (
        <section key={brand} id={brandSlug(brand)} className="scroll-mt-24">
          <h2 className="mb-3 flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl text-sm font-extrabold text-[#fff]" style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>{brand.slice(0, 1).toUpperCase()}</span>{brand} <span className="text-sm font-normal text-slate-400">· {items.length}</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 9).map(subjectCard)}
          </div>
          {items.length > 9 && (
            <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-sky-300">Show the other {items.length - 9}</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.slice(9).map((x, i) => subjectCard(x, i + 9))}</div></details>
          )}
        </section>
      ))}
      </div>
      <section className="relative overflow-hidden rounded-2xl p-8 text-center text-[#fff] sm:p-12" style={{ background: "linear-gradient(120deg,#4f46e5,#9333ea 70%,#db2777)" }}>
        <svg className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 opacity-25" viewBox="0 0 200 200" aria-hidden><circle cx="100" cy="100" r="90" fill="none" stroke="#fff" /><circle cx="100" cy="100" r="60" fill="none" stroke="#fff" strokeDasharray="4 6" className="march" /></svg>
        <h2 className="relative text-3xl font-extrabold">Ready to start your climb?</h2>
        <p className="relative mx-auto mt-2 max-w-lg text-[#fff]/80">Your path is waiting, and so is your rival.</p>
        <div className="relative mt-5 flex flex-wrap justify-center gap-3"><Link href={viewer ? "/dashboard" : "/login"} className="btn !bg-[#fff] !text-indigo-700">{viewer ? "Go to my path" : "Sign in"}<ArrowRight size={16} /></Link><Link href="/campaigns" className="btn !bg-transparent !text-[#fff] ring-2 ring-[#fff]/60 hover:!bg-[#fff]/15"><Flame size={16} />See the campaigns</Link></div>
      </section>
    </div>
  );
}
