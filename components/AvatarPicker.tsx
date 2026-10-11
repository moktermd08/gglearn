"use client";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, Palette, X } from "lucide-react";
import { Avatar, LOOK_ICON } from "@/components/Avatar";
import { setAvatarLook } from "@/app/actions";

type Props = { me: string; rival: string; photoUrl: string | null; signedIn: boolean; level?: number; rivalLevel?: number; rivalHue?: number; className?: string };

/** "Choose your look" button and dialog: pick who you are and who you race. Guests are remembered on this device, signed-in people on their account. */
export function AvatarPicker({ me, rival, photoUrl, signedIn, level = 6, rivalLevel = 6, rivalHue, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<"me" | "rival">("me");
  const [pending, start] = useTransition();
  const [local, setLocal] = useState({ me, rival });
  const current = local[who];
  const pick = (look: string) => { setLocal((l) => ({ ...l, [who]: look })); start(() => setAvatarLook(who, look)); };
  const options = ["default", ...Object.keys(LOOK_ICON), ...(who === "me" && photoUrl ? ["photo"] : [])];
  const preview = (look: string, size = 56) => who === "me"
    ? <Avatar kind="human" level={level} size={size} look={look} photoUrl={photoUrl} />
    : <Avatar kind="rival" level={rivalLevel} hue={rivalHue} size={size} look={look} />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#fff] px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-indigo-400 hover:text-indigo-300 ${className}`}><Palette size={13} />Choose your look</button>
      {open && createPortal( // only ever true after a click, so `document` exists
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }} role="dialog" aria-modal="true" aria-label="Choose your look">
          <div className="pop max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#fff] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Make it personal</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5"><X size={18} /></button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-black/5 p-1 text-sm font-semibold" role="tablist">
              {(["me", "rival"] as const).map((w) => (
                <button key={w} type="button" role="tab" aria-selected={who === w} onClick={() => setWho(w)} className={`flex items-center justify-center gap-2 rounded-lg py-1.5 transition ${who === w ? "bg-[#fff] shadow" : "text-slate-400"}`}>
                  {w === "me" ? <Avatar kind="human" level={level} size={22} look={local.me} photoUrl={photoUrl} /> : <Avatar kind="rival" level={rivalLevel} hue={rivalHue} size={22} look={local.rival} />}
                  {w === "me" ? "You" : "Your rival"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={who === "me" ? "Your look" : "Rival look"}>
              {options.map((k) => {
                const on = current === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => pick(k)} className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition ${on ? "border-indigo-400 bg-indigo-500/10" : "border-black/10 hover:border-black/30"}`}>
                    {preview(k, 44)}
                    <span className="text-slate-300">{k === "default" ? (who === "me" ? "Fighter" : "Robot") : k === "photo" ? "My photo" : LOOK_ICON[k]?.label}</span>
                    {on && <Check size={14} className="absolute right-1 top-1 text-indigo-300" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {signedIn ? <>Saved to your account.{who === "me" && !photoUrl && <> Want your own face? <Link href="/profile" className="underline">Upload a photo</Link>.</>}</> : <>Saved on this device. <Link href="/login" className="underline">Sign in</Link> to keep it everywhere and use your own photo.</>}
              {pending && " Saving…"}
            </p>
            <div className="mt-4 flex justify-end"><button type="button" onClick={() => setOpen(false)} className="btn">Done</button></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
