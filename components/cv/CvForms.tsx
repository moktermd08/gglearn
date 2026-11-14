"use client";
import { type ReactNode, useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";

type Res = { error?: string; done?: string } | null;
type Action = (prev: Res, fd: FormData) => Promise<Res>;

/** A form that runs a server action and says what came back. It is cleared only when it succeeded, so a refused one keeps what was typed. */
export function CvForm({ action, children, className, resetOnDone = false }: { action: Action; children: ReactNode; className?: string; resetOnDone?: boolean }) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (resetOnDone && state?.done) ref.current?.reset(); }, [state, resetOnDone]);
  return (
    <form ref={ref} action={run} className={className} aria-busy={pending}>
      {children}
      {state?.error && <p role="alert" className="mt-2 text-sm text-rose-600">{state.error}</p>}
      {state?.done && <p role="status" className="mt-2 text-sm text-emerald-700">{state.done}</p>}
    </form>
  );
}

/** One button that does one thing to one thing (hide, move, remove, revoke), with the answer shown beside it. */
export function InlineAction({ action, fields, label, tone = "plain", confirm }: { action: Action; fields: Record<string, string | number>; label: string; tone?: "plain" | "danger"; confirm?: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="inline-flex items-center gap-1.5" onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button disabled={pending} className={`rounded-md border px-2 py-0.5 text-xs font-semibold transition disabled:opacity-50 ${tone === "danger" ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-black/10 text-slate-600 hover:bg-black/5"}`}>{label}</button>
      {state?.error && <span role="alert" className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}

/** Puts a suggested text into the field of the same form, for the person to edit. It saves nothing by itself. */
export function UseSuggestion({ field, text, label = "Use this" }: { field: string; text: string; label?: string }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 underline" onClick={(e) => {
      const el = (e.currentTarget.closest("form")?.elements.namedItem(field) ?? null) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) return;
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
      set?.call(el, text); el.dispatchEvent(new Event("input", { bubbles: true })); el.focus();
    }}><Sparkles size={12} aria-hidden />{label}</button>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-black/15 bg-[#fff] px-2 py-1 font-mono text-xs text-slate-700" />
      <button type="button" className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-black/5" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* select it by hand */ } }}>
        {copied ? <Check size={13} className="text-emerald-600" aria-hidden /> : <Copy size={13} aria-hidden />}{copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
