import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { Badge, Button, EmptyState, Field, PageHeader, Section, StatTile, Stats } from "@gg/ui";
import { brands, companies, db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { adminScopeOf, resolveScope } from "@/lib/adminScope";
import { type ProfileScope, type SectionState, completenessOf, profileOf } from "@/lib/profile";
import { canEditProfile } from "@/lib/profileAdmin";
import { scopeInReach, usersInReach } from "@/lib/tenancy";
import { ActionForm } from "@/components/admin/ActionForm";
import { saveSection } from "./actions";

export const metadata = { title: "Company and brand profile — gglearn" };
const when = (t: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "never");

export default async function Profile({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const me = await requireManager();
  const { for: pick } = await searchParams;
  const scope = (pick ? resolveScope(me, pick) : null) ?? (await adminScopeOf(me));
  const subject: { kind: ProfileScope; id: number; name: string } | null =
    scope.kind === "company" && scope.id != null ? { kind: "company", id: scope.id, name: scope.name } : scope.kind === "brand" && scope.id != null ? { kind: "brand", id: scope.id, name: scope.name } : null;

  if (!subject) return <Overview me={me} />;
  const editable = canEditProfile(me, subject.kind, subject.id);
  const states = profileOf(subject.kind, subject.id), c = completenessOf(states);
  const mine = usersInReach(scope.reach);
  const owners = db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.status, "active"), inArray(users.role, ["admin", "manager"]))).orderBy(users.name).all().filter((u) => !mine || mine.has(u.id));
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader icon="briefcase" title={`${subject.name} profile`} subtitle="What this organisation knows about itself, so a new person can operate and contribute. Core sections must be complete; extra sections are reference." />
      <Stats>
        <StatTile label="Required answers" value={`${c.percent}%`} tone={c.ready ? "ok" : "warn"} hint={c.ready ? "Ready" : "Core sections still open"} icon="check" />
        <StatTile label="Core sections" value={`${c.core.done} / ${c.core.total}`} icon="layers" />
        <StatTile label="Extra sections" value={`${c.extra.done} / ${c.extra.total}`} icon="sparkles" />
        <StatTile label="Due for review" value={c.stale.length} tone={c.stale.length ? "warn" : undefined} hint="Complete but not confirmed lately" icon="clock" />
      </Stats>
      {!editable && <Badge tone="muted">Read only: you do not run this {subject.kind}</Badge>}
      {states.map((s) => <SectionCard key={s.section.key} s={s} scope={subject.kind} refId={subject.id} owners={owners} ownerName={ownerName} editable={editable} />)}
    </div>
  );
}

function SectionCard({ s, scope, refId, owners, ownerName, editable }: {
  s: SectionState; scope: ProfileScope; refId: number; owners: { id: number; name: string }[]; ownerName: Map<number, string>; editable: boolean;
}) {
  const { section } = s, na = s.status === "na";
  const badge = na ? <Badge tone="muted">Does not apply</Badge> : s.complete ? (s.stale ? <Badge tone="warn">Confirm still current</Badge> : <Badge tone="ok">Complete</Badge>) : <Badge tone="warn">{s.missing.length} required missing</Badge>;
  return (
    <Section title={<>{section.label} {section.tier === "extra" && <Badge tone="muted">Extra</Badge>}</>} subtitle={section.why} action={badge}>
      <details open={!na && !s.complete}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          {s.filled} of {s.total} answered · reviewed {when(s.reviewedAt)}{s.ownerId ? ` · owner ${ownerName.get(s.ownerId) ?? "someone outside your view"}` : " · no owner"}
        </summary>
        <ActionForm action={saveSection} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="scope" value={scope} /><input type="hidden" name="refId" value={refId} /><input type="hidden" name="section" value={section.key} />
          {!na && section.fields.map((fl) => (
            <Field key={fl.key} label={<>{fl.label}{fl.required && <span style={{ color: "var(--bad, #c0392b)" }}> *</span>}</>} hint={fl.hint}>
              {fl.long
                ? <textarea name={`f_${fl.key}`} defaultValue={s.answers[fl.key] ?? ""} rows={3} maxLength={8000} disabled={!editable} />
                : <input name={`f_${fl.key}`} defaultValue={s.answers[fl.key] ?? ""} maxLength={8000} disabled={!editable} />}
            </Field>
          ))}
          {editable && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
              {!na && (
                <Field label="Section owner">
                  <select name="ownerId" defaultValue={s.ownerId ?? ""}><option value="">No owner</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                </Field>
              )}
              {na
                ? <Button name="intent" value="open" variant="primary">This applies after all</Button>
                : <>
                    <Button name="intent" value="save" variant="primary">Save</Button>
                    <Button name="intent" value="reviewed" title="Save, and record that this is still true today">Save and confirm current</Button>
                    <Button name="intent" value="na" variant="ghost" title="Stops counting against completeness">Does not apply to us</Button>
                  </>}
            </div>
          )}
        </ActionForm>
      </details>
    </Section>
  );
}

/** With no company or brand picked: every one this person runs, with how ready its profile is. */
function Overview({ me }: { me: { id: number; role: string } }) {
  const reach = resolveScope(me, "all")!.reach;
  const cos = db.select().from(companies).orderBy(companies.name).all().filter((c) => scopeInReach(reach, { kind: "company", id: c.id }));
  const bs = db.select().from(brands).orderBy(brands.name).all().filter((b) => b.kind === "company" && scopeInReach(reach, { kind: "brand", id: b.id }));
  const rows = [
    ...cos.map((c) => ({ key: `company:${c.id}`, kind: "Company", name: c.academyName || c.name, c: completenessOf(profileOf("company", c.id)) })),
    ...bs.map((b) => ({ key: `brand:${b.id}`, kind: "Brand", name: b.name, c: completenessOf(profileOf("brand", b.id)) })),
  ];
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader icon="briefcase" title="Company and brand profiles" subtitle="How complete each profile is. Pick one to fill it in, or switch scope in the side nav." />
      {rows.length === 0 ? <EmptyState title="Nothing to show" body="Add a company and a brand on Companies and brands first." /> : (
        <Section title="Readiness" flush>
          <table className="table" style={{ width: "100%" }}>
            <thead><tr><th>Name</th><th>Required answered</th><th>Core sections</th><th>Due for review</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td><b>{r.name}</b> <Badge tone="muted">{r.kind}</Badge></td>
                  <td><Badge tone={r.c.ready ? "ok" : "warn"}>{r.c.percent}%</Badge></td>
                  <td>{r.c.core.done} / {r.c.core.total}</td>
                  <td>{r.c.stale.length}</td>
                  <td><Link href={`/admin/profile?for=${r.key}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
