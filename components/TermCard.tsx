import { AlertTriangle, Brain, CheckCircle2, ClipboardCheck, GitCompare, Layers, Lightbulb, MapPin, Network, XCircle } from "lucide-react";
import { ConceptMap, GroupProgress, MemoryChart, RankLadder, Section, TestHistory, TopicIcon, topicHue } from "@/components/TermVisuals";
import { RANKS } from "@/lib/termsCore";
import type { RichCard } from "@/lib/termDetails";

const it = (s: string) => `It ${s.replace(/^it /i, "")}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The front of a card: what it is about and how advanced it is, without giving the meaning away. */
export function TermFront({ card }: { card: RichCard }) {
  const hue = topicHue(card.group);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-[#fff] shadow-sm" style={{ background: `linear-gradient(135deg, ${hue}, ${hue}cc)` }} aria-hidden><TopicIcon group={card.group} bank={card.detail.bank} size={30} /></span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            {card.detail.bank && <span className="rounded-full bg-black/5 px-2 py-0.5">{card.detail.bank}</span>}
            {card.group && <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: `${hue}14`, color: hue }}>{card.group}</span>}
          </p>
          <h2 className="mt-1 break-words text-2xl font-extrabold sm:text-3xl">{capital(card.term)}</h2>
          <p className="text-xs text-slate-400">{RANKS[card.tier - 1]} term</p>
        </div>
      </div>
      <RankLadder tier={card.tier} />
    </div>
  );
}

/** The back of a card: the meaning, then everything that helps it stick, each part with its own picture. */
export function TermBack({ card }: { card: RichCard }) {
  const { detail } = card, hue = topicHue(card.group);
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-2xl p-4" style={{ background: `${hue}12`, border: `1px solid ${hue}33` }}>
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: hue }}><Lightbulb size={14} aria-hidden />Meaning</p>
        <p className="mt-1 text-lg leading-snug">{card.meaning}</p>
      </div>

      {card.facts.length > 0 && (
        <Section Icon={CheckCircle2} title="Key facts" color="#047857">
          <ul className="grid gap-2 sm:grid-cols-2">
            {card.facts.map((f) => <li key={f} className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden /><span>{it(f)}</span></li>)}
          </ul>
        </Section>
      )}

      {card.useWhen && (
        <Section Icon={MapPin} title="In real work" color="#0369a1">
          <p className="rounded-xl border-l-4 border-sky-400 bg-sky-500/10 p-3">You would reach for <b>{card.term}</b> when you {card.useWhen}.</p>
        </Section>
      )}

      {card.mistakes.length > 0 && (
        <Section Icon={AlertTriangle} title={card.mistakes.length > 1 ? "Common mistakes" : "Common mistake"} color="#be123c">
          <ul className="space-y-2">
            {card.mistakes.map((m) => <li key={m} className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3"><XCircle size={16} className="mt-0.5 shrink-0 text-rose-300" aria-hidden /><span><b className="text-rose-300">Not true:</b> {it(m)}</span></li>)}
          </ul>
        </Section>
      )}

      {(detail.compare.length > 0 || detail.group.length > 1) && (
        <Section Icon={Network} title="How it connects" color="#9333ea"><ConceptMap term={card.term} detail={detail} selfId={card.id} hue={hue} /></Section>
      )}

      {detail.compare.length > 0 && (
        <Section Icon={GitCompare} title="Tell them apart" color="#b45309">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border-2 p-3" style={{ borderColor: hue }}><p className="font-bold" style={{ color: hue }}>{capital(card.term)}</p><p className="text-slate-300">{card.meaning}</p></div>
            {detail.compare.map((c) => <div key={c.id} className="rounded-xl border-2 border-dashed border-amber-400 p-3"><p className="font-bold text-amber-300">{capital(c.term)} <span className="text-[10px] font-normal text-slate-400">{RANKS[c.tier - 1]}</span></p><p className="text-slate-300">{c.meaning}</p></div>)}
          </div>
        </Section>
      )}

      <Section Icon={Brain} title="Your memory of it"><MemoryChart memory={detail.memory} /></Section>
      <Section Icon={ClipboardCheck} title="Your test results" color="#047857"><TestHistory history={detail.history} /></Section>
      {detail.group.length > 1 && <Section Icon={Layers} title={`Your progress in ${card.group || "this group"}`} color="#0369a1"><GroupProgress detail={detail} selfId={card.id} /></Section>}
    </div>
  );
}
