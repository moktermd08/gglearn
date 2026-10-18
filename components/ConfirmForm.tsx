"use client";
import type { ReactNode } from "react";

/** A form whose button asks "are you sure?" first, for actions that cannot be undone. */
export function ConfirmForm({ action, message, children, className = "" }: { action: () => void | Promise<void>; message: string; children: ReactNode; className?: string }) {
  return <form action={action} className={className} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</form>;
}
