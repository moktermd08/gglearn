import { PageHero, PALETTE, StackBar } from "@/components/charts";
import { SubjectArt } from "@/components/SubjectArt";
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, questions, scopeRequirements } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { setScopeRequirement, updateTrackPolicy } from "@/app/actions";
import { catalog } from "@/lib/paths";
import { MAX_LEVEL } from "@/lib/levels";
import { Save, Route } from "lucide-react";
import { isGlobal, trackInReach } from "@/lib/tenancy";
import { adminScopeOf, scopeChoices } from "@/lib/adminScope";
import TOPICS from "../../../../content/topics/topics.json";

export const metadata = { title: "What is required — gglearn" };

export default async function Paths() {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const scope = await adminScopeOf(me);
  const reach = scope.reach;
  const fullCatalog = catalog();
  const cat = fullCatalog.filter((t) => trackInReach(reach, t));
  // inside one company or brand, shared topics are not edited (that would change them for everyone) but required of this company or brand's own people
  const scoped = scope.kind === "company" || scope.kind === "brand";
  const ownRequirements = new Map(scoped ? db.select().from(scopeRequirements).where(and(eq(scopeRequirements.scopeKind, scope.kind as "company" | "brand"), eq(scopeRequirements.scopeId, scope.id!))).all().map((r) => [r.trackId, r]) : []);
  const waiting = new Map(db.select({ id: questions.trackId, n: sql<number>`count(*)` }).from(questions).where(eq(questions.status, "review")).groupBy(questions.trackId).all().map((r) => [r.id, r.n]));
  type Own = typeof scopeRequirements.$inferSelect | undefined;
  /** One company or brand's requirement of one shared track: Required / Not required, roles, level, days. */
  const reqForm = (t: (typeof cat)[number], scopeValue: string, scopeName: string, own: Own, withName: boolean) => (
    <form action={setScopeRequirement} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="scope" value={scopeValue} />
      <input type="hidden" name="trackId" value={t.id} />
      {withName
        ? <span className="flex min-w-48 flex-1 items-center gap-2 truncate" title={t.slug}><SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={30} />{t.name}
          <span className="ml-2 text-xs text-slate-500">{t.questions} questions · exams to level {t.reach}</span></span>
        : <span className="min-w-48 flex-1 truncate font-medium">{scopeName}</span>}
      <select name="required" defaultValue={own ? "yes" : "no"} className={input} aria-label={`Required of ${scopeName}`}><option value="no">Not required</option><option value="yes">Required</option></select>
      <input name="roles" defaultValue={own?.roles ?? ""} placeholder="everyone, or roles" aria-label="Only these roles" className={`${input} w-40`} />
      <label className="flex items-center gap-1 text-xs text-slate-400">pass level<input name="requiredLevel" type="number" min={1} max={Math.max(1, t.reach)} defaultValue={own?.requiredLevel ?? Math.min(5, Math.max(1, t.reach))} className={`${input} w-16`} /></label>
      <label className="flex items-center gap-1 text-xs text-slate-400">within<input name="dueDays" type="number" min={1} max={365} defaultValue={own?.dueDays ?? 30} className={`${input} w-16`} />days</label>
      <button className="btn btn-ghost !px-3 !py-1"><Save size={14} />Save</button>
    </form>
  );
  const scopedRow = (t: (typeof cat)[number]) => {
    const own = ownRequirements.get(t.id);
    return <li key={t.id} className={`rounded-xl border border-black/5 p-2 transition hover:bg-indigo-500/5 ${own ? "bg-emerald-500/5" : ""}`}>{reqForm(t, scope.value, scope.name, own, true)}</li>;
  };
  // topic tracks (npm run topics) are listed by subject, not by where their questions came from
  const topics = new Map(TOPICS.topics.map((x) => [`topic-${x.slug}`, x.family]));
  const topicTracks = (scoped ? fullCatalog.filter((t) => t.audience !== "customer") : cat).filter((t) => topics.has(t.slug));
  const families = Object.entries(TOPICS.families).map(([key, name]) => ({ key, name, list: topicTracks.filter((t) => topics.get(t.slug) === key).sort((a, b) => a.name.localeCompare(b.name)) })).filter((f) => f.list.length);
  // the public sector tracks are shared academy content: a company can require them of its own people, but not edit them for everyone
  const publicTracks = fullCatalog.filter((t) => t.brand.slug === "public-sector" && t.audience !== "customer" && t.questions > 0).sort((a, b) => a.name.localeCompare(b.name));
  const byBrand = new Map<string, typeof cat>();
  for (const t of cat.filter((x) => !topics.has(x.slug))) byBrand.set(t.brand.name, [...(byBrand.get(t.brand.name) ?? []), t]);
  const groups = [...byBrand].map(([name, list]) => ({ name, list: list.sort((a, b) => a.name.localeCompare(b.name)), kind: list[0].brand.kind }))
    .sort((a, b) => Number(a.kind === "shared") - Number(b.kind === "shared") || a.name.localeCompare(b.name));
  const tierCount = (k: string) => cat.filter((t) => t.tier === k).length;
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
  const row = (t: (typeof cat)[number]) => (
    <li key={t.id} className="rounded-xl border border-black/5 p-2 transition hover:bg-indigo-500/5">
                <form action={updateTrackPolicy} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="trackId" value={t.id} />
                  <span className="flex min-w-48 flex-1 items-center gap-2 truncate" title={t.slug}><SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={30} />{t.name}
                    <span className="ml-2 text-xs text-slate-500">{t.questions} questions{t.roles && ` · roles: ${t.roles}`}</span>
                    {waiting.get(t.id) ? <Link href={`/admin/review/${t.slug}`} className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">{waiting.get(t.id)} to review</Link> : null}</span>
                  <select name="tier" defaultValue={t.tier} className={input} aria-label="Requirement"><option value="mandatory">Mandatory</option><option value="role">Role</option><option value="growth">Growth</option></select>
                  <select name="audience" defaultValue={t.audience} className={input} aria-label="Audience"><option value="staff">Staff</option><option value="customer">Customers</option><option value="both">Both</option></select>
                  <label className="flex items-center gap-1 text-xs text-slate-400">pass level<input name="requiredLevel" type="number" min={1} max={MAX_LEVEL} defaultValue={t.requiredLevel} className={`${input} w-16`} /></label>
                  <label className="flex items-center gap-1 text-xs text-slate-400">within<input name="dueDays" type="number" min={1} max={365} defaultValue={t.dueDays} className={`${input} w-16`} />days</label>
                  <button className="btn btn-ghost !px-3 !py-1"><Save size={14} />Save</button>
                </form>
              </li>
  );

  // one shared academy brand opened from the scope list: every company and brand this admin runs, track by track
  if (scope.library) {
    const choices = scopeChoices(me);
    const targets = choices.companies.flatMap((c) => [{ value: `company:${c.id}`, name: c.name, kind: "company" as const, id: c.id }, ...c.brands.map((b) => ({ value: `brand:${b.id}`, name: `${b.name} (${c.name})`, kind: "brand" as const, id: b.id }))]);
    const libTracks = publicTracks.filter((t) => t.brandId === scope.library!.brandId);
    const have = new Map(libTracks.length ? db.select().from(scopeRequirements).where(inArray(scopeRequirements.trackId, libTracks.map((t) => t.id))).all().map((r) => [`${r.scopeKind}:${r.scopeId}:${r.trackId}`, r]) : []);
    return (
      <div className="space-y-6">
        <PageHero Icon={Route} title={scope.name} sub={<>Shared academy learning. It is the same for every company; here you choose which of <b>your</b> companies and brands require it of their own people, for everyone or only some roles, with a level and a deadline. Nothing here changes it for anyone else. Saving enrols the people affected straight away.</>} />
        <section className="card p-4">
          <h2 className="text-lg font-bold">{libTracks.length} tracks <span className="text-xs font-normal text-slate-500">· {targets.length} of your companies and brands</span></h2>
          <div className="mt-3 space-y-2">
            {libTracks.map((t) => {
              const by = targets.filter((tg) => have.has(`${tg.kind}:${tg.id}:${t.id}`)).map((tg) => tg.name);
              return (
                <details key={t.id} className="rounded-xl border border-black/5 p-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold"><SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={30} />{t.name}
                    <span className="text-xs font-normal text-slate-500">{t.questions} questions · exams to level {t.reach}{by.length ? ` · required by ${by.join(", ")}` : " · not required yet"}</span></summary>
                  <ul className="mt-3 space-y-2">{targets.map((tg) => <li key={tg.value} className={`rounded-xl border border-black/5 p-2 ${have.has(`${tg.kind}:${tg.id}:${t.id}`) ? "bg-emerald-500/5" : ""}`}>{reqForm(t, tg.value, tg.name, have.get(`${tg.kind}:${tg.id}:${t.id}`), false)}</li>)}</ul>
                </details>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero Icon={Route} title="What is required" sub={<>
          <b>Mandatory</b>: everyone it applies to must pass. <b>Role</b>: required for the job roles listed on the track. <b>Growth</b>: optional, counts toward promotion.
          Saving enrols everyone affected straight away; the deadline runs from the day they are enrolled.
        </>} />
      <section className="card p-5"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">How the {cat.length} tracks and topics are set</div><StackBar parts={[{ label: "Mandatory", value: tierCount("mandatory"), color: PALETTE.rose }, { label: "Role", value: tierCount("role"), color: PALETTE.indigo }, { label: "Growth", value: tierCount("growth"), color: PALETTE.emerald }]} /></section>
      {!scoped && !isGlobal(reach) && (
        <section className="card p-4 text-sm text-slate-400"><b className="text-slate-200">Topics.</b> To make a topic such as version control or accessibility required for your people, choose one company or brand in the scope switcher at the top of the side nav.</section>
      )}
      {!isGlobal(reach) && publicTracks.length > 0 && (
        <section className="card p-4">
          <h2 className="text-lg font-bold">Public sector <span className="text-xs font-normal text-slate-500">{publicTracks.length} tracks · shared academy{scoped ? ` · ${publicTracks.filter((t) => ownRequirements.has(t.id)).length} required of ${scope.name}` : ""}</span></h2>
          <p className="mt-1 text-sm text-slate-400">{scoped
            ? <>Business cases, procurement, public money, legal duties, data and records, the Service Standard, assurance and governance. Mark a track <b>Required</b> to make it required of {scope.name}&apos;s own people, for everyone or only the roles you list. It changes nothing for any other company.</>
            : "Business cases, procurement, public money, legal duties, data and records, the Service Standard, assurance and governance. Choose one company or brand in the scope switcher to require any of them of its people."}</p>
          <ul className="mt-3 space-y-2">{publicTracks.map(scoped ? scopedRow : (t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 p-2 text-sm"><SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={30} />{t.name}<span className="ml-2 text-xs text-slate-500">{t.questions} questions · exams to level {t.reach}</span></li>
          ))}</ul>
        </section>
      )}
      {families.length > 0 && (
        <section className="card p-4">
          <h2 className="text-lg font-bold">By topic <span className="text-xs font-normal text-slate-500">{topicTracks.length} topics{scoped ? ` · ${ownRequirements.size} required of ${scope.name}` : ""}</span></h2>
          <p className="mt-1 text-sm text-slate-400">{scoped
            ? <>One subject at a time, drawn from every track that covers it. Mark a topic <b>Required</b> to make it required of {scope.name}&apos;s own people, for everyone or only the roles you list, with a level and a deadline. It changes nothing for any other company. Saving enrols the people affected straight away.</>
            : "One subject at a time, such as version control or accessibility, drawn from every track that covers it. Set a topic as mandatory, role or growth here like any track. This applies to every company; to require one for a single company, switch to that company first."}</p>
          <div className="mt-3 space-y-2">
            {families.map((f) => (
              <details key={f.key} className="rounded-xl border border-black/5 p-3">
                <summary className="cursor-pointer font-semibold">{f.name} <span className="text-xs font-normal text-slate-500">{f.list.length} topics{scoped ? ` · ${f.list.filter((t) => ownRequirements.has(t.id)).length} required` : ""}</span></summary>
                <ul className="mt-3 space-y-2">{f.list.map(scoped ? scopedRow : row)}</ul>
              </details>
            ))}
          </div>
        </section>
      )}
      {groups.map((g) => (
        <details key={g.name} open={g.kind !== "shared"} className="card p-4">
          <summary className="cursor-pointer text-lg font-bold">{g.name} <span className="text-xs font-normal text-slate-500">{g.list.length} tracks{g.kind === "shared" ? " · shared academy" : ""}</span></summary>
          <ul className="mt-3 space-y-2">
            {g.list.map(row)}
          </ul>
        </details>
      ))}
    </div>
  );
}
