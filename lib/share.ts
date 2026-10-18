import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { certificates, competitionMembers, competitions, db, duels, leagueEntries, runs, seasonResults, shareCards, tracks, users } from "@/lib/db";
import { TIERS as LEAGUE_TIERS, nextTier } from "@/lib/leagueRules";
import { botNameFor } from "@/lib/duelRules";
import { standings, stateOf } from "@/lib/competitions";
import { topicLabel } from "@/lib/topicName";
import { LEVELS, TIERS, certTitle, tierOf } from "@/lib/levels";
import { periodByKey, shortName, type Kind } from "@/lib/seasons";
import { progressionFor } from "@/lib/progression";

export type ShareKind = (typeof shareCards.$inferSelect)["kind"];
export type Snapshot = Pick<typeof shareCards.$inferInsert, "kind" | "ref" | "headline" | "title" | "subtitle" | "tone" | "name">;

/** Colours for the card, by tone. */
export const TONES: Record<string, { from: string; to: string; ink: string }> = {
  bronze: { from: "#f59e0b", to: "#b45309", ink: "#fff7ed" },
  silver: { from: "#94a3b8", to: "#475569", ink: "#f8fafc" },
  gold: { from: "#fbbf24", to: "#d97706", ink: "#fffbeb" },
  legend: { from: "#d946ef", to: "#6d28d9", ink: "#fdf4ff" },
  indigo: { from: "#6366f1", to: "#9333ea", ink: "#eef2ff" },
  orange: { from: "#fb923c", to: "#dc2626", ink: "#fff7ed" },
};

const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold", legend: "Legend" } as const;

/** Where the app is served from, for absolute links in previews. Set SITE_URL in production; otherwise the request's own host is used. */
export async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers(), host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/**
 * What a share card says, rebuilt from real data every time. Never trusts the browser: a card only exists for something the
 * person has actually earned. Returns null when the thing does not exist or is not earned yet.
 */
