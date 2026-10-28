"use client";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Download, FileUp, Info, KeyRound, Link2, ListPlus, Mail, Plus, TriangleAlert, UserPlus, Users, X } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { bulkInvite, createInvite, createJoinLink, createPerson, type InviteState } from "@/app/actions";
import { MAX_BULK } from "@/lib/bulkInvite";
import { DEFAULT_LINK_DAYS, DEFAULT_LINK_USES, MAX_LINK_DAYS, MAX_LINK_USES } from "@/lib/joinLinks-shared";
import { type PlaceTree, summarisePlaces, tidyScopes } from "@/lib/placeSummary";
import type { Level } from "@/lib/accessLevel";
import type { Scope } from "@/lib/paths";
import { AccessCards, type AccessChoice, LEARNER } from "./access-cards";
import { PlacePicker } from "./place-picker";
import { type PlanPreview, previewPlan } from "./actions";

type Method = "one" | "list" | "link" | "account";
const METHODS: { key: Method; Icon: typeof Mail; title: string; blurb: string }[] = [
  { key: "one", Icon: Mail, title: "One person, or a few", blurb: "We make each person a sign-up link, and can email it." },
  { key: "list", Icon: ListPlus, title: "A list", blurb: `Paste or upload up to ${MAX_BULK} people, each with their own role if you like.` },
  { key: "link", Icon: Link2, title: "A team link", blurb: "One link to post in a team chat. They make their own accounts." },
  { key: "account", Icon: UserPlus, title: "Create the account myself", blurb: "You choose a temporary password and pass it on." },
];
const STEPS = ["Who", "What they do", "Where they belong", "Check and add"];
const MAX_ONE_BY_ONE = 25; // the server's limit for the few-at-a-time form; it checks again
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const ROLE = /^[a-z][a-z0-9 &/-]{0,39}$/; // what a list or a team link accepts; the single forms accept any role up to 40 characters
const input = "rounded border border-white/20 bg-[#fff] px-2 py-1.5";

/** The note a manager sends: who invited them, to what, and the one link. Written so it makes sense with nothing around it. */
function inviteMessage(m: { from: string; where: string; role: string; access: string }, link: string) {
  return {
    subject: `${m.from} invited you to gglearn`,
    body: `Hi,\n\n${m.from} has invited you to join ${m.where} on gglearn as ${m.role}${m.access === "learner" ? "" : ` (with ${m.access} access)`}.\n\nCreate your account here (the link works once and expires in 7 days):\n${link}\n\nSee you there.`,
  };
}

type Done =
  | { kind: "invites"; state: NonNullable<InviteState> }
  | { kind: "link"; url: string }
  | { kind: "account"; name: string; email: string };

/**
 * One way to add people: choose how (one or a few, a list, a team link, or an account you make yourself), then who, what they do, where they belong,
 * and a check of exactly what they will get and be required to learn. It runs the same four actions the old forms did, with the same fields, so every
 * permission rule is the server's: this only offers what the signed-in person may grant and says so in plain words. Nothing is sent until "Add".
 */
