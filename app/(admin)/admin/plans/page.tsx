import Link from "next/link";
import { and, eq, like, or } from "drizzle-orm";
import { Badge, Banner, Button, Field, LinkButton, PageHeader, Section } from "@gg/ui";
import { db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { mayManage, manualItemsFor } from "@/lib/planItems";
import { planFor } from "@/lib/plan";
import { PlanItemForm } from "@/components/PlanItemForm";
import { addForAction, removeForAction, signOffAction } from "./actions";

export const metadata = { title: "Plans — gglearn" };
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

export default async function Plans({ searchParams }: { searchParams: Promise<{ q?: string; user?: string }> }) {
  const me = await requireManager();
  const { q = "", user: userParam } = await searchParams;
  const target = userParam ? db.select().from(users).where(eq(users.id, Number(userParam) || 0)).get() : null;
  const person = target && mayManage(me, target.id) ? target : null;
  const needle = q.trim().toLowerCase();
  const found = !person && needle
    ? db.select().from(users).where(and(eq(users.status, "active"), or(like(users.name, `%${needle}%`), like(users.email, `%${needle}%`)))).orderBy(users.name).limit(60).all().filter((u) => mayManage(me, u.id)).slice(0, 10) : [];
  const plan = person ? planFor(person) : null;
  const items = person ? manualItemsFor(person.id) : [];
  const first = person?.name.split(" ")[0] ?? "";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader icon="target" title="Plans" subtitle="Set things for someone you run that the academy cannot measure itself, like shadowing a release or a monthly 1:1, and see how their whole plan is going. Exams, required learning and goals count on their own." />

      {!person && (
        <Section title="Whose plan?">
          <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <Field label="Name or email"><input name="q" defaultValue={q} placeholder="Search people you run" autoFocus /></Field>
            <Button variant="primary">Search</Button>
          </form>
          {needle && found.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>Nobody you run matches.</p>}
          {found.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {found.map((u) => (
                <div key={u.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                  <b>{u.name}</b><span style={{ color: "var(--muted)" }}>{u.email}</span><Badge tone="muted">{u.jobRole}</Badge>
                  <Link href={`/admin/plans?user=${u.id}`} style={{ marginLeft: "auto" }}>Open</Link>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {target && !person && <Banner tone="bad" icon="alert">That person is not someone you run, or is you. <Link href="/admin/plans">Pick someone else</Link></Banner>}

      {person && plan && (
        <>
          <Section title={person.name} subtitle={`${person.email} · ${person.jobRole}`} action={<LinkButton href="/admin/plans" size="sm" variant="ghost">Someone else</LinkButton>}>
            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <div><b>{plan.done} of {plan.total}</b> plan items done{plan.goal ? ` · goal ${plan.goal.title}` : " · no goal set"}</div>
              <div style={{ color: "var(--muted)" }}>{plan.week.activeDays} of the last 7 days active (aim for {plan.week.target})</div>
              {plan.items.filter((i) => i.status === "overdue").length > 0 && <div><Badge tone="bad">Overdue</Badge> {plan.items.filter((i) => i.status === "overdue").map((i) => i.title).slice(0, 5).join(", ")}</div>}
              {plan.focus.length > 0 && <div style={{ color: "var(--muted)" }}>Their focus now: {plan.focus.map((i) => i.title).join(", ")}</div>}
            </div>
          </Section>

          <Section title={`Set for ${first}`} subtitle="These show on their plan page. They log progress themselves, and you can sign a once-only item off.">
            {items.length === 0 ? <p style={{ fontSize: 13, color: "var(--muted)" }}>Nothing set yet.</p> : (
              <div style={{ display: "grid", gap: 10 }}>
                {items.map((m) => (
                  <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
                    <b>{m.title}</b>
                    <Badge tone={m.done ? "ok" : m.overdue ? "bad" : "muted"}>{m.done ? (m.signedOff ? "Signed off" : "Done") : `${m.have} of ${m.need}`}</Badge>
                    <span style={{ color: "var(--muted)" }}>{m.period === "weekly" ? `${m.need} a week` : m.dueAt ? `by ${day(m.dueAt)}` : "in total"} · {m.mine ? "their own" : `set by ${m.setBy}`}</span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                      {m.period === "once" && (m.signedOff
                        ? <form action={signOffAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="undo" value="1" /><button style={{ textDecoration: "underline" }}>Undo sign-off</button></form>
                        : <form action={signOffAction}><input type="hidden" name="id" value={m.id} /><button style={{ textDecoration: "underline" }}>Sign off</button></form>)}
                      <form action={removeForAction}><input type="hidden" name="id" value={m.id} /><button style={{ textDecoration: "underline" }}>Remove</button></form>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Add something for ${first}`}>
            <PlanItemForm action={addForAction} hidden={{ userId: person.id }} button={`Add for ${first}`} />
          </Section>
        </>
      )}
    </div>
  );
}
