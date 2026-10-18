"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { Building2, Check, Plus, TriangleAlert } from "lucide-react";
import { createBrand, createCompany, createTrack, makeDirectoryToken, revokeDirectoryToken, saveCompanyBranding, saveCompanyLearningOrder, saveCompanySso, type SetupState } from "./actions";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

function Result({ state }: { state: SetupState }) {
  if (state?.error) return <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>;
  if (state?.done) return <p role="status" className="slide-in flex w-full items-center gap-1.5 text-emerald-400"><Check size={14} />{state.done}</p>;
  return null;
}

/** Runs the action, then clears the form once it worked so the same entry is not submitted twice. */
function useSetup(action: (s: SetupState, fd: FormData) => Promise<SetupState>, keep = false) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(async (s: SetupState, fd: FormData) => {
    const r = await action(s, fd);
    if (r?.done && !keep) ref.current?.reset();
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

export function BrandingForm({ company }: { company: { id: number; name: string; academyName: string; accent: string; certIssuer: string; certValidMonths: number; certSigner: string; certSignerTitle: string; entryMode: "off" | "customers"; entryText: string; leagueOpen: "no" | "yes"; slug: string; logoUrl: string | null } }) {
  const { ref, state, run, pending } = useSetup(saveCompanyBranding, true);
  return (
    <form ref={ref} action={run} className="card grid gap-3 p-4 text-sm md:grid-cols-3">
      <input type="hidden" name="companyId" value={company.id} />
      <h3 className="font-semibold md:col-span-3">{company.name}</h3>
      <label className="grid gap-1">Academy name
        <input name="academyName" defaultValue={company.academyName} placeholder="gglearn" maxLength={40} className={input} />
      </label>
      <label className="grid gap-1">Accent colour
        <span className="flex items-center gap-2">
          <input name="accent" type="color" defaultValue={company.accent || "#4f46e5"} className="h-8 w-12 cursor-pointer rounded border border-white/20" aria-label="Accent colour" />
          <span className="text-xs text-slate-400">Buttons and headings. Leave on the default shade to keep the standard look.</span>
        </span>
      </label>
      <label className="grid gap-1">Certificate issuer
        <input name="certIssuer" defaultValue={company.certIssuer} placeholder={company.name} maxLength={80} className={input} />
      </label>
      <label className="grid gap-1">Certificates stay valid for (months)
        <input name="certValidMonths" type="number" min={0} max={120} defaultValue={company.certValidMonths ?? 0} className={input} />
        <span className="text-xs text-slate-400">0 means never. Applies to certificates issued from now on; passing the level again within 60 days of expiry renews it.</span>
      </label>
      <label className="grid gap-1">Signed by
        <input name="certSigner" defaultValue={company.certSigner} placeholder="A name, printed on every new certificate" maxLength={60} className={input} />
      </label>
      <label className="grid gap-1">Signatory&apos;s title
        <input name="certSignerTitle" defaultValue={company.certSignerTitle} placeholder="Head of Learning" maxLength={60} className={input} />
      </label>
      <fieldset className="grid gap-2 rounded-xl border border-black/10 p-3 md:col-span-3">
        <legend className="px-1 text-sm font-semibold">Public page for customers</legend>
        <label className="flex items-start gap-2"><input type="checkbox" name="entryMode" value="customers" defaultChecked={company.entryMode === "customers"} className="mt-1" />
          <span>Let anyone create a customer account on a page in this company&apos;s look. They see only the customer-facing topics, never staff material.{company.entryMode === "customers" && <> Live at <a href={`/c/${company.slug}`} className="underline" target="_blank" rel="noopener noreferrer">/c/{company.slug}</a>.</>}</span></label>
        <label className="grid gap-1">Welcome line (optional)
          <input name="entryText" defaultValue={company.entryText} maxLength={280} placeholder="Getting started with our products, in short lessons and quick quizzes." className={input} /></label>
      </fieldset>
      <fieldset className="grid gap-2 rounded-xl border border-black/10 p-3 md:col-span-3">
        <legend className="px-1 text-sm font-semibold">Cross-company league</legend>
        <label className="flex items-start gap-2"><input type="checkbox" name="leagueOpen" value="yes" defaultChecked={company.leagueOpen === "yes"} className="mt-1" />
          <span>Let people here choose to play the weekly league against people from other companies. Each person decides for themselves and is off by default. Others see only their first name, an initial and points, never this company. Turning this off brings everyone back to your own league at once.</span></label>
      </fieldset>
      <div className="flex items-center gap-3 md:col-span-3">
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={`${company.name} logo`} className="h-10 w-10 rounded-lg border border-black/10 object-contain" />
        )}
        <label className="grid gap-1">Logo (PNG, JPEG or WebP, 150 KB at most)
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
        </label>
        {company.logoUrl && <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="removeLogo" />Remove logo</label>}
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Check size={14} />{pending ? "Saving…" : "Save branding"}</button>
        <Result state={state} />
      </div>
    </form>
  );
}

const ORDER_CHOICES = [
  { v: "choice", t: "Locked, learners can switch to any order", d: "The default. Later stages stay locked until earlier ones are passed, but a learner can choose to take their journey in any order." },
  { v: "hard", t: "Locked, learners cannot change it", d: "Later stages stay locked for everyone. Learners can still test out of a stage with a placement check." },
  { v: "soft", t: "Recommended order only", d: "Nothing is locked. The map and track pages still show the order that works best." },
] as const;

