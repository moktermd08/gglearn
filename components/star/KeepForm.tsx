"use client";
import { type ReactNode, startTransition, useActionState } from "react";

type Res = { error?: string; done?: string } | null;
type Action = (prev: Res, fd: FormData) => Promise<Res>;

/**
 * A form that runs a server action and says what came back, and keeps what the person typed when the answer is an error. (React clears a form after
 * its action runs, even a refused one, which would wipe a long story because of one missing title.) The data is read from the form and sent
 * without the clearing.
 */
export function KeepForm({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form className={className} aria-busy={pending} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); startTransition(() => run(fd)); }}>
      {children}
      {state?.error && <p role="alert" className="mt-2 text-sm text-rose-600">{state.error}</p>}
      {state?.done && <p role="status" className="mt-2 text-sm text-emerald-700">{state.done}</p>}
    </form>
  );
}
