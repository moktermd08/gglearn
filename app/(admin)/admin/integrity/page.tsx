/* eslint-disable @next/next/no-img-element -- private, uncacheable camera stills that next/image cannot optimise */
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { brands, companies, db, tracks, userAvatars, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { adminScopeOf } from "@/lib/adminScope";
import { scopeInReach, trackInReach, usersInReach } from "@/lib/tenancy";
import { canSeeAvatar } from "@/lib/competitions";
import { FIELDS, PRESETS, SCOPES, type Key, type Scope, type Settings, describePolicy, layersAt, resolveFor, storedAt } from "@/lib/integrity/policy";
import { eventsOf, flagsOf, purgeExpired, recentlySettled, snapshotsOf } from "@/lib/integrity/session";
import { queueFor, scopeAllowed } from "@/lib/integrityAdmin";
import { DecideForm, PolicyForm, ResetForm, type Row } from "./forms";

export const metadata = { title: "Exam integrity — gglearn" };

const show = (key: Key, value: Settings[Key]): string => {
  const f = FIELDS.find((x) => x.key === key)!;
  if (f.type === "bool") return value ? "On" : "Off";
  if (f.type === "enum") return f.options.find((o) => o.value === value)?.label ?? String(value);
  return `${value}${f.unit ? ` ${f.unit}` : ""}`;
};
const when = (t: number) => new Date(t * 1000).toISOString().replace("T", " ").slice(0, 16);

export default async function Integrity({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const scope = await adminScopeOf(me), reach = scope.reach;
  // the whole-academy layer is the platform owner's, offered unless the switcher is focused on one company or brand
  const owner = scopeAllowed(me, "global", 0) && (scope.kind === "master" || scope.kind === "all");
  purgeExpired();

  // everything this admin may set a policy for
  const cos = db.select().from(companies).orderBy(companies.name).all().filter((c) => scopeInReach(reach, { kind: "company", id: c.id }));
  const coName = new Map(cos.map((c) => [c.id, c.academyName || c.name]));
  const bs = db.select().from(brands).orderBy(brands.name).all().filter((b) => (b.kind === "company" ? b.companyId != null && coName.has(b.companyId) : reach.all));
  const brandName = new Map(bs.map((b) => [b.id, b.name]));
  const ts = db.select().from(tracks).orderBy(tracks.name).all().filter((t) => trackInReach(reach, t) && brandName.has(t.brandId));
  const targets: { value: string; label: string; group: string }[] = [
    ...(owner ? [{ value: "global:0", label: "Whole academy (every company and brand)", group: "Academy" }] : []),
    ...cos.map((c) => ({ value: `company:${c.id}`, label: coName.get(c.id)!, group: "Companies" })),
    ...bs.map((b) => ({ value: `brand:${b.id}`, label: `${b.companyId != null ? coName.get(b.companyId) : "Academy"} · ${b.name}`, group: "Brands" })),
    ...ts.map((t) => ({ value: `track:${t.id}`, label: `${brandName.get(t.brandId)} · ${t.name}`, group: "Tracks" })),
  ];

  const want = (await searchParams).target ?? "";
  const [wScope, wId] = want.split(":");
  const chosen = SCOPES.includes(wScope as Scope) && scopeAllowed(me, wScope as Scope, Number(wId)) ? { scope: wScope as Scope, refId: Number(wId) } : null;
  const first = targets[0]?.value.split(":");
  const sel = chosen ?? (first ? { scope: first[0] as Scope, refId: Number(first[1]) } : null);

  const queue = queueFor(reach);
  const mine = usersInReach(reach); // null = everyone
  const settled = recentlySettled(100).filter((s) => mine === null || mine.has(s.userId)).slice(0, 15);
  const nameOf = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name]));
  const trackNameOf = new Map(db.select({ id: tracks.id, name: tracks.name }).from(tracks).all().map((t) => [t.id, t.name]));
  const h2 = "mb-2 text-lg font-semibold";

  // the editor for the chosen level
  let editor: React.ReactNode = <p className="card p-4 text-sm text-slate-400">Add a company, brand and track on Set up first.</p>;
  if (sel) {
    const layers = layersAt(sel.scope, sel.refId);
    const above = resolveFor(layers.slice(0, -1)), here = storedAt(sel.scope, sel.refId), after = resolveFor(layers);
    const rows: Row[] = FIELDS.map((f) => {
      const own = here.v[f.key];
      const lockedAbove = above.lockedBy[f.key];
      return {
        key: f.key, label: f.label, help: f.help, group: f.group,
        type: f.type, options: f.type === "enum" ? f.options : undefined, min: f.type === "int" ? f.min : undefined, max: f.type === "int" ? f.max : undefined, unit: f.type === "int" ? f.unit : undefined,
        own: own === undefined ? "" : typeof own === "boolean" ? (own ? "on" : "off") : String(own),
        ownLock: here.lock.includes(f.key),
        inherited: show(f.key, above.values[f.key]), inheritedFrom: above.source[f.key].label,
        lockedBy: lockedAbove ? lockedAbove.label : null,
        canLock: sel.scope !== "track",
      };
    });
    const chain = layers.map((l) => ({ ...l, sets: Object.keys(storedAt(l.scope, l.refId).v).length, locks: storedAt(l.scope, l.refId).lock.length }));
    const lines = describePolicy(after.values);
    editor = (
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-x-2 gap-y-1 p-3 text-sm" aria-label="Where the policy comes from">
          {chain.map((l, i) => (
            <span key={`${l.scope}:${l.refId}`} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-400">→</span>}
              <span className={`rounded-full px-2.5 py-1 ${i === chain.length - 1 ? "bg-indigo-500/15 font-bold" : "bg-black/5"}`}>{l.label}
                <span className="ml-1.5 text-xs text-slate-400">{l.sets ? `${l.sets} set${l.locks ? `, ${l.locks} locked` : ""}` : "inherits"}</span></span>
            </span>
          ))}
        </div>
        <div className="card p-4 text-sm">
          <div className="mb-1 font-semibold">What an exam here will do</div>
          {lines.length ? <ul className="list-disc space-y-0.5 pl-5">{lines.map((l) => <li key={l}>{l}</li>)}</ul> : <p className="text-slate-400">Nothing. Exams here are not monitored.</p>}
          {after.values.reviewAt > 0 && lines.length > 0 && <p className="mt-2 text-xs text-slate-400">A passed exam scoring {after.values.reviewAt} or more goes to the review queue{after.values.holdOnFlag ? "; its certificate and rewards are held until cleared" : ""}.</p>}
        </div>
        <PolicyForm scope={sel.scope} refId={sel.refId} rows={rows} presets={Object.entries(PRESETS).map(([key, p]) => ({ key, label: p.label, blurb: p.blurb }))} />
        {(Object.keys(here.v).length > 0 || here.lock.length > 0) && <ResetForm scope={sel.scope} refId={sel.refId} />}
      </div>
    );
  }
  const selValue = sel ? `${sel.scope}:${sel.refId}` : "";

  return (
    <div className="space-y-8">
      <PageHero Icon={ShieldCheck} title="Exam integrity" sub="Make sure a real person sat the exam. Set how closely exams are watched for the whole academy, a company, a brand or a single track. Each level inherits from the one above, and a level can lock a setting so nothing below it can loosen it." />

      <section>
        <h2 className={h2}>Waiting for review {queue.length > 0 && <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-700">{queue.length}</span>}</h2>
        {queue.length === 0 ? <p className="text-sm text-slate-400">Nothing flagged. Passes are queued here when their risk score reaches the policy&rsquo;s threshold, or when they are at a level a person must always check.</p> : (
          <div className="space-y-3">
            {queue.map((s) => {
              const flags = flagsOf(s), snaps = snapshotsOf(s.id), events = eventsOf(s.id);
              const hasPhoto = !!db.select({ u: userAvatars.userId }).from(userAvatars).where(eq(userAvatars.userId, s.userId)).get() && canSeeAvatar(s.userId, me);
              const track = s.trackId != null ? trackNameOf.get(s.trackId) : null;
              return (
                <div key={s.id} className="card space-y-3 p-4 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <b className="text-base">{nameOf.get(s.userId) ?? "Someone"}</b>
                    <span>{track ? `${track}, level ${s.level}` : `Role check for level ${s.level}`}</span>
                    <span className="text-xs text-slate-400">{s.finishedAt ? when(s.finishedAt) : ""}</span>
                    <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${s.score >= 70 ? "bg-rose-500/20 text-rose-700" : s.score >= 40 ? "bg-amber-500/20 text-amber-700" : "bg-black/5"}`}>Risk {s.score}/100</span>
                    {s.award === "held" && <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold">Reward held</span>}
                  </div>
                  {flags.length > 0 ? (
                    <ul className="grid gap-1 sm:grid-cols-2">{flags.map((f) => <li key={f.key} className="flex justify-between gap-3 rounded bg-black/5 px-2 py-1"><span>{f.label}</span><span className="shrink-0 font-semibold">{f.points > 0 ? `+${f.points}` : "check"}</span></li>)}</ul>
                  ) : <p className="text-slate-400">No flags: this one is here because of the level it is at.</p>}
                  {(snaps.length > 0 || hasPhoto) && (
                    <div className="flex flex-wrap items-end gap-2">
                      {hasPhoto && <figure className="text-center text-[11px] text-slate-400"><img src={`/api/avatar/${s.userId}`} alt="Profile photo" className="h-20 w-28 rounded border border-black/10 object-cover" /><figcaption>Profile photo</figcaption></figure>}
                      {snaps.map((p) => (
                        <figure key={p.id} className="text-center text-[11px] text-slate-400">
                          <img src={`/api/integrity/snapshot/${p.id}`} alt={p.tag === "start" ? "Photo at the start" : "Camera photo during the exam"} className={`h-20 w-28 -scale-x-100 rounded border object-cover ${p.faces === 0 || (p.faces ?? 0) > 1 ? "border-rose-400" : "border-black/10"}`} loading="lazy" />
                          <figcaption>{p.tag === "start" ? "Start" : "During"}{p.faces != null ? ` · ${p.faces} face${p.faces === 1 ? "" : "s"}` : ""}</figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                  {events.length > 0 && (
                    <details className="text-xs"><summary className="cursor-pointer text-slate-400">Timeline ({events.length} event{events.length === 1 ? "" : "s"})</summary>
                      <ul className="mt-1 space-y-0.5">{events.map((e) => <li key={e.id}><span className="text-slate-400">+{Math.max(0, e.at - (events[0]?.at ?? e.at))}s</span> {e.kind.replace("_", " ")}{e.detail ? ` · ${e.detail}` : ""}</li>)}</ul>
                    </details>
                  )}
                  <DecideForm sessionId={s.id} held={s.award === "held"} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className={h2}>Policy</h2>
        {targets.length > 0 && (
          <form method="get" className="card mb-3 flex flex-wrap items-end gap-2 p-4 text-sm">
            <label className="grid gap-1">Set the policy for
              <select name="target" defaultValue={selValue} className="min-w-72 rounded border border-white/20 bg-[#fff] px-2 py-1">
                {["Academy", "Companies", "Brands", "Tracks"].map((g) => targets.some((t) => t.group === g) && (
                  <optgroup key={g} label={g}>{targets.filter((t) => t.group === g).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>
                ))}
              </select>
            </label>
            <button className="btn btn-ghost !py-1.5">Show</button>
            <span className="text-xs text-slate-400">{owner ? "" : "The whole-academy policy is set by the platform owner, from the Master or Whole academy view; you can still see it flow into yours."}</span>
          </form>
        )}
        {editor}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className={h2}>Recently decided</h2>
          <div className="card divide-y divide-black/5 text-sm">
            {settled.map((s) => (
              <div key={s.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2">
                <b>{nameOf.get(s.userId)}</b>
                <span>{s.trackId != null ? `${trackNameOf.get(s.trackId)}, level ${s.level}` : `Role check, level ${s.level}`}</span>
                <span className="text-slate-400">risk {s.score}</span>
                <span className={s.status === "cleared" ? "text-emerald-700" : "text-rose-700"}>{s.status === "cleared" ? "Cleared" : "Rejected"}{s.note ? ` · ${s.note}` : ""}</span>
                <span className="ml-auto text-xs text-slate-400">{s.reviewedAt ? when(s.reviewedAt) : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-400">What this can and cannot do: a web page cannot see a second phone or a virtual machine. The settings gather evidence and make cheating costly and visible; missing evidence counts as a risk, and a person makes the final call. For the highest stakes, set &ldquo;always review passes from level&rdquo; and pair it with a short live check.</p>
    </div>
  );
}