export function LearningOrderForm({ company }: { company: { id: number; name: string; journeyLock: "choice" | "hard" | "soft" } }) {
  const { ref, state, run, pending } = useSetup(saveCompanyLearningOrder, true);
  return (
    <form ref={ref} action={run} className="card grid gap-2 p-4 text-sm">
      <input type="hidden" name="companyId" value={company.id} />
      <h3 className="font-semibold">{company.name}</h3>
      {ORDER_CHOICES.map((c) => (
        <label key={c.v} className="flex items-start gap-2">
          <input type="radio" name="journeyLock" value={c.v} defaultChecked={company.journeyLock === c.v} className="mt-1" />
          <span><b>{c.t}</b><span className="block text-xs text-slate-400">{c.d}</span></span>
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn !py-1.5 disabled:opacity-50">{pending ? "Saving…" : "Save learning order"}</button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function SsoForm({ company, callback }: { company: { id: number; name: string; enabled: boolean; issuer: string; clientId: string; hasSecret: boolean; domains: string; jit: boolean; enforce: boolean; verified: boolean }; callback: string }) {
  const { ref, state, run, pending } = useSetup(saveCompanySso, true);
  // Submitted by hand, not as a form action: React clears a form after an action runs, and a mistake in the issuer must not wipe out the secret just typed.
  // method=post so that a submit before the page is ready can never put the secret in the address bar.
  const [, start] = useTransition();
  const [v, setV] = useState({ issuer: company.issuer, clientId: company.clientId, clientSecret: "", domains: company.domains, enabled: company.enabled, jit: company.jit, enforce: company.enforce });
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); if (state?.done) setV((p) => ({ ...p, clientSecret: "" })); } // once saved, the secret is not left sitting in the field
  const text = (k: "issuer" | "clientId" | "clientSecret" | "domains") => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value })) });
  const tick = (k: "enabled" | "jit" | "enforce") => ({ name: k, value: "yes", checked: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.checked })) });
  return (
    <form ref={ref} method="post" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => run(fd)); }} className="card grid gap-3 p-4 text-sm md:grid-cols-2">
      <input type="hidden" name="companyId" value={company.id} />
      <h3 className="font-semibold md:col-span-2">{company.name}{company.verified && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">tested</span>}</h3>
      <p className="text-xs text-slate-400 md:col-span-2">In your provider (Okta, Microsoft Entra ID, Google Workspace, Auth0, Keycloak or any OpenID Connect provider) create a web application and give it this redirect address: <code className="select-all rounded bg-black/5 px-1">{callback}</code></p>
      <label className="grid gap-1">Issuer<input {...text("issuer")} placeholder="https://login.example.com" className={input} /></label>
      <label className="grid gap-1">Client ID<input {...text("clientId")} autoComplete="off" className={input} /></label>
      <label className="grid gap-1">Client secret<input {...text("clientSecret")} type="password" autoComplete="new-password" placeholder={company.hasSecret ? "Saved (leave blank to keep it)" : ""} className={input} /></label>
      <label className="grid gap-1">Email domains of your people<input {...text("domains")} placeholder="example.com, example.co.uk" className={input} /></label>
      <label className="flex items-start gap-2 md:col-span-2"><input type="checkbox" {...tick("enabled")} className="mt-1" /><span>Switch single sign-on on. People then see &ldquo;Sign in with your company&rdquo; and use the email address on one of the domains above.</span></label>
      <label className="flex items-start gap-2 md:col-span-2"><input type="checkbox" {...tick("jit")} className="mt-1" /><span>Create an account the first time someone from those domains signs in (a learner in this company). Leave off if directory sync or invitations add your people.</span></label>
      <label className="flex items-start gap-2 md:col-span-2"><input type="checkbox" {...tick("enforce")} className="mt-1" /><span>Require it: learners and managers here can no longer sign in with a password or an emailed link. Admins keep their password. {company.verified ? "" : "Available after your first successful sign-in through it."}</span></label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2"><button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Check size={14} />{pending ? "Saving…" : "Save single sign-on"}</button><Result state={state} /></div>
    </form>
  );
}

export function DirectoryForm({ company, tokens, endpoint }: { company: { id: number; name: string }; tokens: { id: number; label: string; createdAt: number; lastUsedAt: number | null }[]; endpoint: string }) {
  const { ref, state, run, pending } = useSetup(makeDirectoryToken);
  const day = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <div className="card space-y-3 p-4 text-sm">
      <h3 className="font-semibold">{company.name}</h3>
      <p className="text-xs text-slate-400">In your directory, add a SCIM 2.0 app with this base URL and a bearer token: <code className="select-all rounded bg-black/5 px-1">{endpoint}</code></p>
      {tokens.length > 0 && <ul className="space-y-1">{tokens.map((t) => (
        <li key={t.id} className="flex items-center gap-2"><span className="flex-1">{t.label || "Token"} <span className="text-xs text-slate-400">made {day(t.createdAt)}{t.lastUsedAt ? `, last used ${day(t.lastUsedAt)}` : ", never used"}</span></span>
          <form action={revokeDirectoryToken.bind(null, company.id, t.id)}><button className="text-xs text-slate-400 underline">Revoke</button></form></li>))}</ul>}
      <form ref={ref} action={run} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="companyId" value={company.id} />
        <input name="label" maxLength={60} placeholder="Label, like Okta" aria-label="Token label" className={input} />
        <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Plus size={14} />{pending ? "Making…" : "Make a token"}</button>
        <Result state={state} />
      </form>
    </div>
  );
}
