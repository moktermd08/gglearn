import { Share2 } from "lucide-react";
import { createShare } from "@/app/share/actions";
import type { ShareKind } from "@/lib/share";

/** Makes a public card for something you earned and opens it. Server-checked: nothing unearned can be shared. */
export function ShareButton({ kind, refKey, label = "Share", className = "" }: { kind: ShareKind; refKey: string; label?: string; className?: string }) {
  return (
    <form action={createShare.bind(null, kind, refKey)} className={className}>
      <button type="submit" className="inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:underline"><Share2 size={12} aria-hidden />{label}<span className="sr-only"> this achievement</span></button>
    </form>
  );
}
