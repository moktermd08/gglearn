import { ArrowLeftRight, CircleHelp, CircleOff, FileQuestion, GitCompare, ListChecks, MapPin, TextCursorInput, ToggleLeft, type LucideIcon } from "lucide-react";
import type { Form } from "@/lib/termQuestions";

/** How a term question looks, shared by the exam and its results. */

const KIND: Record<Form, { label: string; Icon: LucideIcon; color: string }> = {
  "term-from-meaning": { label: "Name the term", Icon: CircleHelp, color: "#4338ca" },
  "meaning-from-term": { label: "What it means", Icon: FileQuestion, color: "#4338ca" },
  "true-false": { label: "True or false", Icon: ToggleLeft, color: "#075985" },
  cloze: { label: "Fill the gap", Icon: TextCursorInput, color: "#065f46" },
  contrast: { label: "Tell them apart", Icon: ArrowLeftRight, color: "#92400e" },
  scenario: { label: "In practice", Icon: MapPin, color: "#075985" },
  "true-statement": { label: "Which is true", Icon: ListChecks, color: "#065f46" },
  "not-true": { label: "Spot the false one", Icon: CircleOff, color: "#9f1239" },
  difference: { label: "The difference", Icon: GitCompare, color: "#7e22ce" },
};
export const kindOf = (form: string) => KIND[form as Form] ?? { label: "Question", Icon: CircleHelp, color: "#4338ca" };

export function KindTag({ form }: { form: string }) {
  const { label, Icon, color } = kindOf(form);
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${color}14`, color }}><Icon size={13} aria-hidden />{label}</span>;
}

const Gap = () => <span className="mx-0.5 inline-block w-24 translate-y-1 border-b-4 border-dashed border-indigo-500 align-baseline"><span className="sr-only">blank</span></span>;
const withGaps = (s: string) => s.split("_____").flatMap((part, i) => (i ? [<Gap key={i} />, part] : [part]));

/** The question's words. A quoted statement is set apart from the asking, and a blank is drawn as a gap. */
export function Prompt({ text, large }: { text: string; large?: boolean }) {
  const quoted = /^([^“]*)“(.+)”([^”]*)$/.exec(text);
  const size = large ? "text-xl font-bold leading-snug sm:text-2xl" : "font-semibold";
  if (!quoted) return <span className={size}>{withGaps(text)}</span>;
  const [, ask, quote, tail] = quoted;
  return (
    <span className="block space-y-2">
      {(ask + tail).trim() && <span className={`block ${large ? "text-base text-slate-300" : "text-sm text-slate-300"}`}>{`${ask} ${tail}`.trim()}</span>}
      <span className={`block rounded-xl border-l-4 border-indigo-400 bg-indigo-500/10 ${large ? "p-4" : "p-3"} ${size}`}>{withGaps(quote)}</span>
    </span>
  );
}

export const letter = (i: number) => String.fromCharCode(65 + i);
