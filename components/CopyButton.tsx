"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies text and says so for two seconds; if the clipboard is blocked the field next to it can still be selected by hand. */
export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={`btn btn-ghost !px-2.5 !py-1 text-xs ${className}`} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* select the field by hand */ }
    }}>{ok ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}{ok ? "Copied" : label}</button>
  );
}
