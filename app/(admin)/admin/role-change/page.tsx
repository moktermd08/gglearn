import Link from "next/link";
import { and, eq, like, or } from "drizzle-orm";
import { Badge, Banner, Button, EmptyState, Field, LinkButton, PageHeader, Section } from "@gg/ui";
import { db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { adminScopeOf } from "@/lib/adminScope";
import { knownRoles } from "@/lib/roles";
import { KINDS, describeChange, mayChangeRole, previewRoleChange, roleHistory } from "@/lib/roleChange";
import { usersInReach } from "@/lib/tenancy";
import { ActionForm } from "@/components/admin/ActionForm";
import { changeRoleAction } from "./actions";

export const metadata = { title: "Change a role — gglearn" };
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const kindLabel = (k: string) => KINDS.find((x) => x.key === k)?.label ?? k;

export default async function RoleChange({ searchParams }: { searchParams: Promise<{ q?: string; user?: string; role?: string; done?: string }> }) {
  const me = await requireManager();
  const { q = "", user: userParam, role: roleParam = "", done } = await searchParams;
  const scope = await adminScopeOf(me), mine = usersInReach(scope.reach);
  const inScope = (id: number) => !mine || mine.has(id);
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name]));
  const owner = (id: number | null) => (id != null ? names.get(id) ?? null : null);

  const target = userParam ? db.select().from(users).where(eq(users.id, Number(userParam) || 0)).get() : null;
  const person = target && inScope(target.id) ? target : null;
  const refusal = person ? mayChangeRole(me, person) : null;
  const needle = q.trim().toLowerCase();
  const found = !person && needle
    ? db.select().from(users).where(and(eq(users.status, "active"), or(like(users.name, `%${needle}%`), like(users.email, `%${needle}%`)))).orderBy(users.name).limit(60).all().filter((u) => inScope(u.id)).slice(0, 10) : [];
  const preview = person && !refusal && roleParam.trim() ? previewRoleChange(person.id, roleParam) : null;
  const changed = preview && preview.to !== preview.from;
  const a = preview?.access;
  const history = roleHistory(person?.id, 60).filter((h) => inScope(h.c.userId)).slice(0, 20);
  const latest = done && person ? history.find((h) => h.c.userId === person.id)?.c : null;
  const nAccess = a ? a.grant.length + a.raise.length + a.lower.length + a.revoke.length : 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader icon="arrow" title="Change a role" subtitle="Promotion, demotion or a move. See what the new role changes first: the learning it requires and the tool access to add, raise, lower or remove. Then apply it with the reason on record." />

      {latest && (
        <Banner tone="ok" icon="check">
          <div>
            <b>{person!.name} is now {latest.toRole}.</b> Recorded as {kindLabel(latest.kind).toLowerCase()}.
            {latest.actions ? " Now do these in the tools:" : " No tool access changes."}
            {latest.actions && <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{latest.actions.split("\n").map((l, i) => <li key={i}>{l}</li>)}</ul>}
          </div>
        </Banner>
      )}

      {!person && (
        <Section title="Who is changing role?">
          <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <Field label="Name or email"><input name="q" defaultValue={q} placeholder="Search people you run" autoFocus /></Field>
            <Button variant="primary">Search</Button>
          </form>
          {needle && found.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>Nobody active matches.</p>}
          {found.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {found.map((u) => (
                <div key={u.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                  <b>{u.name}</b><span style={{ color: "var(--muted)" }}>{u.email}</span><Badge tone="muted">{u.jobRole}</Badge>
                  <Link href={`/admin/role-change?user=${u.id}`} style={{ marginLeft: "auto" }}>Choose</Link>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {target && !person && <Banner tone="bad" icon="alert">That person is not someone you run.</Banner>}
      {person && refusal && <Banner tone="bad" icon="alert">{refusal} <Link href="/admin/role-change">Pick someone else</Link></Banner>}

      {person && !refusal && (
        <Section title={person.name} subtitle={`${person.email} · currently ${person.jobRole}`} action={<LinkButton href="/admin/role-change" size="sm" variant="ghost">Someone else</LinkButton>}>
          <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <input type="hidden" name="user" value={person.id} />
            <Field label="New role"><input name="role" list="roles" defaultValue={roleParam} placeholder="e.g. senior developer" required maxLength={40} /></Field>
            <Button variant="primary">See what changes</Button>
          </form>
          <datalist id="roles">{knownRoles().map((r) => <option key={r} value={r} />)}</datalist>
        </Section>
      )}

      {person && changed && preview && a && (
        <>
          <Section title="Learning" subtitle={`What ${person.name.split(" ")[0]} must pass changes with the role. Passes already earned stay.`}>
            {preview.learning.added.length === 0 && preview.learning.dropped.length === 0 ? <p style={{ fontSize: 13, color: "var(--muted)" }}>No change to required learning.</p> : (
              <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                {preview.learning.added.map((t) => <div key={t.id}><Badge tone="warn">Now required</Badge> {t.name}</div>)}
                {preview.learning.dropped.map((t) => <div key={t.id}><Badge tone="muted">No longer required</Badge> {t.name}</div>)}
              </div>
            )}
          </Section>

          <Section title="Tool access" subtitle="Recorded in the register when you apply. You still change the accounts in each tool.">
            {nAccess === 0 ? <p style={{ fontSize: 13, color: "var(--muted)" }}>No change to tool access.</p> : (
              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                {[...a.revoke].sort((x, y) => Number(y.tool.sensitivity === "sensitive") - Number(x.tool.sensitivity === "sensitive")).map((c) => <div key={`r${c.grantId}`}><Badge tone="bad">Remove</Badge> {describeChange("remove", c, owner).replace(/^\w+ /, "")}</div>)}
                {a.lower.map((c) => <div key={`l${c.grantId}`}><Badge tone="warn">Lower</Badge> {describeChange("lower", c, owner).replace(/^\w+ /, "")}</div>)}
                {a.raise.map((c) => <div key={`u${c.grantId}`}><Badge tone="ok">Raise</Badge> {describeChange("raise", c, owner).replace(/^\w+ /, "")}</div>)}
                {a.grant.map((c) => <div key={`g${c.tool.id}`}><Badge tone="ok">Add</Badge> {describeChange("add", c, owner).replace(/^\w+ /, "")}</div>)}
                {me.role !== "admin" && <Banner tone="warn" icon="alert">Only an admin records access changes in the register. Yours will be listed for them.</Banner>}
              </div>
            )}
          </Section>

          <Section title="Apply" subtitle={`${preview.from} → ${preview.to}`}>
            <ActionForm action={changeRoleAction} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
              <input type="hidden" name="userId" value={person.id} /><input type="hidden" name="jobRole" value={preview.to} />
              <Field label="This is a"><select name="kind" defaultValue="role_change">{KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></Field>
              <Field label="Reason" hint="Required for a promotion or demotion. Kept on record."><textarea name="note" rows={3} maxLength={1000} /></Field>
              <div><Button variant="primary">Change role to {preview.to}</Button></div>
            </ActionForm>
          </Section>
        </>
      )}
      {person && preview && !changed && <Banner tone="muted" icon="check">That is already their role.</Banner>}

      <Section title={person ? `Role history · ${person.name}` : "Recent role changes"} flush>
        {history.length === 0 ? <EmptyState title="No role changes yet" body="They will be listed here, with the reason and the tool actions." bare /> : (
          <div style={{ display: "grid" }}>
            {history.map((h) => (
              <div key={h.c.id} style={{ padding: "10px 16px", borderTop: "1px solid var(--border, rgba(0,0,0,.08))", fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <b>{h.who}</b><span>{h.c.fromRole} → {h.c.toRole}</span><Badge tone={h.c.kind === "demotion" ? "warn" : h.c.kind === "promotion" ? "ok" : "muted"}>{kindLabel(h.c.kind)}</Badge>
                  <span style={{ color: "var(--muted)" }}>{day(h.c.createdAt)} · by {names.get(h.c.decidedBy) ?? "someone"}</span>
                </div>
                {h.c.note && <div style={{ color: "var(--muted)", marginTop: 2 }}>{h.c.note}</div>}
                {h.c.actions && <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{h.c.actions.split("\n").map((l, i) => <li key={i}>{l}</li>)}</ul>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
