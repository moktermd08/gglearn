"use client";
import { useActionState, useRef } from "react";
import { Building2, Check, Plus, TriangleAlert } from "lucide-react";
import { createBrand, createCompany, createTrack, type SetupState } from "./actions";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

function Result({ state }: { state: SetupState }) {
  if (state?.error) return <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>;
  if (state?.done) return <p role="status" className="slide-in flex w-full items-center gap-1.5 text-emerald-400"><Check size={14} />{state.done}</p>;
  return null;
}

/** Runs the action, then clears the form once it worked so the same entry is not submitted twice. */
function useSetup(action: (s: SetupState, fd: FormData) => Promise<SetupState>) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(async (s: SetupState, fd: FormData) => {
    const r = await action(s, fd);
    if (r?.done) ref.current?.reset();
    return r;
  }, null);
  return { ref, state, run, pending };
}

export function CompanyForm() {
  const { ref, state, run, pending } = useSetup(createCompany);
  return (
    <form ref={ref} action={run} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
      <input name="name" placeholder="Company name" required minLength={2} maxLength={80} className={input} aria-label="Company name" />
      <input name="tagline" placeholder="Tagline (optional)" maxLength={160} className={`${input} min-w-64`} aria-label="Tagline" />
      <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Building2 size={14} />{pending ? "Adding…" : "Add company"}</button>
      <Result state={state} />
    </form>
  );
}

export function BrandForm({ companies }: { companies: { id: number; name: string }[] }) {
  const { ref, state, run, pending } = useSetup(createBrand);
  if (!companies.length) return <p className="card p-4 text-sm text-slate-400">Add a company first.</p>;
  return (
    <form ref={ref} action={run} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
      <select name="companyId" required className={input} aria-label="Company">
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input name="name" placeholder="Brand name" required minLength={2} maxLength={80} className={input} aria-label="Brand name" />
      <input name="tagline" placeholder="Tagline (optional)" maxLength={160} className={`${input} min-w-64`} aria-label="Tagline" />
      <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Plus size={14} />{pending ? "Adding…" : "Add brand"}</button>
      <Result state={state} />
    </form>
  );
}

export function TrackForm({ brands }: { brands: { id: number; name: string; company: string }[] }) {
  const { ref, state, run, pending } = useSetup(createTrack);
  if (!brands.length) return <p className="card p-4 text-sm text-slate-400">Add a brand first.</p>;
  return (
    <form ref={ref} action={run} className="card grid gap-3 p-4 text-sm md:grid-cols-3">
      <label className="grid gap-1">Brand
        <select name="brandId" required className={input}>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.company} · {b.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 md:col-span-2">Track name
        <input name="name" placeholder="e.g. Selling our services" required minLength={2} maxLength={80} className={input} />
      </label>
      <label className="grid gap-1 md:col-span-3">What it teaches
        <input name="description" placeholder="One sentence" maxLength={500} className={input} />
      </label>
      <label className="grid gap-1">Kind
        <select name="kind" defaultValue="process" className={input}>
          {["subject", "product", "service", "tool", "technology", "process"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <label className="grid gap-1">Applies to
        <select name="scope" defaultValue="brand" className={input}>
          <option value="brand">This brand&rsquo;s people</option>
          <option value="company">Everyone in the company</option>
        </select>
      </label>
      <label className="grid gap-1">Who may take it
        <select name="audience" defaultValue="staff" className={input}>
          <option value="staff">Staff</option>
          <option value="customer">Customers</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label className="grid gap-1">Required for
        <select name="tier" defaultValue="growth" className={input}>
          <option value="growth">Nobody (optional)</option>
          <option value="role">The job roles listed</option>
          <option value="mandatory">Everyone it applies to</option>
        </select>
      </label>
      <label className="grid gap-1">Job roles (comma separated)
        <input name="roles" placeholder="sales, support" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">Pass level
          <input name="requiredLevel" type="number" min={1} max={20} defaultValue={5} className={input} />
        </label>
        <label className="grid gap-1">Due (days)
          <input name="dueDays" type="number" min={1} max={365} defaultValue={30} className={input} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Plus size={14} />{pending ? "Adding…" : "Add track"}</button>
        <Result state={state} />
      </div>
    </form>
  );
}
