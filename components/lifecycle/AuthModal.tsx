"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import LoginForm from "@/app/(site)/login/login-form";
import SignUpForm from "@/app/(site)/signup/signup-form";
import ForgotForm from "@/app/(site)/forgot/form";

export type AuthMode = "login" | "signup" | "forgot";
/** What the server page supplies for the dialog: the social buttons (they depend on server config) and whether email can be sent. */
export type AuthKit = { login: ReactNode; signup: ReactNode; mailReady: boolean };

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])';

/** Sign in, create an account and "forgot password" as a dialog over the map, so the visitor keeps their place. The full pages still exist for links and emails. */
export function AuthModal({ mode, kit, next, onMode, onClose }: { mode: AuthMode; kit: AuthKit; next: string; onMode: (m: AuthMode) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);

  // focus moves in when the dialog opens and back to what opened it when it closes
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, []);
  // each form starts with the cursor in its first field
  useEffect(() => { box.current?.querySelector<HTMLElement>("input:not([type=hidden])")?.focus(); }, [mode]);

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const els = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={keys}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={mode === "login" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password"}
        className="relative max-h-[100svh] w-full overflow-y-auto rounded-t-2xl bg-[#fbfaf6] p-5 shadow-2xl sm:max-h-[92svh] sm:max-w-md sm:rounded-2xl sm:p-6">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-black/5 hover:text-slate-700"><X size={18} /></button>
        {/* signing in returns to the map; creating an account goes on to the first lesson, as it does everywhere else */}
        {mode === "login" && <LoginForm next={next} social={kit.login} onMode={onMode} />}
        {mode === "signup" && <SignUpForm social={kit.signup} onMode={onMode} />}
        {mode === "forgot" && <ForgotForm mailReady={kit.mailReady} onMode={onMode} />}
      </div>
    </div>
  );
}