export default function AddPeople({ tree, roles, access, mailReady, origin, defaultOpen = false }: { tree: PlaceTree; roles: string[]; access: AccessChoice[]; mailReady: boolean; origin: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>("one");
  const [emails, setEmails] = useState(""), [csv, setCsv] = useState(""), [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [label, setLabel] = useState(""), [maxUses, setMaxUses] = useState(String(DEFAULT_LINK_USES)), [days, setDays] = useState(String(DEFAULT_LINK_DAYS));
  const [jobRole, setJobRole] = useState(""), [audience, setAudience] = useState<"staff" | "customer">("staff"), [level, setLevel] = useState<Level>("learner");
  const [places, setPlaces] = useState<Scope[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanPreview | "loading" | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const learnerOnly = method === "link" || audience === "customer"; // team links and customers can never carry more than learner access
  const effective: Level = learnerOnly ? "learner" : level;
  const placeText = summarisePlaces(tree, places).text;
  const scopesText = tidyScopes(tree, places).map((s) => `${s.kind}:${s.id}`).join(",");
  const role = jobRole.trim().toLowerCase();
  const levelInfo = [LEARNER, ...access].find((a) => a.key === effective)!;

  /** What is wrong with this step, in words, or null. The server checks everything again; this just saves a round trip and says it near the field. */
  const check = (s: number): string | null => {
    if (s === 0) {
      if (method === "one") {
        const list = [...new Set(emails.toLowerCase().split(/[\s,;]+/).filter(Boolean))];
        if (!list.length) return "Enter at least one email address.";
        const bad = list.find((e) => !EMAIL.test(e));
        if (bad) return `"${bad}" does not look like an email address.`;
        if (list.length > MAX_ONE_BY_ONE) return `That is ${list.length} people. Up to ${MAX_ONE_BY_ONE} at a time here; use "A list" for more.`;
      }
      if (method === "list" && !csv.trim() && !file) return "Paste your list, or choose a file.";
      if (method === "account") {
        if (!name.trim()) return "Enter their name.";
        if (!EMAIL.test(email.trim())) return "Enter a valid email address.";
        if (password.length < 8) return "A temporary password needs at least 8 characters.";
      }
      if (method === "link") {
        const u = Number(maxUses), d = Number(days);
        if (!Number.isInteger(u) || u < 1 || u > MAX_LINK_USES) return `Places: a whole number from 1 to ${MAX_LINK_USES}.`;
        if (!Number.isInteger(d) || d < 1 || d > MAX_LINK_DAYS) return `Days: a whole number from 1 to ${MAX_LINK_DAYS}.`;
      }
    }
    if (s === 1) {
      if (!role) return method === "list" ? "Enter the role to use for any line that does not give one." : "Enter their role, for example developer or sales.";
      if (role.length > 40) return "A role is up to 40 characters.";
      if ((method === "list" || method === "link") && !ROLE.test(role)) return "Use letters, numbers, spaces, & / or - only, starting with a letter.";
    }
    if (s === 2 && !tidyScopes(tree, places).length) return "Pick at least one company, brand or project.";
    return null;
  };

  const go = async (to: number) => {
    setDone(null);
    if (to > step) { for (let s = step; s < to; s++) { const p = check(s); if (p) { setProblem(p); setStep(s); return; } } }
    setProblem(null); setStep(to);
    if (to === 3) {
      setPlan("loading");
      try { setPlan(await previewPlan({ jobRole: role, audience, scopes: scopesText })); } catch { setPlan({ error: "Could not work out what they would be required to learn. You can still add them." }); }
    }
    top.current?.scrollIntoView({ block: "nearest" });
  };

  const submit = () => {
    for (let s = 0; s < 3; s++) { const p = check(s); if (p) { setProblem(p); setStep(s); return; } }
    setProblem(null);
    const fd = new FormData();
    fd.set("jobRole", role); fd.set("audience", audience); fd.set("access", effective);
    for (const s of tidyScopes(tree, places)) fd.append("scope", `${s.kind}:${s.id}`);
    if (mailReady && sendEmail) fd.set("sendEmail", "on");
    start(async () => {
      try {
        if (method === "one") { fd.set("emails", emails); const r = await createInvite(null, fd); r?.error || !r?.invites ? setProblem(r?.error ?? "Nothing was created.") : setDone({ kind: "invites", state: r }); }
        else if (method === "list") { fd.set("csv", csv); if (file) fd.set("file", file); const r = await bulkInvite(null, fd); r?.error || !r?.invites ? setProblem(r?.error ?? "Nothing was created.") : setDone({ kind: "invites", state: r }); }
        else if (method === "link") { fd.set("label", label); fd.set("maxUses", maxUses); fd.set("days", days); const r = await createJoinLink(null, fd); r?.error || !r?.path ? setProblem(r?.error ?? "Nothing was created.") : setDone({ kind: "link", url: `${origin}${r.path}` }); }
        else { fd.set("name", name); fd.set("email", email); fd.set("password", password); const r = await createPerson(null, fd); r ? setProblem(r) : setDone({ kind: "account", name: name.trim(), email: email.trim().toLowerCase() }); }
      } catch { setProblem("Something went wrong. Nothing was sent twice: check the list below, then try again."); }
    });
  };

  const again = () => { setDone(null); setStep(0); setEmails(""); setCsv(""); setFile(null); setName(""); setEmail(""); setPassword(""); setLabel(""); setPlan(null); setProblem(null); };

  if (!open) {
    return (
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600"><UserPlus size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1"><h2 className="font-bold">Add people</h2><p className="text-sm text-slate-400">One person, a whole list, a team link, or an account you make yourself. You choose what they do and where they belong; we show what they will get first.</p></div>
        <button type="button" className="btn" onClick={() => setOpen(true)}><Plus size={16} />Add people</button>
      </div>
    );
  }

  return (
    <section className="card space-y-4 p-4 text-sm" aria-labelledby="add-title" ref={top}>
      <div className="flex items-center gap-2">
        <h2 id="add-title" className="flex-1 text-lg font-bold">Add people</h2>
        <button type="button" className="btn btn-ghost !px-3 !py-1" onClick={() => setOpen(false)}><X size={14} />Close</button>
      </div>
      <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Steps">
        {STEPS.map((t, i) => (
          <li key={t}>
            <button type="button" disabled={!!done} aria-current={i === step ? "step" : undefined} onClick={() => go(i)} className={`rounded-full px-3 py-1 font-semibold ${i === step ? "bg-indigo-600 text-[#fff]" : i < step ? "bg-indigo-500/15 text-indigo-800" : "bg-black/5 text-slate-400"}`}>{i + 1}. {t}</button>
          </li>
        ))}
      </ol>

      {done ? <Result done={done} onAgain={again} mailReady={mailReady} /> : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (step < 3) go(step + 1); else submit(); }} className="space-y-4">
          {step === 0 && (
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-2 font-semibold">How do you want to add them?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {METHODS.map(({ key, Icon, title, blurb }) => (
                    <label key={key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${method === key ? "border-indigo-500 bg-indigo-500/10" : "border-black/10 hover:bg-black/5"}`}>
                      <input type="radio" name="method" value={key} checked={method === key} onChange={() => { setMethod(key); setProblem(null); }} className="mt-1" />
                      <span><span className="flex items-center gap-1.5 font-semibold"><Icon size={14} aria-hidden />{title}</span><span className="block text-xs text-slate-400">{blurb}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {method === "one" && <Field label="Their email addresses" hint="One, or a whole team separated by commas or new lines."><textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} className={`${input} w-full`} autoComplete="off" /></Field>}
              {method === "list" && (
                <div className="space-y-2">
                  <Field label="The list" hint="One person per line, as email or email,role. A spreadsheet saved as CSV works as it is."><textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} placeholder={"ana@example.com,designer\nben@example.com,sales"} className={`${input} w-full font-mono text-xs`} /></Field>
                  <label className="flex flex-wrap items-center gap-2 text-slate-400"><FileUp size={14} aria-hidden />or choose a CSV file <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" /></label>
                </div>
              )}
              {method === "account" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${input} w-full`} autoComplete="off" /></Field>
                  <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} w-full`} autoComplete="off" /></Field>
                  <Field label="Temporary password" hint="At least 8 characters. Tell them; they can change it on Your profile."><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} className={`${input} w-full font-mono`} autoComplete="new-password" /></Field>
                </div>
              )}
              {method === "link" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="What is it for? (optional)" hint="Only you see this."><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className={`${input} w-full`} /></Field>
                  <Field label="Places" hint="How many people can use it."><input type="number" min={1} max={MAX_LINK_USES} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={`${input} w-full`} /></Field>
                  <Field label="Days" hint="How long it works."><input type="number" min={1} max={MAX_LINK_DAYS} value={days} onChange={(e) => setDays(e.target.value)} className={`${input} w-full`} /></Field>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Field label={method === "list" ? "Their role (used when a line does not give one)" : "Their job role"} hint="The role decides what they must learn.">
                <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} list="add-roles" maxLength={40} className={`${input} w-full max-w-sm`} autoComplete="off" />
              </Field>
              <datalist id="add-roles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
              {roles.length > 0 && <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="text-slate-500">Roles with learning ready:</span>{roles.slice(0, 8).map((r) => <button type="button" key={r} onClick={() => setJobRole(r)} className={`rounded-full px-2.5 py-1 ${role === r ? "bg-indigo-600 text-[#fff]" : "bg-black/5 hover:bg-black/10"}`}>{r}</button>)}</div>}
              <fieldset>
                <legend className="mb-1 font-semibold">Are they staff or a customer?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([["staff", "Staff", "Works for the company. Gets the company's required learning."], ["customer", "Customer", "Uses the company's products. Only customer-facing learning, and learner access only."]] as const).map(([k, t, b]) => (
                    <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${audience === k ? "border-indigo-500 bg-indigo-500/10" : "border-black/10 hover:bg-black/5"}`}>
                      <input type="radio" name="audience" value={k} checked={audience === k} onChange={() => setAudience(k)} className="mt-1" />
                      <span><span className="font-semibold">{t}</span><span className="block text-xs text-slate-400">{b}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <AccessCards choices={access} value={level} onChange={setLevel} forceLearner={learnerOnly}
                why={method === "link" ? "A team link always gives learner access, so it cannot be used to climb." : audience === "customer" ? "Customers can only be learners." : undefined} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="font-semibold">Where do they belong?</p>
              <PlacePicker tree={tree} value={places} onChange={(p) => { setPlaces(p); setProblem(null); }} idPrefix="add" />
              {effective !== "learner" && <p className="text-xs text-slate-400">{levelInfo.label}s run the places you pick here, so pick only what they should run.</p>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Check, then add</h3>
              <dl className="grid gap-x-4 gap-y-2 rounded-xl bg-black/[.03] p-3 sm:grid-cols-[10rem_1fr]">
                <dt className="text-slate-500">Adding</dt><dd>{method === "one" ? `${new Set(emails.toLowerCase().split(/[\s,;]+/).filter(Boolean)).size} by invite link` : method === "list" ? `A list${file ? ` (${file.name})` : ""}, by invite link` : method === "link" ? `A team link for up to ${maxUses} people, open for ${days} days` : `${name.trim()} (${email.trim()}), account made now`}</dd>
                <dt className="text-slate-500">Role</dt><dd>{role}{method === "list" ? ", unless a line gives its own" : ""} · {audience === "customer" ? "customer" : "staff"}</dd>
                <dt className="text-slate-500">Can do</dt><dd><b>{levelInfo.label}.</b> {levelInfo.blurb}</dd>
                <dt className="text-slate-500">Will see</dt><dd>{placeText}</dd>
              </dl>
              <Plan plan={plan} role={role} />
              {mailReady && (method === "one" || method === "list") && <label className="flex items-center gap-2"><input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />Email the invitations now</label>}
              {method === "account" && <p className="flex items-start gap-1.5 text-xs text-slate-400"><KeyRound size={13} className="mt-0.5 shrink-0" aria-hidden />They sign in with the temporary password you set. Nothing is emailed.</p>}
            </div>
          )}

          {problem && <p role="alert" className="slide-in flex items-start gap-1.5 text-rose-700"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />{problem}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {step > 0 && <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}><ArrowLeft size={15} />Back</button>}
            {step < 3
              ? <button className="btn">Next<ArrowRight size={15} /></button>
              : <button disabled={pending} className="btn disabled:opacity-50"><Check size={15} />{pending ? "Adding…" : method === "link" ? "Make the team link" : method === "account" ? "Create the account" : mailReady && sendEmail ? "Create and send invites" : "Create invites"}</button>}
          </div>
        </form>
      )}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="block font-semibold">{label}</span>{children}{hint && <span className="block text-xs text-slate-500">{hint}</span>}</label>;
}

