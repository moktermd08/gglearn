import type { Metadata } from "next";
import "../globals.css"; // the existing admin pages are still written for gglearn's own styles
import "../../src/gg-ui/styles.css"; // the shared GG kit; only this document loads it, so the learner site never sees it
import { Badge, Shell, type NavGroup } from "@gg/ui";
import { requireManager } from "@/lib/auth";
import { adminScopeOf, scopeChoices } from "@/lib/adminScope";
import { expiryWatchFor } from "@/lib/certsAdmin";
import { queueCount } from "@/lib/integrityAdmin";
import { isGlobal, reachOf } from "@/lib/tenancy";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Admin — gglearn" };

/** The admin is its own root layout (app/(admin)), separate from the learner site, so it can have its own frame and the kit's styles. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireManager();
  const scope = await adminScopeOf(me);
  const choices = scopeChoices(me);
  const admin = me.role === "admin", global = isGlobal(reachOf(me.id));
  const watch = expiryWatchFor(scope.reach); // only the holders of the few certificates in the window are looked up, so this costs next to nothing on every admin page

  // Pages only an admin, or only the platform owner, may open are left out of the nav for everyone else, as the pages themselves refuse them.
  const groups: NavGroup[] = [
    { label: "Work", items: [
      { href: "/admin", label: "Overview", icon: "home" },
      { href: "/admin/people", label: "People", icon: "users" },
      { href: "/admin/role-change", label: "Change a role", icon: "arrow" },
      { href: "/admin/compliance", label: "Compliance", icon: "shield" },
      { href: "/admin/certificates", label: "Certificates", icon: "trophy", count: watch.expiring + watch.expired },
      ...(admin ? [{ href: "/admin/integrity", label: "Exam integrity", icon: "shield", count: queueCount(scope.reach) }] : []),
    ] },
    { label: "Content", items: [
      ...(admin && global ? [{ href: "/admin/bank", label: "Question bank", icon: "database" }] : []),
      { href: "/admin/freshness", label: "Freshness", icon: "clock" },
    ] },
    { label: "Plan", items: [
      ...(admin ? [{ href: "/admin/paths", label: "Required learning", icon: "check" }] : []),
      { href: "/admin/careers", label: "Careers", icon: "arrow" },
      ...(admin ? [{ href: "/admin/rewards", label: "Rewards", icon: "coin" }] : []),
      ...(admin && global ? [{ href: "/admin/matrix", label: "Role matrix", icon: "table" }] : []),
    ] },
    { label: "Organisation", items: [
      { href: "/admin/profile", label: "Profile", icon: "briefcase" },
      ...(admin ? [{ href: "/admin/access", label: "Tool access", icon: "shield" }] : []),
    ] },
    ...(admin ? [{ label: "Setup", items: [{ href: "/admin/setup", label: "Companies and brands", icon: "briefcase" }] }] : []),
  ];

  return (
    <html lang="en" data-theme="light">
      <body className="antialiased">
        <Shell nav={<AdminNav groups={groups} scope={scope.value} choices={choices} signedInAs={me.name} />}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16, fontSize: 12, color: "var(--muted)" }}>
            <Badge tone={scope.isMaster ? "warn" : "muted"}>{scope.kind === "master" ? "Master" : scope.kind === "all" ? "All" : scope.kind === "company" ? "Company" : "Brand"}</Badge>
            <b style={{ color: "var(--text)" }}>{scope.name}</b>
            <span>{scope.blurb}{scope.isMaster ? " Pages without a master layer yet show the whole academy." : ""}</span>
          </div>
          {children}
        </Shell>
      </body>
    </html>
  );
}
