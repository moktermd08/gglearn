import type { ReactNode } from "react";
import { BadgeCheck, Swords } from "lucide-react";
import { DEFAULT_LOOK, type Look } from "@/lib/brand";

/** Ornamental certificate sheet shared by both public certificate pages. `hue` tints the border, seal and corners. */
export function CertFrame({ hue, seal, children, code, look = DEFAULT_LOOK, signer }: { hue: number; seal: ReactNode; children: ReactNode; code: string; look?: Look; signer?: { name: string; title: string } }) {
  const c = `hsl(${hue} 70% 48%)`, soft = `hsl(${hue} 80% 60%)`;
  const corner = (cls: string) => (
    <svg viewBox="0 0 60 60" className={`pointer-events-none absolute h-14 w-14 ${cls}`} aria-hidden>
      <path d="M4 56V18Q4 4 18 4H56" fill="none" stroke={c} strokeWidth="2.5" /><path d="M12 56V24Q12 12 24 12H56" fill="none" stroke={c} strokeOpacity=".4" strokeWidth="1.2" /><circle cx="4" cy="4" r="3.5" fill={c} />
    </svg>
  );
  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-[#fff] p-3 shadow-xl print:shadow-none" style={{ boxShadow: `0 30px 70px -30px ${soft}` }}>
      <div className="relative rounded-xl border-2 px-6 pb-16 pt-10 text-center sm:px-12" style={{
        borderColor: c,
        backgroundImage: `radial-gradient(circle at 50% 0%, hsl(${hue} 90% 60% / .12), transparent 55%), repeating-radial-gradient(circle at 50% 120%, transparent 0 14px, hsl(${hue} 60% 50% / .05) 14px 15px)`,
      }}>
        {corner("left-2 top-2")}{corner("right-2 top-2 rotate-90")}{corner("bottom-2 right-2 rotate-180")}{corner("bottom-2 left-2 -rotate-90")}
        <div className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-[.35em] text-slate-400">{look.logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={look.logo} alt="" className="h-6 w-6 object-contain" />
          : <Swords size={14} />}{look.name === DEFAULT_LOOK.name ? "gglearn academy" : look.name}</div>
        <div className="pop relative mx-auto mt-5 grid h-28 w-28 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden>
            <circle cx="50" cy="50" r="46" fill={`hsl(${hue} 90% 60% / .12)`} stroke={c} strokeWidth="1.5" strokeDasharray="2 3" className="march" />
            <circle cx="50" cy="50" r="38" fill="none" stroke={c} strokeOpacity=".5" />
          </svg>
          <div className="relative">{seal}</div>
        </div>
        {children}
        <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-end gap-4 px-4 text-xs text-slate-400 sm:px-8">
          <div><div className="border-b border-slate-300 pb-1 font-serif text-lg italic text-slate-300">{signer?.name || (look.company ? look.issuer : "gglearn")}</div>{signer?.name ? `${signer.title ? `${signer.title}, ` : ""}${look.company ? look.issuer : "gglearn"}` : look.company ? "Issued by" : "Issued by the academy"}</div>
          <BadgeCheck size={34} style={{ color: c }} aria-label="Verified" />
          <div><div className="break-all border-b border-slate-300 pb-1 font-mono text-sm text-slate-300">{code}</div>Verification code</div>
        </div>
      </div>
    </div>
  );
}