/** What they will be required to learn, from today's rules, before anything is created. */
function Plan({ plan, role }: { plan: PlanPreview | "loading" | null; role: string }) {
  if (plan === "loading" || !plan) return <p className="text-slate-500" role="status">Working out what they will be required to learn…</p>;
  if ("error" in plan) return <p className="text-amber-800">{plan.error}</p>;
  const mandatory = plan.required.filter((r) => r.tier === "mandatory"), forRole = plan.required.filter((r) => r.tier === "role");
  return (
    <div className="space-y-2 rounded-xl border border-black/10 p-3" aria-live="polite">
      <p className="font-semibold">They will be required to learn {plan.required.length === 0 ? "nothing yet" : `${plan.required.length} ${plan.required.length === 1 ? "track" : "tracks"}`}</p>
      {mandatory.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">For everyone here</p><ul className="list-disc pl-5">{mandatory.map((r) => <li key={r.name}>{r.name} <span className="text-xs text-slate-500">level {r.level}, within {r.days} days</span></li>)}</ul></div>}
      {forRole.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">For a {role}</p><ul className="list-disc pl-5">{forRole.map((r) => <li key={r.name}>{r.name} <span className="text-xs text-slate-500">level {r.level}, within {r.days} days</span></li>)}</ul></div>}
      {plan.noRolePath && <p className="flex items-start gap-1.5 text-amber-800"><Info size={14} className="mt-0.5 shrink-0" aria-hidden />Nothing is set up for the role &ldquo;{role}&rdquo; yet, so they only get company-wide learning. You can still add them, and add learning for the role later.</p>}
      <p className="text-xs text-slate-500">Based on today&apos;s rules. Anyone added through a list may have their own role, which can change this.</p>
    </div>
  );
}

function Result({ done, onAgain, mailReady }: { done: Done; onAgain: () => void; mailReady: boolean }) {
  const box = "rounded border border-white/20 bg-[#fff] px-2 py-1.5";
  return (
    <div className="pop space-y-3" role="status">
      {done.kind === "account" && <p className="flex items-center gap-1.5 text-emerald-700"><Check size={15} aria-hidden /><span><b>{done.name}</b> ({done.email}) can sign in now with the temporary password you set.</span></p>}
      {done.kind === "link" && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-emerald-700"><Check size={15} aria-hidden />Team link ready. Post it in your team chat. Anyone with it can make a learner account in the places you chose, until it is full or expires.</p>
          <div className="flex flex-wrap gap-2"><input readOnly aria-label="Team link" value={done.url} onFocus={(e) => e.currentTarget.select()} className={`${box} min-w-0 flex-1`} /><CopyButton label="Copy link" text={done.url} /></div>
        </div>
      )}
      {done.kind === "invites" && <InviteResult state={done.state} mailReady={mailReady} />}
      <button type="button" className="btn btn-ghost" onClick={onAgain}><Users size={15} />Add more people</button>
    </div>
  );
}

function InviteResult({ state, mailReady }: { state: NonNullable<InviteState>; mailReady: boolean }) {
  const box = "rounded border border-white/20 bg-[#fff] px-2 py-1.5";
  const invites = state.invites ?? [];
  return (
    <div className="space-y-2 text-slate-300">
      <span className="flex items-center gap-1.5 text-emerald-700"><Check size={14} aria-hidden />{invites.length === 1 ? "Invite ready." : `${invites.length} invites ready.`}</span>
      {state.notice && <p className="flex items-start gap-1.5 text-amber-800"><Info size={14} className="mt-0.5 shrink-0" aria-hidden />{state.notice}</p>}
      {state.rejected && state.rejected.length > 0 && (
        <details className="text-amber-800"><summary className="cursor-pointer">{state.rejected.length} line{state.rejected.length === 1 ? "" : "s"} could not be used</summary>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-400">{state.rejected.slice(0, 50).map((r) => <li key={r}>{r}</li>)}{state.rejected.length > 50 && <li>and {state.rejected.length - 50} more</li>}</ul></details>
      )}
      {state.skipped && state.skipped.length > 0 && <p className="text-slate-400">No link for {state.skipped.join(", ")}: already has an account.</p>}
      <span className="flex flex-wrap items-center gap-2"><span className="flex items-start gap-1.5"><Mail size={13} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />{state.mail
        ? <span>{state.mail.sent.length > 0 && <>Emailed to <b>{state.mail.sent.join(", ")}</b>. </>}{state.mail.failed.length > 0 && <span className="text-amber-800">Could not email {state.mail.failed.map((f) => `${f.email} (${f.error})`).join("; ")}: send those yourself with <b>Open in email</b> or copy the link. </span>}The links are below too. Each works once, for 7 days, and is shown only now.</span>
        : <span>Next: send each person their invite. {mailReady ? "You chose not to email them from here, so use" : "gglearn is not set up to send email, so use"} <b>Open in email</b> (your mail app opens with the message written) or copy it. Each link works once, for 7 days, and is shown only now.</span>}</span>
        {invites.length > 1 && <CopyButton label="Copy all links" text={invites.map((i) => `${i.email}: ${i.url}`).join("\n")} />}
        {invites.length > 1 && <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={() => { const csv = "email,role,link\n" + invites.map((i) => `${i.email},${i.jobRole ?? ""},${i.url}`).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gglearn-invites.csv"; a.click(); URL.revokeObjectURL(a.href); }}><Download size={13} aria-hidden />Download CSV</button>}</span>
      <ul className="space-y-2">
        {invites.map((i) => (
          <li key={i.email}>
            <label className="block text-xs text-slate-400">For <b>{i.email}</b>
              <span className="mt-0.5 flex flex-wrap gap-2">
                <input readOnly value={i.url} onFocus={(e) => e.currentTarget.select()} className={`${box} block min-w-0 flex-1`} />
                {state.message && (() => {
                  const msg = inviteMessage(state.message, i.url);
                  return (<>
                    <a className="btn !px-2.5 !py-1 text-xs" href={`mailto:${i.email}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}`}><Mail size={13} aria-hidden />Open in email</a>
                    <CopyButton label="Copy message" text={msg.body} />
                  </>);
                })()}
                <CopyButton label="Copy link" text={i.url} />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
