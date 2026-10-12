import { and, asc, eq, like, sql } from "drizzle-orm";
import { competitionMembers, competitions, db, tracks, users } from "@/lib/db";
import { CERT, XP, campaigns, type Campaign } from "@/content/campaigns";
import { stateOf, type State } from "@/lib/competitions";

export type RewardKind = "cash" | "voucher" | "certificate";
export type CampaignView = Campaign & {
  slug: string; round: number; trackName: string; trackKind: string; state: State | "soon"; humans: number; endsAt: number | null;
  rewardKind: RewardKind; headline: string;
};

export const SETS = { career: "Careers", general: "General", ai: "AI" } as const;
export type SetKey = keyof typeof SETS;

export function rewardKind(r: Campaign["reward"]): RewardKind {
  return r.cash > 0 ? "cash" : /Amazon voucher/.test(r.note) ? "voucher" : "certificate";
}

/** Short reward line for a card: the best thing you can win, certificates being the floor for everyone. */
function headline(r: Campaign["reward"]): string {
  if (r.cash > 0) return `$${r.cash / 100} prize pool`;
  const v = /\$(\d+) Amazon voucher/.exec(r.note);
  return v ? `$${v[1]} Amazon voucher` : "Certificate";
}

const SLUG_RE = /^camp-((?:career|general|ai)-\d{3})(?:-r(\d+))?$/;
const roundSlug = (id: string, round: number) => (round === 1 ? `camp-${id}` : `camp-${id}-r${round}`);
const now = () => Math.floor(Date.now() / 1000);

export type SyncResult = { created: number; renewed: number; waiting: string[]; noOrganiser: boolean };
let last: SyncResult = { created: 0, renewed: 0, waiting: [], noOrganiser: false }, lastRun = 0;
/** What the last sync found, for an admin notice. */
export const campaignStatus = () => last;

/**
 * Makes the contest rows behind the catalogue exist and keeps them running. Safe to call any time, any number of times:
 *  - a campaign with no contest yet gets round 1 (with its prizes);
 *  - a campaign whose latest round has ended gets the next round, starting now. Renewals are certificate-only: prizes are paid
 *    by the organiser, so they are offered once per campaign rather than open-ended on every round;
 *  - a campaign whose track is not in this database is skipped (listed in `waiting`), so a database that lacks some tracks still works;
 *  - with no active admin there is nobody to own the contests, so nothing is created (`noOrganiser`).
 * Slugs are unique and inserts ignore conflicts, so two requests racing cannot create a round twice.
 */
export function syncCampaigns(opts: { dry?: boolean } = {}): SyncResult {
  const t = now();
  const owner = db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active"))).orderBy(asc(users.id)).get();
  const trackIds = new Map(db.select({ slug: tracks.slug, id: tracks.id }).from(tracks).all().map((r) => [r.slug, r.id]));
  const latest = new Map<string, { round: number; endsAt: number }>();
  for (const r of db.select({ slug: competitions.slug, endsAt: competitions.endsAt }).from(competitions).where(like(competitions.slug, "camp-%")).all()) {
    const m = SLUG_RE.exec(r.slug);
    if (!m) continue;
    const round = m[2] ? Number(m[2]) : 1, cur = latest.get(m[1]);
    if (!cur || round > cur.round) latest.set(m[1], { round, endsAt: r.endsAt });
  }
  const waiting: string[] = [], jobs: { c: Campaign; trackId: number; round: number }[] = [];
  for (const c of campaigns) {
    const trackId = trackIds.get(c.track);
    if (trackId === undefined) { waiting.push(c.id); continue; }
    const cur = latest.get(c.id);
    if (!cur) jobs.push({ c, trackId, round: 1 });
    else if (cur.endsAt <= t) jobs.push({ c, trackId, round: cur.round + 1 });
  }
  const created = jobs.filter((j) => j.round === 1).length, renewed = jobs.length - created;
  if (!owner) return (last = { created: 0, renewed: 0, waiting, noOrganiser: true });
  if (!opts.dry && jobs.length) {
    db.transaction((tx) => {
      for (const { c, trackId, round } of jobs) {
        const first = round === 1;
        tx.insert(competitions).values({
          slug: roundSlug(c.id, round), title: first ? c.title : `${c.title} · Round ${round}`, description: c.hook, trackId, createdBy: owner.id,
          visibility: "public", joinPolicy: "open", goalLevels: c.goal, startsAt: t, endsAt: t + c.days * 86400, maxHumans: 500,
          prizeAmount: first ? c.reward.cash : 0, prizeCurrency: "USD", prizeSplit: first ? c.reward.split : "winner", prizeNote: first ? c.reward.note : `${CERT} ${XP}`,
        }).onConflictDoNothing().run();
      }
    });
  }
  return (last = { created, renewed, waiting, noOrganiser: false });
}

/** The catalogue joined with each campaign's current round. Campaigns whose track is missing from this database are left out. */
export function campaignViews(): CampaignView[] {
  if (Date.now() - lastRun > 60_000) { lastRun = Date.now(); syncCampaigns(); }
  const rows = db.select({ c: competitions, trackName: tracks.name, trackKind: tracks.kind }).from(competitions)
    .innerJoin(tracks, eq(tracks.id, competitions.trackId)).where(like(competitions.slug, "camp-%")).all();
  const current = new Map<string, { round: number; row: (typeof rows)[number] }>();
  for (const r of rows) {
    const m = SLUG_RE.exec(r.c.slug);
    if (!m) continue;
    const round = m[2] ? Number(m[2]) : 1, cur = current.get(m[1]);
    if (!cur || round > cur.round) current.set(m[1], { round, row: r });
  }
  const counts = new Map(db.select({ id: competitionMembers.competitionId, n: sql<number>`count(*)` }).from(competitionMembers)
    .where(and(eq(competitionMembers.kind, "human"), eq(competitionMembers.status, "joined"))).groupBy(competitionMembers.competitionId).all().map((r) => [r.id, r.n]));
  const trackNames = new Map(db.select({ slug: tracks.slug, name: tracks.name, kind: tracks.kind }).from(tracks).all().map((t) => [t.slug, t]));
  return campaigns.flatMap((c): CampaignView[] => {
    const t = trackNames.get(c.track);
    if (!t) return []; // this database does not have the track, so the campaign cannot be run here
    const cur = current.get(c.id), row = cur?.row;
    return [{
      ...c, slug: row?.c.slug ?? roundSlug(c.id, 1), round: cur?.round ?? 1, trackName: row?.trackName ?? t.name, trackKind: row?.trackKind ?? t.kind,
      state: row ? stateOf(row.c) : "soon", humans: row ? counts.get(row.c.id) ?? 0 : 0, endsAt: row?.c.endsAt ?? null,
      rewardKind: cur && cur.round > 1 ? "certificate" : rewardKind(c.reward), headline: cur && cur.round > 1 ? "Certificate" : headline(c.reward),
    }];
  });
}
