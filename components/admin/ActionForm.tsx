"use client";
import { type FormEvent, type ReactNode, startTransition, useActionState, useEffect, useRef } from "react";
import { Banner } from "@gg/ui";
import type { SetupState } from "@/lib/setup";

/**
 * A form that runs a server action and shows what came back (the error, or what was done) under its fields.
 * React clears a form after its action runs, which would wipe what someone typed when the action refuses it. So the action is
 * run from onSubmit instead, and the form is cleared only when it succeeded.
 */
export function ActionForm({ action, children, className, style }: {
  action: (prev: SetupState, fd: FormData) => Promise<SetupState>; children: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.done) ref.current?.reset(); }, [state]);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); // the submitter carries the button's name and value (the profile's "intent")
    startTransition(() => run(fd));
  };
  return (
    <form ref={ref} onSubmit={submit} className={className} style={style}>
      {children}
      {state?.error && <div role="alert" style={{ gridColumn: "1 / -1" }}><Banner tone="bad" icon="alert">{state.error}</Banner></div>}
      {state?.done && <div role="status" style={{ gridColumn: "1 / -1" }}><Banner tone="ok" icon="check">{state.done}</Banner></div>}
    </form>
  );
}
