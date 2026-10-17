"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, ScopeItem, SideNav, type NavGroup } from "@gg/ui";
import { setAdminScope } from "@/app/(admin)/admin/scope-action";
import { logout } from "@/app/actions";
import type { ScopeChoices } from "@/lib/adminScope";

/**
 * The admin's side nav, built on the shared GG kit: the app mark, the scope switcher, links in groups with counts, and who is signed in.
 * The switcher is a plain form of buttons posting to a server action, so it works without any client state.
 */
export function AdminNav({ groups, scope, choices, signedInAs }: {
  groups: NavGroup[]; scope: string; choices: ScopeChoices; signedInAs: string;
}) {
  const path = usePathname();
  const mark = (name: string) => <span className="brand-mark all" style={{ width: 22, height: 22 }}><Icon name={name} size={12} /></span>;
  // brands are listed under the company that is in view, so a long list of companies stays short
  const open = choices.companies.find((c) => scope === `company:${c.id}` || c.brands.some((b) => scope === `brand:${b.id}`));
  return (
    <SideNav
      app={{ name: "gglearn", tagline: "admin", icon: "target" }}
      path={path}
      hotAt={0}
      groups={groups}
      top={(
        <>
          <div className="group">Scope</div>
          <div className="scope-list">
            <form action={setAdminScope}>
              <input type="hidden" name="next" value={path} />
              {choices.owner && <ScopeItem field="scope" on={scope === "master"} value="master" label="Master" title="The academy's general layer: what every company starts from" mark={mark("layers")} />}
              <ScopeItem field="scope" on={scope === "all"} value="all" label={choices.owner ? "Whole academy" : "Everything I run"} mark={mark("grid")} count={choices.companies.length} />
              {choices.companies.map((c) => (
                <div key={c.id}>
                  <ScopeItem field="scope" on={scope === `company:${c.id}`} value={`company:${c.id}`} label={c.name} title={`Focus on ${c.name}`} mark={mark("briefcase")} />
                  {open?.id === c.id && c.brands.map((b) => (
                    <div key={b.id} style={{ paddingLeft: 18 }}>
                      <ScopeItem field="scope" on={scope === `brand:${b.id}`} value={`brand:${b.id}`} label={b.name} title={`Focus on ${b.name}`} mark={<span className="brand-mark all" style={{ width: 14, height: 14, marginLeft: 4 }} />} />
                    </div>
                  ))}
                </div>
              ))}
            </form>
          </div>
        </>
      )}
      footer={(
        <>
          <div style={{ marginBottom: 6 }}>Signed in as {signedInAs}</div>
          <Link href="/dashboard" className="nav-link" style={{ padding: "5px 0" }}><Icon name="home" size={14} />Back to the academy</Link>
          <form action={logout}><button className="nav-link" style={{ padding: "5px 0", width: "100%", background: "none", border: 0, font: "inherit", cursor: "pointer", textAlign: "left" }}><Icon name="power" size={14} />Sign out</button></form>
        </>
      )}
    />
  );
}
