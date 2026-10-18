"use client";
import { useActionState } from "react";
import Link from "next/link";
import { CircleCheck, Info, Mail, Send, TriangleAlert } from "lucide-react";
import { requestSignInLink } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";

export default function SignInLinkForm({ mailReady, next }: { mailReady: boolean; next: string }) {
  const [res, run, pending] = useActionState(requestSignInLink, null);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  return (
    <AuthShell title="No password needed." lead="Tell us your email and we will send a link that signs you in.">
      {res === "ok" ? (
        <div className="space-y-3 text-center">
          <CircleCheck size={34} className="mx-auto text-emerald-500" />
          <h1 className="text-xl font-extrabold">Check your email</h1>
          <p className="text-sm text-slate-300">If that address has an account, a sign-in link is on its way. It works once and lasts 15 minutes. Open it and press the button. Look in your spam folder if it does not arrive in a few minutes.</p>
          <Link href="/login" className="btn btn-ghost">Back to sign in</Link>
        </div>
      ) : (
        <form action={run} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <div className="flex items-center gap-2"><Send className="text-indigo-400" /><h1 className="text-xl font-extrabold">Email me a sign-in link</h1></div>
          {!mailReady && <p role="status" className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-700"><Info size={14} className="mt-0.5 shrink-0" />This server cannot send email yet, so a link cannot be sent. Sign in with your password instead.</p>}
          <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input name="email" type="email" placeholder="Your email" required className={`${input} !pl-9`} autoComplete="email" /></div>
          {res && <p role="alert" className="flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{res}</p>}
          <button disabled={pending} className="btn disabled:opacity-50"><Send size={16} />{pending ? "Sending…" : "Send me a link"}</button>
          <p className="text-center text-sm text-slate-400">Prefer a password? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-indigo-300 underline">Sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
