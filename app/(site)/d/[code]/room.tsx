"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startTransition } from "react";
import { Bot, Check, Clock, Crown, Frown, Handshake, Loader2, RotateCcw, Share2, Swords, Trophy, X } from "lucide-react";
import { ShareBar } from "@/components/ShareBar";
import type { DuelState } from "@/lib/duel";
import { cancelDuelAction, fillWithBotAction, startDuelAction } from "../actions";
import { createShare } from "@/app/(site)/share/actions";

const QUESTION_MS = 15000;

/** One tick of the screen clock, in server time: the browser's clock plus how far ahead of it the server was at the last poll. */
function useServerNow(offset: number, every = 100) {
  const [t, setT] = useState(() => Date.now() + offset);
  useEffect(() => { const id = setInterval(() => setT(Date.now() + offset), every); return () => clearInterval(id); }, [offset, every]);
  return t;
}

const PIP = ["bg-black/10", "bg-sky-400 animate-pulse", "bg-emerald-500", "bg-rose-500"];

export default function DuelRoom({ code, shareUrl }: { code: string; shareUrl: string }) {
  const [st, setSt] = useState<DuelState | null>(null);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const phase = useRef<string>("waiting");

  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const r = await fetch(`/api/duel/${code}`, { cache: "no-store" });
        if (r.ok) {
          const s = (await r.json()) as DuelState;
          setOffset(s.now - Date.now()); setSt(s); phase.current = s.phase; setErr(null);
          if (s.phase === "done" || s.phase === "canceled") return;
        } else if (r.status === 401 || r.status === 404) { setErr(r.status === 401 ? "Sign in to play." : "This duel is not yours to watch."); return; }
      } catch { /* a dropped poll: try again */ }
      if (!stop) timer = setTimeout(tick, phase.current === "question" || phase.current === "countdown" ? 700 : 1200);
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [code]);

  const now = useServerNow(offset);
  if (err) return <div className="card p-6 text-center text-slate-300">{err}</div>;
  if (!st) return <div className="card flex items-center justify-center gap-2 p-10 text-slate-400"><Loader2 className="animate-spin" size={18} />Joining the duel…</div>;

  const answer = async (index: number, choice: string) => {
    if (picked[index] || busy) return;
    setPicked((p) => ({ ...p, [index]: choice })); setBusy(true);
    try { await fetch(`/api/duel/${code}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ index, choice }) }); } catch { /* the next poll shows what the server has */ }
    setBusy(false);
  };

  const vs = st.opponent ? `${st.opponent.name}${st.opponent.simulated ? " (simulated)" : ""}` : "a friend";
  const Score = (
    <div className="card grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4" aria-label="Score">
      <div><div className="text-xs font-bold uppercase tracking-wide text-slate-400">You</div><div className="text-2xl font-extrabold">{st.totals.you}</div><div className="mt-1 flex gap-1">{st.progress.you.map((p, i) => <i key={i} className={`h-2 w-6 rounded-full ${PIP[p]}`} />)}</div></div>
      <Swords size={22} className="text-pink-400" aria-hidden />
      <div className="text-right"><div className="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">{st.opponent?.simulated && <Bot size={12} />}{st.opponent?.name ?? "Waiting…"}</div><div className="text-2xl font-extrabold">{st.totals.them}</div><div className="mt-1 flex justify-end gap-1">{st.progress.them.map((p, i) => <i key={i} className={`h-2 w-6 rounded-full ${PIP[p]}`} />)}</div></div>
    </div>
  );

  if (st.phase === "canceled") return <div className="card space-y-3 p-8 text-center"><X size={28} className="mx-auto text-slate-400" /><h1 className="text-xl font-extrabold">This duel is over</h1><p className="text-sm text-slate-400">Nobody joined in time, or it was cancelled.</p><Link href="/dashboard" className="btn">Back to my path</Link></div>;

  if (st.phase === "waiting") return (
    <div className="card space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-xl font-extrabold"><Swords className="text-pink-400" />Live duel: {st.topic}</h1>
      <p className="text-sm text-slate-300">Five questions, 15 seconds each, the same for both of you at the same moment. Send this link to a friend and the duel starts when they open it.</p>
      <ShareBar url={shareUrl} text={`I challenge you to a live duel on gglearn: five quick ${st.topic} questions, head to head. Open this and we start at once.`} />
      <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" />Waiting for your friend…</p>
      <div className="flex flex-wrap gap-2">
        <form action={() => startTransition(async () => { await fillWithBotAction(code); })}><button className="btn btn-ghost"><Bot size={16} />Play a simulated rival now</button></form>
        <form action={() => startTransition(async () => { await cancelDuelAction(code); })}><button className="text-sm text-slate-400 underline">Cancel</button></form>
      </div>
    </div>
  );

  if (st.phase === "countdown") {
    const left = Math.max(0, Math.ceil(((st.startsAt ?? now) - now) / 1000));
    return <div className="space-y-4">{Score}<div className="card space-y-3 p-10 text-center"><p className="text-sm font-bold uppercase tracking-widest text-slate-400">{st.topic} · you vs {vs}</p><div className="text-8xl font-black text-indigo-500" aria-live="polite">{left}</div><p className="text-slate-400">Get ready. The first question opens at zero.</p></div></div>;
  }

  if (st.phase === "question" && st.question) {
    const i = st.index ?? 0, mine = picked[i] ?? st.mine?.choice ?? null, left = Math.max(0, (st.deadline ?? now) - now), frac = Math.min(1, left / QUESTION_MS);
    return (
      <div className="space-y-4">
        {Score}
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between text-sm"><b>Question {i + 1} of {st.size}</b><span className="flex items-center gap-1 font-bold tabular-nums text-slate-500"><Clock size={14} />{Math.ceil(left / 1000)}s</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${frac * 100}%`, background: frac > 0.4 ? "#6366f1" : "#f43f5e" }} /></div>
          <p className="text-lg font-semibold">{st.question.prompt}</p>
          {st.question.code && <pre className="overflow-x-auto rounded bg-black/5 p-3 text-sm">{st.question.code}</pre>}
          <div className="grid gap-2">
            {st.question.options.map((o) => (
              <button key={o.key} type="button" disabled={!!mine} onClick={() => answer(i, o.key)}
                className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${mine === o.key ? "border-indigo-400 bg-indigo-500/10" : "border-black/10 hover:border-black/30"} disabled:cursor-default`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold ${mine === o.key ? "bg-indigo-500 text-[#fff]" : "bg-black/[.06]"}`}>{o.key.toUpperCase()}</span><span className="pt-0.5">{o.text}</span>
              </button>))}
          </div>
          <p className="text-sm text-slate-400">{mine ? (st.progress.them[i] === 1 ? "Both answered. The answer is coming up." : `Locked in. Waiting for ${st.opponent?.name ?? "your opponent"}…`) : st.progress.them[i] === 1 ? `${st.opponent?.name} has answered. Your turn.` : "Tap an option. A right answer is worth more the faster you are."}</p>
        </div>
      </div>
    );
  }

  if (st.phase === "reveal" && st.question && st.reveal) {
    const r = st.reveal, next = st.nextAt ? Math.max(0, Math.ceil((st.nextAt - now) / 1000)) : null;
    return (
      <div className="space-y-4">
        {Score}
        <div className="card space-y-4 p-5">
          <b>Question {(st.index ?? 0) + 1} of {st.size}</b>
          <p className="text-lg font-semibold">{st.question.prompt}</p>
          <div className="grid gap-2">
            {st.question.options.map((o) => {
              const right = o.key.toLowerCase() === r.correct.toLowerCase();
              return (
                <div key={o.key} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${right ? "border-emerald-400 bg-emerald-500/10" : r.you.choice === o.key ? "border-rose-300 bg-rose-500/10" : "border-black/10"}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[.06] font-mono text-sm font-bold">{o.key.toUpperCase()}</span>
                  <span className="flex-1 pt-0.5">{o.text}</span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] font-bold">
                    {right && <span className="flex items-center gap-1 text-emerald-600"><Check size={12} />correct</span>}
                    {r.you.choice === o.key && <span className="text-indigo-500">you</span>}
                    {r.them.choice === o.key && <span className="text-pink-500">{st.opponent?.name}</span>}
                  </span>
                </div>);
            })}
          </div>
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm"><span><b className="text-indigo-500">You +{r.you.points}</b> · <b className="text-pink-500">{st.opponent?.name} +{r.them.points}</b>{!r.you.choice && " · you ran out of time"}</span><span className="text-slate-400">{next !== null ? `Next question in ${next}s` : "Final result in a moment"}</span></p>
        </div>
      </div>
    );
  }

  // done
  const f = st.final;
  if (!f) return <div className="card p-8 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></div>;
  const Icon = f.outcome === "win" ? Crown : f.outcome === "lose" ? Frown : Handshake;
  return (
    <div className="space-y-4">
      <div className="card pop space-y-3 p-8 text-center" style={{ background: f.outcome === "win" ? "linear-gradient(135deg, rgba(251,191,36,.22), #fff 70%)" : "linear-gradient(135deg, rgba(99,102,241,.12), #fff 70%)" }}>
        <Icon size={40} className={`mx-auto ${f.outcome === "win" ? "text-amber-500" : "text-slate-400"}`} />
        <h1 className="text-3xl font-extrabold">{f.outcome === "win" ? "You won!" : f.outcome === "lose" ? `${st.opponent?.name} won this one` : "A draw"}</h1>
        <p className="text-lg"><b>{f.you}</b> to <b>{f.them}</b> against {vs} on {st.topic}</p>
        {f.rows.filter((q) => q.you !== null).length >= 3 && <p className="text-sm text-slate-400">Counts as today&apos;s quick drill, so your streak is safe.</p>}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <form action={() => startTransition(async () => { await startDuelAction(st.trackId, st.vsRival ? "bot" : "friend"); })}><button className="btn"><RotateCcw size={16} />{st.vsRival ? "Play another" : "Rematch a friend"}</button></form>
          {f.outcome !== "lose" && <form action={() => startTransition(async () => { await createShare("duel", code); })}><button className="btn btn-ghost"><Share2 size={16} />{f.outcome === "win" ? "Share my win" : "Share the result"}</button></form>}
          {st.vsRival && <form action={() => startTransition(async () => { await startDuelAction(st.trackId, "friend"); })}><button className="btn btn-ghost"><Swords size={16} />Challenge a friend instead</button></form>}
          <Link href="/dashboard" className="btn btn-ghost"><Trophy size={16} />Back to my path</Link>
        </div>
      </div>
      <div className="card p-5"><h2 className="mb-3 font-bold">The five questions</h2>
        <ol className="space-y-2 text-sm">{f.rows.map((q, i) => (
          <li key={i} className="rounded-xl bg-black/[.03] p-3"><div className="font-semibold">{i + 1}. {q.prompt}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>Answer: <b className="text-emerald-600">{q.correct.toUpperCase()}</b></span><span>You: <b className={q.you?.toLowerCase() === q.correct.toLowerCase() ? "text-emerald-600" : "text-rose-500"}>{q.you?.toUpperCase() ?? "no answer"}</b> (+{q.youPoints})</span><span>{st.opponent?.name}: <b className={q.them?.toLowerCase() === q.correct.toLowerCase() ? "text-emerald-600" : "text-rose-500"}>{q.them?.toUpperCase() ?? "no answer"}</b> (+{q.themPoints})</span></div></li>))}</ol></div>
    </div>
  );
}
