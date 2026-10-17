import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { adminScopeOf, scopeChoices } from "@/lib/adminScope";
import { glanceCounts } from "@/lib/glance";
import { awaitingSignoff } from "@/lib/onboarding";
import { catalog } from "@/lib/paths";
import { trackInReach, usersInReach } from "@/lib/tenancy";
import { db, users } from "@/lib/db";
import { count } from "drizzle-orm";
import { Icon, PageHeader, Section, StatTile, Stats } from "@gg/ui";

export const metadata = { title: "Overview — gglearn admin" };

type Row = { href: string; icon: string; text: string; tone?: "danger" | "warn" };

export default async function Overview() {
  const me = await requireManager();
  const scope = await adminScopeOf(me);
  const mine = usersInReach(scope.reach);
  const people = mine ? mine.size : db.select({ n: count() }).from(users).get()?.n ?? 0;
  const g = glanceCounts(me, scope.reach);
  const signoffs = awaitingSignoff(me, scope.reach).length;
  const tracks = scope.reach.all ? catalog().length : catalog().filter((t) => trackInReach(scope.reach, t)).length;
  const choices = scopeChoices(me);
  const companyCount = scope.kind === "company" || scope.kind === "brand" ? 1 : choices.companies.length;
  const expiring = g.certs.expiring + g.certs.expired;

  const rows: Row[] = [
    signoffs > 0 && { href: "/admin/people", icon: "check", tone: "warn" as const, text: `${signoffs} onboarding phase${signoffs === 1 ? " is" : "s are"} finished and waiting for sign-off` },
    g.overdue > 0 && { href: "/admin/compliance", icon: "alert", tone: "danger" as const, text: `${g.overdue} ${g.overdue === 1 ? "person is" : "people are"} overdue on required learning` },
    expiring > 0 && { href: "/admin/certificates?show=expiring", icon: "clock", tone: "warn" as const, text: [g.certs.expiring && `${g.certs.expiring} certificate${g.certs.expiring === 1 ? "" : "s"} expire soon`, g.certs.expired && `${g.certs.expired} expired recently`].filter(Boolean).join(", ") },
    g.unassigned > 0 && { href: "/admin/people", icon: "users", text: `${g.unassigned} ${g.unassigned === 1 ? "person has" : "people have"} no company, brand or project, so no path` },
    g.invitesWaiting > 0 && { href: "/admin/people", icon: "mail", text: `${g.invitesWaiting} invite${g.invitesWaiting === 1 ? "" : "s"} not accepted yet` },
    g.unread > 0 && { href: "/admin/freshness", icon: "clock", text: `${g.unread} company update${g.unread === 1 ? "" : "s"} still unread by someone` },
    g.held > 0 && { href: "/admin/paths", icon: "database", text: `${g.held.toLocaleString("en-GB")} question${g.held === 1 ? " is" : "s are"} held for approval` },
  ].filter(Boolean) as Row[];

  return (
    <>
      <PageHeader icon="home" title="Overview" subtitle={scope.isMaster ? "The whole academy at a glance. Company and brand layers sit on top of this one." : `What needs doing for ${scope.name}.`} />
      <Stats>
        <StatTile icon="users" label="People" value={people.toLocaleString("en-GB")} href="/admin/people" />
        <StatTile icon="alert" label="Overdue" value={g.overdue} tone={g.overdue ? "danger" : undefined} hint="on required learning" href="/admin/compliance" />
        <StatTile icon="check" label="Waiting for sign-off" value={signoffs} tone={signoffs ? "warn" : undefined} href="/admin/people" />
        <StatTile icon="trophy" label="Certificates expiring" value={expiring} tone={expiring ? "warn" : undefined} hint="within 60 days or lately" href="/admin/certificates?show=expiring" />
        <StatTile icon="database" label="Tracks" value={tracks.toLocaleString("en-GB")} hint="in this scope" />
        <StatTile icon="briefcase" label={companyCount === 1 ? "Company" : "Companies"} value={companyCount} href={me.role === "admin" ? "/admin/setup" : undefined} />
      </Stats>

      <Section icon="inbox" title="Needs your attention" subtitle={rows.length ? "Each line goes to the screen where it is dealt with." : undefined}>
        {rows.length === 0 ? (
          <p className="section-sub" style={{ margin: 0 }}>Nothing is waiting: nobody is overdue and every sign-off is done.</p>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {rows.map((r) => (
              <Link key={r.text} href={r.href} className="nav-link" style={r.tone ? { color: `var(--${r.tone === "danger" ? "danger" : "warn"})` } : undefined}>
                <Icon name={r.icon} size={15} /><span style={{ flex: 1 }}>{r.text}</span><Icon name="arrow" size={14} />
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section icon="layers" title="How the scopes work" subtitle="Switch scope at the top of the side nav.">
        <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
          <div><b>Master</b> is the academy&apos;s general layer: the content and defaults every company starts from. Only the platform owner can open it.</div>
          <div><b>A company</b> shows that company&apos;s people, brands and content, and (as they arrive) its own settings on top of the master.</div>
          <div><b>A brand</b> narrows to one brand inside a company.</div>
          <div><b>Whole academy</b> or <b>Everything I run</b> shows all of it at once.</div>
          <div style={{ color: "var(--muted)" }}>Today the lists and counts follow your scope. Per-scope settings for exams, onboarding phases, questions, contests and journeys arrive in the next phases.</div>
        </div>
      </Section>
    </>
  );
}
