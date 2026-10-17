import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { Badge, Button, EmptyState, Field, PageHeader, Section, StatTile, Stats } from "@gg/ui";
import { brands, companies, db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { adminScopeOf, resolveScope } from "@/lib/adminScope";
import { type ProfileScope, type SectionState, completenessOf, profileOf, rowsOf, typeOf } from "@/lib/profile";
import { canEditProfile } from "@/lib/profileAdmin";
import { type PublishState, profileSlug, publishStates } from "@/lib/profilePublish";
import { scopeInReach, usersInReach } from "@/lib/tenancy";
import { ActionForm } from "@/components/admin/ActionForm";
import { TableInput } from "@/components/admin/TableInput";
import { addFieldAction, retireFieldAction, saveSection } from "./actions";
import { publishAction } from "./publish-action";

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
  const pub = publishStates(subject.kind, subject.id);
  const pending = [...pub.states.values()].filter((v) => v === "unpublished" || v === "changed").length;

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
      {editable && me.role === "admin" && (
        <Section title="Publish to learning" subtitle="Turns the answered sections into study material, so what this profile says is what people are taught and asked. Re-publish after you change it.">
          <ActionForm action={publishAction} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <input type="hidden" name="scope" value={subject.kind} /><input type="hidden" name="refId" value={subject.id} />
            <div style={{ fontSize: 13 }}>
              {pub.track ? <>Track <b>{pub.track.name}</b> · {pub.questions} live question{pub.questions === 1 ? "" : "s"}</> : "No track yet: publishing creates one."}
              {" · "}{pending ? <Badge tone="warn">{pending} section{pending === 1 ? "" : "s"} to publish</Badge> : <Badge tone="ok">Up to date</Badge>}
            </div>
            <Field label="What changed" hint="Shown to people who are asked to read it again."><input name="note" maxLength={500} placeholder="e.g. New pricing rules" /></Field>
            <label style={{ display: "flex", gap: 8, fontSize: 13 }}><input type="checkbox" name="material" /> Ask people already enrolled to read the changes again</label>
            <div><Button variant="primary">Publish {pending ? pending : ""} to learning</Button></div>
          </ActionForm>
          {pub.track && pub.questions < 50 && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
              Nobody is required to take it until it has questions. Generate them from the published text (they arrive as "review" for you to approve):
              {" "}<code>npm run generate:bank -- --track {profileSlug(subject.kind, subject.id)}</code>
            </p>
          )}
        </Section>
      )}
      {states.map((s) => <SectionCard key={s.section.key} s={s} published={pub.states.get(s.section.key) ?? "empty"} scope={subject.kind} refId={subject.id} owners={owners} ownerName={ownerName} editable={editable} />)}
    </div>
  );
}

function SectionCard({ s, published, scope, refId, owners, ownerName, editable }: {
  s: SectionState; published: PublishState; scope: ProfileScope; refId: number; owners: { id: number; name: string }[]; ownerName: Map<number, string>; editable: boolean;
}) {
  const { section } = s, na = s.status === "na";
  const badge = na ? <Badge tone="muted">Does not apply</Badge> : s.complete ? (s.stale ? <Badge tone="warn">Confirm still current</Badge> : <Badge tone="ok">Complete</Badge>) : <Badge tone="warn">{s.missing.length} required missing</Badge>;
  return (
    <Section title={<>{section.label} {section.tier === "extra" && <Badge tone="muted">Extra</Badge>}</>} subtitle={section.why} action={<span style={{ display: "flex", gap: 6 }}>{published === "unpublished" && <Badge tone="muted">Not published</Badge>}{published === "changed" && <Badge tone="warn">Changed since published</Badge>}{published === "current" && <Badge tone="ok">Published</Badge>}{badge}</span>}>
      <details open={!na && !s.complete}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          {s.filled} of {s.total} answered · reviewed {when(s.reviewedAt)}{s.ownerId ? ` · owner ${ownerName.get(s.ownerId) ?? "someone outside your view"}` : " · no owner"}
        </summary>
        <ActionForm action={saveSection} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="scope" value={scope} /><input type="hidden" name="refId" value={refId} /><input type="hidden" name="section" value={section.key} />
          {!na && s.fields.map((fl) => (
            <Field key={fl.key} label={<>{fl.label}{fl.required && <span style={{ color: "var(--bad, #c0392b)" }}> *</span>}{fl.custom && <> <Badge tone="muted">Our own</Badge></>}</>} hint={fl.hint}>
              {typeOf(fl) === "table"
                ? <TableInput name={`f_${fl.key}`} columns={fl.columns ?? []} initial={rowsOf(fl, s.answers[fl.key] ?? "")} disabled={!editable} />
                : typeOf(fl) === "long"
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
        {editable && !na && (
          <details style={{ marginTop: 14, fontSize: 13 }}>
            <summary style={{ cursor: "pointer", color: "var(--muted)" }}>Our own questions: add one{s.fields.some((f) => f.custom) ? " or remove one" : ""}</summary>
            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              {s.fields.filter((f) => f.custom).map((f) => (
                <form key={f.key} action={retireFieldAction} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="hidden" name="fieldId" value={f.id} /><span>{f.label}</span><Badge tone="muted">{typeOf(f) === "table" ? `table: ${(f.columns ?? []).map((c) => c.label).join(", ")}` : typeOf(f)}</Badge>
                  <Button size="sm" variant="ghost" style={{ marginLeft: "auto" }}>Remove</Button>
                </form>
              ))}
              <ActionForm action={addFieldAction} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                <input type="hidden" name="scope" value={scope} /><input type="hidden" name="refId" value={refId} /><input type="hidden" name="section" value={section.key} />
                <Field label="Question"><input name="label" required maxLength={80} placeholder="e.g. Approved suppliers" /></Field>
                <Field label="Answer is"><select name="kind" defaultValue="long"><option value="long">A paragraph</option><option value="text">One line</option><option value="table">A table</option></select></Field>
                <Field label="Table columns" hint="Only for a table: 2 to 6, separated by commas."><input name="columns" maxLength={200} placeholder="Supplier, Contact, Renewal date" /></Field>
                <Field label="Hint (optional)"><input name="hint" maxLength={200} /></Field>
                <label style={{ display: "flex", gap: 8, alignItems: "end" }}><input type="checkbox" name="required" /> Required</label>
                <div style={{ alignSelf: "end" }}><Button variant="primary">Add question</Button></div>
              </ActionForm>
            </div>
          </details>
        )}
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
