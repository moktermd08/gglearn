/**
 * Team, company and role leaderboards for a season. Groups are made of the same people the individual board ranks, so hidden
 * people and customers are never included. Scope membership comes from `user_scopes` (company, brand, project); roles from the
 * person's job role.
 *
 * Ranking is by AVERAGE points per member, so a big team does not win just by being big. Members who scored nothing count as
 * zero. A group needs at least two members to be ranked (a one-person "team" would top the board by default).
 */
import { and, eq } from "drizzle-orm";
import { brands, companies, db, projects, userScopes, users } from "@/lib/db";
import { roleLabel } from "@/lib/journey";
import type { Row } from "@/lib/seasons";
import { arenaMap, arenaOf, type Arena } from "@/lib/arena";

export type GroupKind = "team" | "company" | "role";
export type Group = { key: string; name: string; sub: string; memberIds: number[] };
export type GroupRow = { key: string; name: string; sub: string; members: number; active: number; total: number; levels: number; avg: number; rank: number | null; mine: boolean };

export const MIN_MEMBERS = 2;

/** Groups are made only of people in `arena`, so a company never sees another company's teams or counts them as members. */
export function groupsOf(kind: GroupKind, arena: Arena): Group[] {
  const arenas = arenaMap();
  const people = db.select({ id: users.id, jobRole: users.jobRole }).from(users)
    .where(and(eq(users.audience, "staff"), eq(users.status, "active"), eq(users.seasonBoard, "show"))).all()
    .filter((u) => arenaOf(u.id, arenas) === arena);
  const ids = new Set(people.map((p) => p.id));
  const out = new Map<string, Group>();
  const add = (key: string, name: string, sub: string, userId: number) => {
    const g = out.get(key) ?? out.set(key, { key, name, sub, memberIds: [] }).get(key)!;
    if (!g.memberIds.includes(userId)) g.memberIds.push(userId);
  };
  if (kind === "role") {
    for (const p of people) if (p.jobRole && p.jobRole !== "general") add(`role:${p.jobRole}`, roleLabel(p.jobRole), "Same job role", p.id);
    return [...out.values()];
  }
  const scopes = db.select().from(userScopes).all().filter((s) => ids.has(s.userId));
  const co = new Map(db.select().from(companies).all().map((c) => [c.id, c.name]));
  const br = new Map(db.select().from(brands).all().map((b) => [b.id, b]));
  const pr = new Map(db.select().from(projects).all().map((p) => [p.id, p]));
  for (const s of scopes) {
    if (kind === "company") {
      const companyId = s.kind === "company" ? s.refId : s.kind === "brand" ? br.get(s.refId)?.companyId : pr.get(s.refId)?.companyId ?? (pr.get(s.refId)?.brandId ? br.get(pr.get(s.refId)!.brandId!)?.companyId : null);
      if (companyId && co.has(companyId)) add(`company:${companyId}`, co.get(companyId)!, "Company", s.userId);
    } else if (s.kind === "brand") {
      const b = br.get(s.refId);
      if (b && b.kind === "company") add(`brand:${b.id}`, b.name, b.companyId ? co.get(b.companyId) ?? "Brand" : "Brand", s.userId); // shared and personal brands are not teams
    } else if (s.kind === "project") {
      const p = pr.get(s.refId);
      if (p) add(`project:${p.id}`, p.name, p.brandId ? br.get(p.brandId)?.name ?? "Project" : "Project", s.userId);
    }
  }
  return [...out.values()];
}

export function rankGroups(groups: Group[], rows: Row[], meId: number): GroupRow[] {
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  const list = groups.map((g): GroupRow => {
    const scored = g.memberIds.map((id) => byUser.get(id)).filter((r): r is Row => !!r);
    const total = scored.reduce((s, r) => s + r.points, 0);
    return { key: g.key, name: g.name, sub: g.sub, members: g.memberIds.length, active: scored.length, total, levels: scored.reduce((s, r) => s + r.levels, 0), avg: Math.round((total / g.memberIds.length) * 10) / 10, rank: null, mine: g.memberIds.includes(meId) };
  });
  const eligible = list.filter((g) => g.members >= MIN_MEMBERS && g.total > 0).sort((a, b) => b.avg - a.avg || b.total - a.total || b.active - a.active || a.name.localeCompare(b.name));
  eligible.forEach((g, i) => (g.rank = i + 1));
  return [...eligible, ...list.filter((g) => g.rank === null).sort((a, b) => b.members - a.members || a.name.localeCompare(b.name))];
}
