"use client";
import { useActionState } from "react";
import { Save, TriangleAlert } from "lucide-react";
import { updateRole } from "@/app/actions";
import { RoleInput } from "@/components/RoleInput";

export default function RoleForm({ userId, jobRole, roles }: { userId: number; jobRole: string; roles: string[] }) {
  const [error, run, pending] = useActionState(updateRole, null);
  return (
    <form action={run} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <RoleInput roles={roles} id={`roles-${userId}`} defaultValue={jobRole} className="rounded border border-white/20 bg-[#fff] px-2 py-1" />
      <button disabled={pending} className="btn btn-ghost !px-3 !py-1 disabled:opacity-50"><Save size={14} />{pending ? "Saving…" : "Save role"}</button>
      {error && <p role="alert" className="flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{error}</p>}
    </form>
  );
}
