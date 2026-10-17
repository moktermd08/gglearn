import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Badge, Button, EmptyState, Field, PageHeader, Section, StatTile, Stats } from "@gg/ui";
import { brands, companies, db, toolAccess, toolRoleAccess, tools, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { adminScopeOf } from "@/lib/adminScope";
import { TOOL_CATEGORIES, holdersOf, leaversWithAccess } from "@/lib/access";
import { canManageTool } from "@/lib/accessAdmin";
import { knownRoles } from "@/lib/roles";
import { isGlobal, scopeInReach, usersInReach } from "@/lib/tenancy";
import { ActionForm } from "@/components/admin/ActionForm";
import { addToolAction, grantAction, removeRoleAccessAction, revokeAction, setRoleAccessAction, updateToolAction } from "./actions";

export const metadata = { title: "Tool access — gglearn" };
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const REASONS: [string, string][] = [["no_longer_needed", "No longer needed"], ["role_change", "Role change"], ["demotion", "Demotion"], ["offboarding", "Offboarding"], ["security", "Security"], ["other", "Other"]];

export default async function Access() {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const scope = await adminScopeOf(me), reach = scope.reach, mine = usersInReach(reach);
  const cos = db.select().from(companies).orderBy(companies.name).all().filter((c) => scopeInReach(reach, { kind: "company", id: c.id }));
  const bs = db.select().from(brands).orderBy(brands.name).all().filter((b) => b.kind === "company" && scopeInReach(reach, { kind: "brand", id: b.id }));
  const coName = new Map(cos.map((c) => [c.id, c.academyName || c.name])), brandName = new Map(bs.map((b) => [b.id, b.name]));
  const all = db.select().from(tools).orderBy(tools.name).all().filter((t) => t.scope === "global" ? isGlobal(reach) || scope.kind === "all" : t.scope === "company" ? coName.has(t.refId) : brandName.has(t.refId));
  const whereOf = (t: typeof all[number]) => t.scope === "global" ? "Every company" : t.scope === "company" ? coName.get(t.refId) : brandName.get(t.refId);
  const owners = db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.status, "active")).orderBy(users.name).all().filter((u) => u.role !== "learner" && (!mine || mine.has(u.id)));
  const leavers = leaversWithAccess().filter((l) => all.some((t) => t.id === l.tool.id));
  const roleRows = db.select().from(toolRoleAccess).all();
  const roles = knownRoles();
  const live = all.filter((t) => t.retired === "no");
  const holders = new Map(live.map((t) => [t.id, holdersOf(t.id).filter((h) => h.status === "active")]));
  const held = [...holders.values()].reduce((n, h) => n + h.length, 0);
  const noOwner = live.filter((t) => t.ownerId == null).length;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader icon="shield" title="Tool access" subtitle="Every system your people use, who owns it, who has it, and how to take it away. This records access; you still create and remove the accounts in each tool." />
      <Stats>
        <StatTile label="Tools" value={live.length} icon="grid" hint={noOwner ? `${noOwner} with no owner` : "All have an owner"} tone={noOwner ? "warn" : undefined} />
        <StatTile label="Sensitive" value={live.filter((t) => t.sensitivity === "sensitive").length} icon="shield" hint="Money, production, customer data" />
        <StatTile label="Grants held" value={held} icon="users" />
        <StatTile label="Leavers still holding access" value={leavers.length} tone={leavers.length ? "bad" : "ok"} icon="alert" />
      </Stats>

      {leavers.length > 0 && (
        <Section title="Leavers who still have access" subtitle="Remove the account in the tool first, then record it here. Sensitive tools first.">
          <div style={{ display: "grid", gap: 8 }}>
            {[...leavers].sort((a, b) => Number(b.tool.sensitivity === "sensitive") - Number(a.tool.sensitivity === "sensitive")).map((l) => (
              <ActionForm key={l.grant.id} action={revokeAction} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <b>{l.name}</b><span>{l.tool.name} ({l.grant.level})</span>{l.tool.sensitivity === "sensitive" && <Badge tone="bad">Sensitive</Badge>}
                <span style={{ color: "var(--muted)", fontSize: 12 }}>since {day(l.grant.grantedAt)}{l.tool.revokeSteps ? ` · ${l.tool.revokeSteps}` : ""}</span>
                <input type="hidden" name="accessId" value={l.grant.id} /><input type="hidden" name="reason" value="offboarding" />
                <Button size="sm" variant="danger" style={{ marginLeft: "auto" }}>Mark removed</Button>
              </ActionForm>
            ))}
          </div>
        </Section>
      )}

      <Section title="Add a tool" subtitle="Global tools (used by every company) can only be added by the platform owner.">
        <ActionForm action={addToolAction} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Field label="Name"><input name="name" required maxLength={80} placeholder="e.g. GitHub" /></Field>
          <Field label="Belongs to">
            <select name="where" defaultValue={scope.kind === "company" ? `company:${scope.id}` : scope.kind === "brand" ? `brand:${scope.id}` : undefined}>
              {isGlobal(reach) && <option value="global">Every company</option>}
              {cos.map((c) => <option key={c.id} value={`company:${c.id}`}>Company · {coName.get(c.id)}</option>)}
              {bs.map((b) => <option key={b.id} value={`brand:${b.id}`}>Brand · {b.name}</option>)}
            </select>
          </Field>
          <Field label="Kind"><select name="category" defaultValue="other">{TOOL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Sensitivity"><select name="sensitivity"><option value="standard">Standard</option><option value="sensitive">Sensitive (money, production, customer data)</option></select></Field>
          <Field label="Owner (grants and revokes)"><select name="ownerId" defaultValue=""><option value="">No owner yet</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          <Field label="How to take access away"><input name="revokeSteps" maxLength={1000} placeholder="e.g. Org settings → People → Remove" /></Field>
          <div style={{ alignSelf: "end" }}><Button variant="primary">Add tool</Button></div>
        </ActionForm>
      </Section>

      {live.length === 0 ? <EmptyState title="No tools yet" body="Add the first one above. Start with whatever would hurt most if a leaver kept it: money, production, customer data." /> : live.map((t) => {
        const manage = canManageTool(me, t), defaults = roleRows.filter((r) => r.toolId === t.id).sort((a, b) => a.jobRole.localeCompare(b.jobRole)), hs = holders.get(t.id)!;
        return (
          <Section key={t.id} title={<>{t.name} {t.sensitivity === "sensitive" && <Badge tone="bad">Sensitive</Badge>}</>} subtitle={`${whereOf(t)} · ${t.category} · ${hs.length} ${hs.length === 1 ? "person has" : "people have"} it`}>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>{t.ownerId ? `Owner ${owners.find((o) => o.id === t.ownerId)?.name ?? "outside your view"}` : "No owner"} · open to manage</summary>
              <div style={{ display: "grid", gap: 20 }}>
                {manage && (
                  <ActionForm action={updateToolAction} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                    <input type="hidden" name="toolId" value={t.id} />
                    <Field label="Name"><input name="name" defaultValue={t.name} required maxLength={80} /></Field>
                    <Field label="Kind"><select name="category" defaultValue={t.category}>{TOOL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                    <Field label="Sensitivity"><select name="sensitivity" defaultValue={t.sensitivity}><option value="standard">Standard</option><option value="sensitive">Sensitive</option></select></Field>
                    <Field label="Owner"><select name="ownerId" defaultValue={t.ownerId ?? ""}><option value="">No owner</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
                    <Field label="How to take access away"><input name="revokeSteps" defaultValue={t.revokeSteps} maxLength={1000} /></Field>
                    <Field label="Retire this tool"><select name="retired" defaultValue="no"><option value="no">Still in use</option><option value="yes">Retired (hidden, no new grants)</option></select></Field>
                    <div style={{ alignSelf: "end" }}><Button variant="primary">Save</Button></div>
                  </ActionForm>
                )}

                <div>
                  <b style={{ fontSize: 13 }}>Default access by job role</b>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 8px" }}>Onboarding lists these for a new joiner, and a promotion, demotion or role change is compared against them. Use * for everyone.</p>
                  {defaults.length === 0 ? <p style={{ fontSize: 13, color: "var(--muted)" }}>No defaults: nobody gets this automatically.</p> : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      {defaults.map((d) => (
                        <form key={d.id} action={removeRoleAccessAction}><input type="hidden" name="id" value={d.id} />
                          <Badge tone="muted">{d.jobRole === "*" ? "Everyone" : d.jobRole} · {d.level}{manage && <button title="Remove" style={{ marginLeft: 6, border: 0, background: "none", cursor: "pointer" }}>×</button>}</Badge>
                        </form>
                      ))}
                    </div>
                  )}
                  {manage && (
                    <ActionForm action={setRoleAccessAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                      <input type="hidden" name="toolId" value={t.id} />
                      <Field label="Job role"><input name="jobRole" list="job-roles" required placeholder="developer or *" /></Field>
                      <Field label="Level"><select name="level" defaultValue="user"><option value="user">User</option><option value="admin">Admin</option><option value="owner">Owner</option><option value="none">Remove default</option></select></Field>
                      <Button>Set default</Button>
                    </ActionForm>
                  )}
                </div>

                <div>
                  <b style={{ fontSize: 13 }}>Who has it</b>
                  {hs.length === 0 ? <p style={{ fontSize: 13, color: "var(--muted)" }}>Nobody.</p> : (
                    <div style={{ display: "grid", gap: 6, margin: "8px 0" }}>
                      {hs.map((h) => (
                        <ActionForm key={h.grant.id} action={revokeAction} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                          <b>{h.name}</b><Badge tone="muted">{h.grant.level}</Badge><span style={{ color: "var(--muted)" }}>since {day(h.grant.grantedAt)}</span>
                          {manage && <>
                            <input type="hidden" name="accessId" value={h.grant.id} />
                            <select name="reason" defaultValue="no_longer_needed" style={{ marginLeft: "auto" }}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                            <Button size="sm" variant="ghost">Mark removed</Button>
                          </>}
                        </ActionForm>
                      ))}
                    </div>
                  )}
                  {manage && (
                    <ActionForm action={grantAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                      <input type="hidden" name="toolId" value={t.id} />
                      <Field label="Person's email"><input name="email" type="email" required placeholder="name@company.com" /></Field>
                      <Field label="Level"><select name="level" defaultValue="user"><option value="user">User</option><option value="admin">Admin</option><option value="owner">Owner</option></select></Field>
                      <Button>Record access given</Button>
                    </ActionForm>
                  )}
                </div>
              </div>
            </details>
          </Section>
        );
      })}
      <datalist id="job-roles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
    </div>
  );
}
