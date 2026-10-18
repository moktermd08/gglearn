"use client";
import { useActionState } from "react";
import { TriangleAlert, UserPlus } from "lucide-react";
import { createPerson } from "@/app/actions";
import { RoleInput } from "@/components/RoleInput";
import { ScopePicker } from "@/components/ScopePicker";
import { AccessSelect, type AccessChoice } from "@/components/AccessSelect";
import type { ScopeOptions } from "@/lib/paths";

export default function NewPerson({ options, roles, access = [] }: { options: ScopeOptions; roles: string[]; access?: AccessChoice[] }) {
  const [error, run, pending] = useActionState(createPerson, null);
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
  return (
    <form action={run} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
      <input name="name" placeholder="Name" required className={input} />
      <input name="email" type="email" placeholder="Email" required className={input} />
      <RoleInput roles={roles} id="new-roles" className={input} />
      <select name="audience" className={input} defaultValue="staff" aria-label="Staff or customer">
        <option value="staff">Staff</option>
        <option value="customer">Customer</option>
      </select>
      <AccessSelect choices={access} className={input} />
      <input name="password" type="password" placeholder="Temporary password" minLength={8} required className={input} autoComplete="new-password" />
      <ScopePicker options={options} />
      <button disabled={pending} className="btn !py-1.5 py-1.5 disabled:opacity-50"><UserPlus size={14} />{pending ? "Onboarding…" : "Onboard"}</button>
      {error && <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{error}</p>}
    </form>
  );
}
