import Link from "next/link";
import { and, eq, like, or } from "drizzle-orm";
import { Badge, Banner, Button, EmptyState, Field, LinkButton, PageHeader, Section } from "@gg/ui";
import { db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { adminScopeOf } from "@/lib/adminScope";
import { EXPIRY_DAYS, MANAGER_CAP, creditHistory, detailsFor, mayGrant, suggestedStarts } from "@/lib/credits";
import { MAX_LEVEL } from "@/lib/levels";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { usersInReach } from "@/lib/tenancy";
import { ActionForm } from "@/components/admin/ActionForm";
import { confirmRoleStartsAction, giveStartAction, takeBackStartAction } from "./actions";

export const metadata = { title: "Starting points — gglearn" };
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const clean = (n: string) => n.replace(/^\d+\.\s*/, "");

export default async function StartingPoints({ searchParams }: { searchParams: Promise<{ q?: string; user?: string; track?: string }> }) {
  const me = await requireManager();
  const { q = "", user: userParam, track: trackParam = "" } = await searchParams;
  const scope = await adminScopeOf(me), mine = usersInReach(scope.reach);
  const inReach = (id: number) => !mine || mine.has(id);
  const target = userParam ? db.select().from(users).where(eq(users.id, Number(userParam) || 0)).get() : null;
  const person = target && inReach(target.id) ? target : null;
  const refusal = person ? mayGrant(me, person, 1, false) : null;
  const needle = q.trim().toLowerCase();
  const found = !person && needle
    ? db.select().from(users).where(and(eq(users.status, "active"), or(like(users.name, `%${needle}%`), like(users.email, `%${needle}%`)))).orderBy(users.name).limit(60).all().filter((u) => inReach(u.id)).slice(0, 20)
    : [];
  const cap = me.role === "admin" ? MAX_LEVEL : MANAGER_CAP;

  const view = person && !refusal ? (() => {
    const levels = detailsFor(person.id), scopes = scopesOf(person.id);
    const tracks = catalog().filter((t) => inScope(t, person.audience, scopes) && t.reach >= 1).sort((a, b) => clean(a.name).localeCompare(clean(b.name)));
    const rows = tracks.filter((t) => levels.has(t.id));
    return { levels, tracks, rows, suggest: suggestedStarts(person.id), history: creditHistory(person.id) };
  })() : null;
  const firstName = person?.name.split(" ")[0] ?? "";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader icon="target" title="Starting points" subtitle="Let someone start a track part-way up: from an assessment, from what their role normally holds, or because you know they are already there. It lifts where they start and unlocks what comes next. It never counts as an exam pass." />

      {!person && (
        <Section title="Who is starting somewhere other than the beginning?">
          <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <Field label="Name or email"><input name="q" defaultValue={q} placeholder="Search people you run" autoFocus /></Field>
            <Button variant="primary">Search</Button>
          </form>
          {needle && found.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>Nobody active that you run matches.</p>}
          {found.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {found.map((u) => (
                <div key={u.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                  <b>{u.name}</b><span style={{ color: "var(--muted)" }}>{u.email}</span><Badge tone="muted">{u.jobRole}</Badge>
                  <Link href={`/admin/starting-points?user=${u.id}`} style={{ marginLeft: "auto" }}>Choose</Link>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {target && !person && <Banner tone="bad" icon="alert">That person is not someone you run.</Banner>}
      {person && refusal && <Banner tone="bad" icon="alert">{refusal} <Link href="/admin/starting-points">Pick someone else</Link></Banner>}

      {person && view && (
        <>
          <Section title={person.name} subtitle={`${person.email} · ${person.jobRole}`} action={<div style={{ display: "flex", gap: 8 }}>
            <LinkButton href={`/map/business?as=${person.id}`} size="sm" variant="ghost">Their business map</LinkButton>
            <LinkButton href={`/map?as=${person.id}`} size="sm" variant="ghost">Their software map</LinkButton>
            <LinkButton href="/admin/starting-points" size="sm" variant="ghost">Someone else</LinkButton></div>}>
            {view.rows.length === 0 ? <p style={{ fontSize: 13, color: "var(--muted)" }}>{firstName} has no level in any track yet.</p> : (
              <div style={{ display: "grid", fontSize: 13 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,2fr) 70px 80px minmax(180px,3fr) 70px", gap: 10, padding: "6px 0", color: "var(--muted)", fontWeight: 600 }}>
                  <span>Track</span><span>Exams</span><span>Placement</span><span>Starting level</span><span>Shown</span>
                </div>
                {view.rows.map((t) => {
                  const d = view.levels.get(t.id)!;
                  return (
                    <div key={t.id} style={{ display: "grid", gridTemplateColumns: "minmax(160px,2fr) 70px 80px minmax(180px,3fr) 70px", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border, rgba(0,0,0,.08))", alignItems: "start" }}>
                      <span><b>{clean(t.name)}</b></span>
                      <span>{d.earned || "–"}</span>
                      <span>{d.placed || "–"}</span>
                      <span>
                        {d.credit ? (
                          <>
                            <Badge tone={d.credit.source === "role" ? "muted" : "ok"}>{d.credit.source === "role" ? "From role" : d.credit.source === "admin" ? "Admin" : "Manager"} · level {d.credit.level}</Badge>
                            {d.credit.countsAsComplete && <> <Badge tone="warn">Counts as complete</Badge></>}
                            <div style={{ color: "var(--muted)", marginTop: 2 }}>{d.credit.by}, {day(d.credit.at)}{d.credit.expiresAt ? ` · ends ${day(d.credit.expiresAt)}` : ""}</div>
                            <div style={{ marginTop: 2 }}>{d.credit.reason}</div>
                            <ActionForm action={takeBackStartAction} style={{ marginTop: 4 }}>
                              <input type="hidden" name="creditId" value={d.credit.id} />
                              <Button size="sm" variant="ghost">Take back</Button>
                            </ActionForm>
                          </>
                        ) : "–"}
                      </span>
                      <span><b>{d.shown}</b></span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {view.suggest && view.suggest.starts.length > 0 && (
            <Section title={`Where a ${view.suggest.role} normally is`} subtitle={`${firstName}'s job role usually holds these levels. Nothing is set until it is confirmed here, or ${firstName} accepts each one on their map.`}>
              <div style={{ display: "grid", gap: 4, fontSize: 14, marginBottom: 12 }}>
                {view.suggest.starts.map((s) => <div key={s.trackId}><Badge tone="muted">Level {s.level}</Badge> {s.name}</div>)}
              </div>
              <ActionForm action={confirmRoleStartsAction}>
                <input type="hidden" name="userId" value={person.id} />
                <Button variant="primary">Confirm these for {firstName}</Button>
              </ActionForm>
            </Section>
          )}

          <Section title={`Give ${firstName} a starting level`} subtitle={me.role === "admin" ? "You can give any level, and mark it as complete for required training." : `As a manager you can give up to level ${MANAGER_CAP}. For more, ask an admin.`}>
            <ActionForm action={giveStartAction} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
              <input type="hidden" name="userId" value={person.id} />
              <Field label="Track">
                <select name="trackId" defaultValue={view.tracks.find((t) => t.slug === trackParam)?.id ?? ""} required>
                  <option value="" disabled>Choose a track</option>
                  {view.tracks.map((t) => <option key={t.id} value={t.id}>{clean(t.name)}{view.levels.get(t.id)?.shown ? ` (now level ${view.levels.get(t.id)!.shown})` : ""}</option>)}
                </select>
              </Field>
              <Field label="Starts at level" hint={`1 to ${cap}. Must be above where they already are.`}><input name="level" type="number" min={1} max={cap} required style={{ width: 100 }} /></Field>
              <Field label="Reason" hint="Kept on record, and shown to the person."><textarea name="reason" rows={3} maxLength={500} required placeholder="e.g. Ran the old finance team for six years" /></Field>
              <Field label="How long">
                <select name="days" defaultValue="0">
                  <option value="0">No end date</option>
                  {EXPIRY_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </Field>
              {me.role === "admin" && (
                <label style={{ display: "flex", gap: 8, alignItems: "start", fontSize: 13 }}>
                  <input type="checkbox" name="counts" />
                  <span><b>Counts as complete.</b> It also satisfies required training and career requirements, as if they had passed the exam. Certificates still need the exam.</span>
                </label>
              )}
              <div><Button variant="primary">Give starting level</Button></div>
            </ActionForm>
          </Section>

          <Section title={`History · ${person.name}`} flush>
            {view.history.length === 0 ? <EmptyState title="No starting levels yet" body="Each one given, taken back or ended is listed here, with who and why." bare /> : (
              <div style={{ display: "grid" }}>
                {view.history.map((c) => (
                  <div key={c.id} style={{ padding: "10px 16px", borderTop: "1px solid var(--border, rgba(0,0,0,.08))", fontSize: 13 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <b>{c.track}</b><span>level {c.level}</span>
                      <Badge tone={c.state === "active" ? "ok" : "muted"}>{c.state === "active" ? "In force" : c.state === "expired" ? "Ended" : "Taken back"}</Badge>
                      {c.countsAsComplete && <Badge tone="warn">Counts as complete</Badge>}
                      <span style={{ color: "var(--muted)" }}>{day(c.createdAt)} · {c.source === "role" ? "from role, confirmed by" : "by"} {c.by}{c.revoker ? ` · taken back by ${c.revoker}` : ""}</span>
                    </div>
                    {c.reason && <div style={{ color: "var(--muted)", marginTop: 2 }}>{c.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
