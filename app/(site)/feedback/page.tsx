import type { Metadata } from "next";
import Link from "next/link";
import { FileText, GraduationCap, Lightbulb, MessageCircleQuestion, MessageSquareText, ThumbsUp } from "lucide-react";
import { OwnerCommentActions } from "@/components/cv/CommentControls";
import { LearnerNoteActions } from "@/components/NoteControls";
import { PageHero } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { feedbackItems, groupFeedback, needsAttention, type FeedbackItem, type FeedbackStatus } from "@/lib/feedback";
import { KIND_LABEL, NOTE_KINDS, type NoteKind } from "@/lib/questionNoteText";

export const metadata: Metadata = { title: "Feedback — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const day = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const ICON = { suggestion: Lightbulb, praise: ThumbsUp, question: MessageCircleQuestion } as const;
const TONE: Record<NoteKind, string> = { suggestion: "border-sky-400/60 bg-sky-500/5", praise: "border-emerald-400/60 bg-emerald-500/5", question: "border-violet-400/60 bg-violet-500/5" };
const BAR: Record<NoteKind, string> = { suggestion: "bg-sky-400", praise: "bg-emerald-400", question: "bg-violet-400" };
const BADGE: Record<FeedbackStatus, string> = {
  new: "bg-amber-500/20 text-amber-800", open: "bg-amber-500/20 text-amber-800", read: "bg-black/10 text-slate-500",
  replied: "bg-sky-500/15 text-sky-700", done: "bg-emerald-500/15 text-emerald-700", dismissed: "bg-black/10 text-slate-500",
};
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? "border-indigo-400 bg-indigo-500/10 text-indigo-700" : "border-black/10 text-slate-600 hover:bg-black/5"}`;

type Q = { side?: string; kind?: string; show?: string };

/** Everything people have said to you (and, on the other tab, everything you have said to others), from exams and CVs, grouped, with each note as its own card. */
export default async function Feedback({ searchParams }: { searchParams: Promise<Q> }) {
  const me = await requireUser();
  const q = await searchParams;
  const side = q.side === "given" ? "given" : "received";
  const kind = NOTE_KINDS.find((k) => k === q.kind);
  const attention = q.show === "attention";

  const all = feedbackItems(me.id, side);
  const received = side === "received";
  const shown = all.filter((i) => (!kind || i.kind === kind) && (!attention || needsAttention(i)));
  const groups = groupFeedback(shown);
  const waiting = received ? all.filter(needsAttention).length : 0;
  const href = (o: Partial<Q>) => {
    const p = new URLSearchParams();
    const m = { side, kind: q.kind, show: q.show, ...o };
    for (const [k, v] of Object.entries(m)) if (v && !(k === "side" && v === "received")) p.set(k, v);
    const s = p.toString();
    return s ? `/feedback?${s}` : "/feedback";
  };
  const count = (k: NoteKind) => all.filter((i) => i.kind === k).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHero Icon={MessageSquareText} tone="sky" title="All your feedback" sub="Every note and comment in one place: on your exam answers and on your CV. See them grouped by where they were left, open any one for the full detail, and reply or mark it done right here." />

      <nav className="flex flex-wrap items-center gap-2" aria-label="Feedback view">
        <Link href={href({ side: "received", kind: undefined, show: undefined })} className={chip(received)} aria-current={received ? "page" : undefined}>Received</Link>
        <Link href={href({ side: "given", kind: undefined, show: undefined })} className={chip(!received)} aria-current={!received ? "page" : undefined}>Given by you</Link>
      </nav>

      {all.length === 0 ? (
        <p className="card p-4 text-sm text-slate-400">{received ? "No feedback yet. When a mentor or manager leaves a note on an exam answer or comments on your CV, it shows up here and in your notifications." : "You have not left any feedback yet. Mentors and managers can leave notes on exam answers and comment on CV drafts of the people they help."}</p>
      ) : (
        <>
          <section className="card space-y-3 p-4" aria-label="Summary">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span><b className="text-lg">{all.length}</b> {all.length === 1 ? "item" : "items"} in <b>{groupFeedback(all).length}</b> {groupFeedback(all).length === 1 ? "group" : "groups"}</span>
              {received && <span className={waiting ? "font-semibold text-amber-700" : "text-emerald-700"}>{waiting ? `${waiting} waiting for you` : "All caught up"}</span>}
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-black/5" role="img" aria-label={NOTE_KINDS.map((k) => `${count(k)} ${KIND_LABEL[k].toLowerCase()}`).join(", ")}>
              {NOTE_KINDS.map((k) => count(k) > 0 && <span key={k} className={BAR[k]} style={{ width: `${(count(k) / all.length) * 100}%` }} />)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={href({ kind: undefined })} className={chip(!kind)}>All kinds</Link>
              {NOTE_KINDS.map((k) => { const I = ICON[k]; return <Link key={k} href={href({ kind: k })} className={chip(kind === k)}><I size={12} className="mr-1 inline" aria-hidden />{KIND_LABEL[k]} · {count(k)}</Link>; })}
              {received && <Link href={href({ show: attention ? undefined : "attention" })} className={chip(attention)}>Waiting for me only</Link>}
            </div>
          </section>

          {groups.length === 0 && <p className="card p-4 text-sm text-slate-400">Nothing matches these filters. <Link href={href({ kind: undefined, show: undefined })} className="underline">Show everything</Link></p>}

          <div className="space-y-4">
            {groups.map((g) => {
              const GI = g.source === "cv" ? FileText : GraduationCap;
              return (
                <details key={g.key} open={g.needsAttention > 0 || groups.length <= 3} className="card group overflow-hidden">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/10 text-sky-700"><GI size={18} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{g.title}</span>
                      <span className="block text-xs text-slate-500">{g.sub} · latest {day(g.newest)}</span>
                    </span>
                    <span className="flex gap-1">{(["suggestion", "praise", "question"] as const).map((k) => { const n = g.items.filter((i) => i.kind === k).length; return n > 0 && <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BAR[k]}/30 bg-black/5`} title={KIND_LABEL[k]}>{n} {KIND_LABEL[k].toLowerCase()}</span>; })}</span>
                    {g.needsAttention > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-800">{g.needsAttention} new</span>}
                  </summary>
                  <ul className="space-y-3 border-t border-black/5 p-4">
                    {g.items.map((i) => <Item key={`${i.source}${i.id}`} i={i} received={received} />)}
                  </ul>
                </details>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Item({ i, received }: { i: FeedbackItem; received: boolean }) {
  const Icon = ICON[i.kind];
  return (
    <li id={`${i.source}-${i.id}`} className="space-y-2 text-sm">
      <p className="text-xs text-slate-500">{i.source === "exam" ? "On the question" : "On"}: <span className="font-medium text-slate-700">{i.about}</span></p>
      <div className={`space-y-1.5 rounded-lg border-l-4 p-2.5 ${TONE[i.kind]}`}>
        <div className="flex flex-wrap items-center gap-x-2 text-xs">
          <span className="inline-flex items-center gap-1 font-bold text-slate-700"><Icon size={13} aria-hidden />{KIND_LABEL[i.kind]}</span>
          <span className="text-slate-500">{received ? "from" : "to"} <b>{i.person}</b></span>
          <span className="text-slate-400">{day(i.createdAt)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${BADGE[i.status]}`}>{i.status}</span>
        </div>
        <p className="whitespace-pre-wrap">{i.body}</p>
        {i.reply && <p className="whitespace-pre-wrap rounded-md bg-black/5 p-2 text-xs"><b>{received ? "Your reply" : "Their reply"}:</b> {i.reply}</p>}
      </div>
      {received && i.source === "exam" && <LearnerNoteActions noteId={i.id} acked={!!i.acked} replied={!!i.replied} />}
      {received && i.source === "cv" && <OwnerCommentActions id={i.id} status={i.status === "done" || i.status === "dismissed" ? i.status : "open"} replied={i.status === "replied" || !!i.reply} />}
      <Link href={i.href} className="inline-block text-xs text-sky-700 underline">{i.source === "exam" ? (received ? "See it in your exam review" : "See it with their answers") : received ? "See it on your CV" : "Open their CV draft"}</Link>
    </li>
  );
}