export function snapshotFor(me: { id: number; name: string }, kind: ShareKind, ref: string): Snapshot | null {
  const name = shortName(me.name);
  if (kind === "race") {
    const c = db.select().from(competitions).where(eq(competitions.slug, ref)).get();
    if (!c) return null;
    const members = db.select().from(competitionMembers).where(eq(competitionMembers.competitionId, c.id)).all();
    if (!members.some((m) => m.userId === me.id && m.status === "joined" && m.kind === "human")) return null; // only someone in the race can share it
    const state = stateOf(c);
    if (state === "canceled") return null;
    const topic = topicLabel(db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, c.trackId)).get()?.n ?? "a topic");
    // a private race never puts its own name on a public card
    const title = c.visibility === "public" ? c.title : "a private race";
    if (state === "upcoming") return { kind, ref, headline: "Joined", title: `Racing: ${title}`, subtitle: `Gain ${c.goalLevels} level${c.goalLevels === 1 ? "" : "s"} in ${topic}`, tone: "indigo", name };
    const { rows } = standings(c, members), mine = rows.find((r) => r.userId === me.id);
    if (!mine) return null;
    const of = `${rows.length} racer${rows.length === 1 ? "" : "s"}`, goal = mine.target || c.goalLevels, levels = `${mine.gained} of ${goal} level${goal === 1 ? "" : "s"} in ${topic}`;
    if (state === "live") return { kind, ref, headline: mine.gained > 0 ? `+${mine.gained}` : "Racing", title: `Racing: ${title}`, subtitle: `${levels}. #${mine.rank} of ${of}`, tone: "orange", name };
    const won = mine.rank === 1 && (mine.reachedAt !== null || mine.gained > 0);
    return { kind, ref, headline: `#${mine.rank}`, title: `${won ? "Won" : mine.reachedAt !== null ? "Finished" : "Raced"}: ${title}`, subtitle: `${mine.reachedAt !== null ? "Reached the goal. " : ""}${levels}, out of ${of}`,
      tone: won ? "gold" : mine.rank === 2 ? "silver" : mine.rank === 3 ? "bronze" : "indigo", name };
  }
  if (kind === "league") {
    // only a promotion that really happened, in a week that has been settled
    const e = db.select().from(leagueEntries).where(and(eq(leagueEntries.userId, me.id), eq(leagueEntries.key, ref))).get();
    if (!e || e.outcome !== "up" || e.rank === null) return null;
    const to = nextTier(e.tier, "up"), size = Number(db.select({ n: sql<number>`count(*)` }).from(leagueEntries).where(and(eq(leagueEntries.key, e.key), eq(leagueEntries.audience, e.audience), eq(leagueEntries.arena, e.arena), eq(leagueEntries.tier, e.tier), eq(leagueEntries.cohort, e.cohort))).get()?.n ?? 0);
    return { kind, ref, headline: LEAGUE_TIERS[to].name, title: `Promoted to ${LEAGUE_TIERS[to].name} league`, subtitle: `#${e.rank} of ${size} in ${LEAGUE_TIERS[e.tier].name} league with ${e.points ?? 0} points`, tone: to >= 3 ? "legend" : to === 2 ? "gold" : "silver", name };
  }
  if (kind === "duel") {
    const d = db.select().from(duels).where(eq(duels.code, ref)).get();
    if (!d || d.status !== "done" || (d.hostId !== me.id && d.guestId !== me.id)) return null; // only someone who played, once it is over
    const host = d.hostId === me.id, you = (host ? d.hostPoints : d.guestPoints) ?? 0, them = (host ? d.guestPoints : d.hostPoints) ?? 0;
    const otherId = host ? d.guestId : d.hostId;
    const opp = d.botSeed ? `${botNameFor(d.botSeed)} (simulated)` : shortName(db.select({ n: users.name }).from(users).where(eq(users.id, otherId ?? 0)).get()?.n ?? "a friend");
    const topic = topicLabel(db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, d.trackId)).get()?.n ?? "a topic");
    return { kind, ref, headline: you > them ? "Won" : you < them ? "Lost" : "Draw", title: `Live duel: ${topic}`, subtitle: `${you} to ${them} against ${opp}. Five questions, head to head`, tone: you > them ? "gold" : "indigo", name };
  }
  if (kind === "pass") {
    const r = db.select({ run: runs, track: tracks.name }).from(runs).innerJoin(tracks, eq(tracks.id, runs.trackId)).where(and(eq(runs.id, Number(ref)), eq(runs.userId, me.id))).get();
    if (!r || !r.run.passed || r.run.level < 1 || r.run.level > LEVELS.length) return null;
    const tone = ["bronze", "silver", "gold", "legend", "legend"][tierOf(r.run.level)];
    return { kind, ref, headline: `Level ${r.run.level}`, title: `${LEVELS[r.run.level - 1]} in ${topicLabel(r.track)}`, subtitle: `${TIERS[tierOf(r.run.level)].name} rank. Passed a real graded exam with ${Math.round((r.run.score ?? 0) * 100)}%`, tone, name };
  }
  if (kind === "cert") {
    const c = db.select({ c: certificates, track: tracks.name }).from(certificates).innerJoin(tracks, eq(tracks.id, certificates.trackId)).where(and(eq(certificates.code, ref.toUpperCase()), eq(certificates.userId, me.id))).get();
    if (!c || c.c.revokedAt) return null;
    return { kind, ref: c.c.code, headline: `Level ${c.c.level}`, title: `${certTitle(c.c.level)} certificate: ${topicLabel(c.track)}`, subtitle: `Verifiable code ${c.c.code}`, tone: "gold", name };
  }
  if (kind === "level") {
    const { player } = progressionFor(me.id);
    return { kind, ref: "level", headline: `Level ${player.level}`, title: `${player.title} on gglearn`, subtitle: `${player.xp.toLocaleString("en-GB")} XP earned by passing real exams`, tone: "indigo", name };
  }
  if (kind === "streak") {
    const { streak } = progressionFor(me.id);
    return streak.longest >= 3 ? { kind, ref: "streak", headline: `${streak.longest} days`, title: "Longest learning streak", subtitle: "Learning on gglearn, day after day", tone: "orange", name } : null;
  }
  if (kind === "badge") {
    const b = progressionFor(me.id).badges.find((x) => x.key === ref && x.earned);
    return b ? { kind, ref, headline: TIER_LABEL[b.tier], title: b.name, subtitle: b.desc, tone: b.tier, name } : null;
  }
  const [k, key] = ref.split(":");
  if ((k !== "week" && k !== "month") || !key) return null;
  const r = db.select().from(seasonResults).where(and(eq(seasonResults.userId, me.id), eq(seasonResults.kind, k as Kind), eq(seasonResults.key, key))).get();
  if (!r) return null;
  const label = periodByKey(k as Kind, key)?.label.replace(/ · from.*/, "") ?? (k === "week" ? `Week ${key.slice(5)}, ${key.slice(0, 4)}` : key);
  return { kind, ref, headline: `#${r.rank}`, title: `${k === "week" ? "Weekly" : "Monthly"} season: ${label}`, subtitle: `Out of ${r.players} players, with ${r.points} points`, tone: r.rank === 1 ? "gold" : r.rank === 2 ? "silver" : r.rank === 3 ? "bronze" : "indigo", name };
}
