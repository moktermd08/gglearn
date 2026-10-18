import type { Metadata } from "next";
import { Crown, Flame, Sparkles, UserMinus, UserPlus, Users } from "lucide-react";
import { PageHero } from "@/components/charts";
import { ShareBar } from "@/components/ShareBar";
import { requireUser } from "@/lib/auth";
import { feedFor, friendIds, nowSec, requestsFor, weekBoard } from "@/lib/friends";
import { referralCode } from "@/lib/referrals";
import { siteUrl } from "@/lib/share";
import { AddByEmail, CheerButton, RequestButtons } from "./forms";
import { removeFriend } from "./actions";

export const metadata: Metadata = { title: "Friends — gglearn", robots: { index: false, follow: false } };

const ago = (sec: number, now: number) => { const d = Math.max(0, now - sec); return d < 3600 ? `${Math.max(1, Math.floor(d / 60))}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`; };

export default async function Friends() {
  const me = await requireUser();
  const url = `${await siteUrl()}/f/${referralCode(me.id)}`, requests = requestsFor(me.id), board = weekBoard(me.id), feed = feedFor(me.id), n = friendIds(me.id).length;
  const now = nowSec();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Users} tone="pink" title="Friends" sub="Friends see each other's week and achievements and can cheer them on. It is always mutual: nobody is added without saying yes, and either of you can stop any time." />

      {requests.length > 0 && (
        <section className="card space-y-2 border-2 border-indigo-300/70 p-4" aria-label="Friend requests">
          <h2 className="font-bold">{requests.length === 1 ? "Someone wants to be your friend" : `${requests.length} people want to be your friends`}</h2>
          {requests.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fff]/70 p-3"><b>{r.name}</b><RequestButtons id={r.id} /></div>)}
        </section>
      )}

      <section className="card space-y-3 p-5" aria-label="Add friends">
        <h2 className="flex items-center gap-2 font-bold"><UserPlus size={18} className="text-pink-400" />Add a friend</h2>
        <p className="text-sm text-slate-300">Send your friend link: when they open it and press the button you are friends at once, and they can make a free account first if they need one.</p>
        <label className="block text-sm text-slate-400">Your friend link<input readOnly value={url} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
        <ShareBar url={url} text="Be my friend on gglearn: we can see each other's week and cheer each other's streaks." />
        <div className="border-t border-black/5 pt-3"><p className="mb-2 text-sm text-slate-300">Or ask someone who already has an account, by email. They have to say yes.</p><AddByEmail /></div>
      </section>

      <section className="card p-5" aria-label="This week">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><Crown size={18} className="text-amber-400" />This week</h2>
        {n === 0 ? <p className="text-sm text-slate-400">Add a friend and you will race each other here every week: XP from quests and exams, and who has the longer streak.</p> : (
          <ol className="space-y-2">{board.map((r, i) => (
            <li key={r.userId} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.me ? "bg-indigo-500/10 ring-2 ring-indigo-400/50" : "bg-black/[.03]"}`}>
              <span className="w-6 text-center text-sm font-extrabold text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <span className="flex items-center gap-1 text-sm text-orange-500" title="Day streak"><Flame size={14} />{r.streak}</span>
              <span className="flex w-20 items-center justify-end gap-1 font-bold"><Sparkles size={13} className="text-sky-400" />{r.weekXp}</span>
              {!r.me && <form action={removeFriend.bind(null, r.userId)}><button aria-label={`Remove ${r.name} as a friend`} title="Remove friend" className="text-slate-300 hover:text-rose-400"><UserMinus size={15} /></button></form>}
            </li>))}</ol>
        )}
      </section>

      <section className="card p-5" aria-label="Activity">
        <h2 className="mb-3 font-bold">What your friends did lately</h2>
        {feed.length === 0 ? <p className="text-sm text-slate-400">{n === 0 ? "Their levels, badges and certificates will show up here." : "Nothing in the last two weeks yet. When a friend passes a level or earns a badge it appears here, and you can cheer it."}</p> : (
          <ul className="divide-y divide-black/5">{feed.map((f) => (
            <li key={f.key} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1"><b>{f.name}</b> {f.text}<span className="ml-2 text-xs text-slate-400">{ago(f.at, now)}</span></span>
              <CheerButton eventKey={f.key} cheered={f.cheered} count={f.cheers} />
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
