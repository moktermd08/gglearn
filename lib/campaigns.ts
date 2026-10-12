import { and, asc, eq, like, sql } from "drizzle-orm";
import { competitionMembers, competitions, db, tracks, users } from "@/lib/db";
import { CERT, XP, campaigns, type Campaign } from "@/content/campaigns";
import { stateOf, type State } from "@/lib/competitions";
import { periodAt } from "@/lib/seasons";

export type Cadence = "weekly" | "monthly" | "rolling";
export type RewardKind = "cash" | "voucher" | "certificate";
export type CampaignView = Campaign & {
  slug: string; round: string | null; cadence: Cadence; trackName: string; trackKind: string; state: State | "soon"; humans: number; endsAt: number | null;
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

/**
 * How a campaign repeats. A 7-day campaign runs every calendar week (Monday to Sunday, UTC); a 28 to 31 day campaign runs every
 * calendar month; anything else ("21 days", "45 days") starts its next round when the previous one ends.
 */
export const cadenceOf = (c: Pick<Campaign, "days">): Cadence => (c.days === 7 ? "weekly" : c.days >= 28 && c.days <= 31 ? "monthly" : "rolling");
const PERIOD = { weekly: "week", monthly: "month" } as const;

// camp-<id> is round 1; later rounds add -r<N> (rolling) or the period they cover: -2026-W43 (weekly) or -2026-11 (monthly)
const SLUG_RE = /^camp-((?:career|general|ai)-\d{3})(?:-(r\d+|\d{4}-W\d{2}|\d{4}-\d{2}))?$/;
const roundSlug = (id: string, suffix?: string) => (suffix ? `camp-${id}-${suffix}` : `camp-${id}`);
const now = () => Math.floor(Date.now() / 1000);

/** "Round 2", "Week 43" or "November 2026" for a round's slug suffix; null for round 1. */
function roundLabel(suffix: string | undefined, kind: Cadence): string | null {
  if (!suffix) return null;
  if (suffix.startsWith("r")) return `Round ${suffix.slice(1)}`;
  return kind === "weekly" ? `Week ${Number(suffix.slice(6))}` : periodAt("month", Date.parse(`${suffix}-15T00:00:00Z`) / 1000).label;
}

export type SyncResult = { created: number; renewed: number; waiting: string[]; noOrganiser: boolean };
let last: SyncResult = { created: 0, renewed: 0, waiting: [], noOrganiser: false }, lastRun = 0;
/** What the last sync found, for an admin notice. */
export const campaignStatus = () => last;

type Round = { slug: string; suffix?: string; startsAt: number; endsAt: number };
const rounds = (): Map<string, Round[]> => {
  const out = new Map<string, Round[]>();
  for (const r of db.select({ slug: competitions.slug, startsAt: competitions.startsAt, endsAt: competitions.endsAt }).from(competitions).where(like(competitions.slug, "camp-%")).all()) {
    const m = SLUG_RE.exec(r.slug);
    if (m) out.set(m[1], [...(out.get(m[1]) ?? []), { slug: r.slug, suffix: m[2], startsAt: r.startsAt, endsAt: r.endsAt }]);
  }
  return out;
};

/**
 * Makes the contest rows behind the catalogue exist and keeps them running. Safe to call any time, any number of times:
 *  - a campaign with no contest yet gets round 1 (with its prizes), starting now for its length in days;
 *  - once every round of a campaign has ended, the next one begins. Weekly and monthly campaigns get the calendar week or month
 *    that is running, counted from its first day, so everyone races over the same window and a visit on Wednesday still credits
 *    Monday's work. Other campaigns get a fresh round starting now. Renewals are certificate-only: prizes are paid by the
 *    organiser, so they are offered once per campaign rather than open-ended on every round;
 *  - a campaign whose track is not in this database is skipped (listed in `waiting`);
 *  - with no active admin there is nobody to own the contests, so nothing is created (`noOrganiser`).
 * Slugs are unique and inserts ignore conflicts, so two requests racing cannot create a round twice.
 * `at` is the time to act as (seconds); it exists so the calendar logic can be tested.
 */
export function syncCampaigns(opts: { dry?: boolean; at?: number } = {}): SyncResult {
  const t = opts.at ?? now();
  const owner = db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active"))).orderBy(asc(users.id)).get();
  const trackIds = new Map(db.select({ slug: tracks.slug, id: tracks.id }).from(tracks).all().map((r) => [r.slug, r.id]));
  const all = rounds();
  const waiting: string[] = [], jobs: { c: Campaign; trackId: number; slug: string; title: string; startsAt: number; endsAt: number; first: boolean }[] = [];
  for (const c of campaigns) {
    const trackId = trackIds.get(c.track);
    if (trackId === undefined) { waiting.push(c.id); continue; }
    const have = all.get(c.id) ?? [];
    if (have.length === 0) { jobs.push({ c, trackId, slug: roundSlug(c.id), title: c.title, startsAt: t, endsAt: t + c.days * 86400, first: true }); continue; }
    if (have.some((r) => r.endsAt > t)) continue; // a round is still running
    const cadence = cadenceOf(c);
    if (cadence === "rolling") {
      const n = Math.max(1, ...have.map((r) => (r.suffix?.startsWith("r") ? Number(r.suffix.slice(1)) : 1))) + 1;
      jobs.push({ c, trackId, slug: roundSlug(c.id, `r${n}`), title: `${c.title} · Round ${n}`, startsAt: t, endsAt: t + c.days * 86400, first: false });
    } else {
      const p = periodAt(PERIOD[cadence], t);
      jobs.push({ c, trackId, slug: roundSlug(c.id, p.key), title: `${c.title} · ${roundLabel(p.key, cadence)}`, startsAt: p.start, endsAt: p.end, first: false });
    }
  }
  const created = jobs.filter((j) => j.first).length, renewed = jobs.length - created;
  if (!owner) return (last = { created: 0, renewed: 0, waiting, noOrganiser: true });
  if (!opts.dry && jobs.length) {
    db.transaction((tx) => {
      for (const j of jobs) {
        tx.insert(competitions).values({
          slug: j.slug, title: j.title, description: j.c.hook, trackId: j.trackId, createdBy: owner.id, visibility: "public", joinPolicy: "open",
          goalLevels: j.c.goal, startsAt: j.startsAt, endsAt: j.endsAt, maxHumans: 500,
          prizeAmount: j.first ? j.c.reward.cash : 0, prizeCurrency: "USD", prizeSplit: j.first ? j.c.reward.split : "winner", prizeNote: j.first ? j.c.reward.note : `${CERT} ${XP}`,
        }).onConflictDoNothing().run();
      }
    });
  }
  return (last = { created, renewed, waiting, noOrganiser: false });
}

/** The catalogue joined with each campaign's current round. Campaigns whose track is missing from this database are left out. */
/** Runs the sync at most once a minute per server process; called wherever a visitor might look for contests. */
export function keepCampaignsFresh() {
  if (Date.now() - lastRun > 60_000) { lastRun = Date.now(); syncCampaigns(); }
}

export function campaignViews(): CampaignView[] {
  keepCampaignsFresh();
  const rows = db.select({ c: competitions, trackName: tracks.name, trackKind: tracks.kind }).from(competitions)
    .innerJoin(tracks, eq(tracks.id, competitions.trackId)).where(like(competitions.slug, "camp-%")).all();
  const current = new Map<string, { suffix?: string; row: (typeof rows)[number] }>();
  for (const r of rows) {
    const m = SLUG_RE.exec(r.c.slug);
    if (!m) continue;
    const cur = current.get(m[1]);
    if (!cur || r.c.endsAt > cur.row.c.endsAt) current.set(m[1], { suffix: m[2], row: r }); // the latest round is the one that ends last
  }
  const counts = new Map(db.select({ id: competitionMembers.competitionId, n: sql<number>`count(*)` }).from(competitionMembers)
    .where(and(eq(competitionMembers.kind, "human"), eq(competitionMembers.status, "joined"))).groupBy(competitionMembers.competitionId).all().map((r) => [r.id, r.n]));
  const trackNames = new Map(db.select({ slug: tracks.slug, name: tracks.name, kind: tracks.kind }).from(tracks).all().map((t) => [t.slug, t]));
  return campaigns.flatMap((c): CampaignView[] => {
    const t = trackNames.get(c.track);
    if (!t) return []; // this database does not have the track, so the campaign cannot be run here
    const cur = current.get(c.id), row = cur?.row, cadence = cadenceOf(c), renewal = !!cur?.suffix;
    // what this round actually offers: prizes belong to round 1 only, so the catalogue's prize must not be advertised on a renewal
    const reward: Campaign["reward"] = renewal ? { cash: 0, split: "winner", note: `${CERT} ${XP}` } : c.reward;
    return [{
      ...c, reward, slug: row?.c.slug ?? roundSlug(c.id), round: roundLabel(cur?.suffix, cadence), cadence, trackName: row?.trackName ?? t.name, trackKind: row?.trackKind ?? t.kind,
      state: row ? stateOf(row.c) : "soon", humans: row ? counts.get(row.c.id) ?? 0 : 0, endsAt: row?.c.endsAt ?? null,
      rewardKind: rewardKind(reward), headline: headline(reward),
    }];
  });
}
