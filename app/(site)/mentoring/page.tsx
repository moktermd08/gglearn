import type { Metadata } from "next";
import { Flame, GraduationCap, Sparkles, Target } from "lucide-react";
import { PageHero } from "@/components/charts";
import { ShareBar } from "@/components/ShareBar";
import { requireUser } from "@/lib/auth";
import { menteeSummary, menteesOf, mentorsOf } from "@/lib/mentoring";
import { referralCode } from "@/lib/referrals";
import { siteUrl } from "@/lib/share";
import { NoteForm, StopButton } from "./forms";

export const metadata: Metadata = { title: "Mentoring — gglearn", robots: { index: false, follow: false } };

const day = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function Mentoring() {
  const me = await requireUser();
  const base = await siteUrl(), code = referralCode(me.id), url = `${base}/m/${code}`, parentUrl = `${base}/p/${code}`, all = mentorsOf(me.id), mentors = all.filter((m) => m.kind === "mentor"), parents = all.filter((m) => m.kind === "parent");
  const mentees = menteesOf(me.id).map((m) => ({ ...m, s: menteeSummary(me.id, m.id) })).filter((m) => m.s);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={GraduationCap} tone="violet" title="Mentoring" sub="Ask a mentor or a parent to follow your progress and cheer you on, or follow someone else's. It only starts when the learner says yes and the other person agrees, and either can stop any time." />

      <section className="card space-y-3 p-5" aria-label="Your mentors">
        <h2 className="font-bold">Your mentors</h2>
        {mentors.length ? <ul className="space-y-1 text-sm">{mentors.map((m) => <li key={m.id} className="flex items-center gap-2"><b className="flex-1">{m.name}</b><StopButton otherId={m.id} label="Stop sharing" /></li>)}</ul> : <p className="text-sm text-slate-400">Nobody yet.</p>}
        <p className="text-sm text-slate-300">A mentor sees your week, streak, certificates, goal, how far you are through a career route plan (never your answers to its questions) and the topics you work on (a topic they could not see themselves shows as &ldquo;a topic&rdquo;). Never your email. Send them this link; they press one button.</p>
        <label className="block text-sm text-slate-400">Your mentor invitation<input readOnly value={url} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
        <ShareBar url={url} text="Will you be my mentor on gglearn? You would see my progress and could cheer me on." />
      </section>

      <section className="card space-y-3 p-5" aria-label="Your parents">
        <h2 className="font-bold">Your parents or guardians</h2>
        {parents.length ? <ul className="space-y-1 text-sm">{parents.map((m) => <li key={m.id} className="flex items-center gap-2"><b className="flex-1">{m.name}</b><StopButton otherId={m.id} label="Stop sharing" /></li>)}</ul> : <p className="text-sm text-slate-400">Nobody yet.</p>}
        <p className="text-sm text-slate-300">A parent or guardian sees exactly what a mentor does: your week, streak, certificates, goal, career route progress and topics, never your email, and can send you a kind word. Only you can invite them, with this link.</p>
        <label className="block text-sm text-slate-400">Your parent invitation<input readOnly value={parentUrl} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
        <ShareBar url={parentUrl} text="Follow my progress on gglearn: open this link and press one button." />
      </section>

      <section className="space-y-3" aria-label="People you follow">
        <h2 className="font-bold">People you mentor or follow</h2>
        {mentees.length === 0 && <p className="text-sm text-slate-400">Nobody yet. When someone sends you their mentor or parent link and you accept, they appear here.</p>}
        {mentees.map(({ id, s, kind }) => s && (
          <article key={id} className="card space-y-3 p-5">
            <div className="flex items-center gap-2"><b className="text-lg">{s.name}</b><span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-500">{kind === "parent" ? "as parent" : "as mentor"}</span><span className="flex-1" /><StopButton otherId={id} label="Stop" /></div>
            <div className="flex flex-wrap gap-4 text-sm"><span className="flex items-center gap-1"><Sparkles size={14} className="text-sky-400" />{s.weekXp} XP this week</span><span className="flex items-center gap-1"><Flame size={14} className="text-orange-400" />{s.streak}-day streak</span><span>{s.certificates} {s.certificates === 1 ? "certificate" : "certificates"}</span></div>
            {s.goal && <p className="flex items-center gap-1.5 text-sm"><Target size={14} className="text-indigo-400" />Goal: {s.goal.role} by {day(s.goal.date)}</p>}
            {s.route && <p className="flex items-center gap-1.5 text-sm"><Target size={14} className="text-emerald-500" />Route to {s.route.title}: {s.route.stepsDone} of {s.route.stepsTotal} steps done, {({ done: "all done", "on-track": "on track", behind: "a little behind", over: "timeframe ended" })[s.route.status]}, finish line {day(s.route.finishOn)}</p>}
            {s.topics.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">{s.topics.map((t, i) => <li key={i} className="rounded-full bg-black/5 px-2.5 py-1">{t.name}: level {t.passed}</li>)}</ul>}
            <NoteForm menteeId={id} />
          </article>
        ))}
      </section>
    </div>
  );
}
