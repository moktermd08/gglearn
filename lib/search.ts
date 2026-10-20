import { and, eq, isNull } from "drizzle-orm";
import { certificates, db, teamMembers, teams, tracks } from "@/lib/db";
import { listFor } from "@/lib/competitions";
import { pickableTopics } from "@/lib/pickTopics";
import { publicTracks } from "@/lib/publicCatalog";
import { certTitle, KIND_LABEL } from "@/lib/levels";
import { topicLabel } from "@/lib/topicName";
import { MIN_QUERY, best, matches, words, type Hit } from "@/lib/searchRules";

/**
 * One search across what a person is allowed to see, and nothing else. Who is asking decides everything:
 *  - topics: the ones they could pick (a stranger: only public ones, the landing page's rule)
 *  - races: the ones listed to them (public ones in their arena, plus their own and ones they were invited to)
 *  - teams and certificates: only their own
 *  - pages: only ones that exist for their kind of account
 * People are never searched. A query shorter than MIN_QUERY finds nothing.
 */
type Viewer = { id: number; role: "admin" | "manager" | "learner"; audience: "staff" | "customer" } | null;
export type Group = { label: string; hits: Hit[] };

const PAGES: { title: string; href: string; words: string; need?: "in" | "out" | "manager" }[] = [
  { title: "Home", href: "/", words: "landing welcome" },
  { title: "Try three questions", href: "/try", words: "try quiz taste sample free" },
  { title: "Campaigns", href: "/campaigns", words: "public races leagues careers ai prizes" },
  { title: "Contests", href: "/competitions", words: "races competitions live watch" },
  { title: "Business map", href: "/map", words: "business company founder startup stages lifecycle stops transit map idea launch grow" },
  { title: "Public sector map", href: "/map/public", words: "public sector council government local authority nhs agency service programme business case procurement stages size small medium large enterprise" },
  { title: "Software lifecycle map", href: "/map/software", words: "software lifecycle stops transit map engineering delivery" },
  { title: "Sign in", href: "/login", words: "log in login password", need: "out" },
  { title: "Create a free account", href: "/signup", words: "sign up register join", need: "out" },
  { title: "My path", href: "/dashboard", words: "dashboard home quest next step required", need: "in" },
  { title: "Start a race", href: "/start", words: "new race journey duel challenge begin", need: "in" },
  { title: "Race options", href: "/competitions/new", words: "create contest custom prize bots", need: "in" },
  { title: "League", href: "/league", words: "weekly promotion relegation tier bronze gold diamond", need: "in" },
  { title: "Seasons", href: "/seasons", words: "weekly monthly leaderboard board points", need: "in" },
  { title: "Achievements", href: "/achievements", words: "badges streak freeze level xp invite friends referral", need: "in" },
  { title: "My career", href: "/journey", words: "promotion ladder goal role", need: "in" },
  { title: "Friends", href: "/friends", words: "friend cheer feed activity invite add follow", need: "in" },
  { title: "Teams", href: "/teams", words: "team group class study join code", need: "in" },
  { title: "Rewards", href: "/rewards", words: "voucher prize money certificate", need: "in" },
  { title: "Profile and settings", href: "/profile", words: "account password email emails recap photo avatar look boards hide", need: "in" },
  { title: "Notifications", href: "/notifications", words: "bell alerts messages", need: "in" },
  { title: "People (manager)", href: "/admin/people", words: "invite staff customers team link bulk csv offboard", need: "manager" },
  { title: "Set up (manager)", href: "/admin/setup", words: "company brand branding public page logo colour", need: "manager" },
  { title: "Who is up to date (manager)", href: "/admin/compliance", words: "overdue required learning report", need: "manager" },
];

export function searchFor(viewer: Viewer, q: string): Group[] {
  if (words(q).join("").length < MIN_QUERY) return [];
  const out: Group[] = [];
  const add = (label: string, hits: Hit[]) => { if (hits.length) out.push({ label, hits }); };

  add("Pages", best(q, PAGES.filter((p) => !p.need || (p.need === "in" && viewer) || (p.need === "out" && !viewer) || (p.need === "manager" && viewer && viewer.role !== "learner"))
    .filter((p) => matches(q, p.title, p.words)).map((p) => ({ item: { title: p.title, sub: "Page", href: p.href, kind: "page" as const }, rest: p.words })), 4));

  const topics = viewer
    ? pickableTopics(viewer).map((t) => ({ slug: t.slug, name: t.name, kind: t.kind, text: t.description ?? "" }))
    : publicTracks().map((r) => ({ slug: r.track.slug, name: r.track.name, kind: r.track.kind, text: r.track.description ?? "" }));
  add("Topics", best(q, topics.filter((t) => matches(q, t.name, topicLabel(t.name), t.text)).map((t) => ({ item: { title: topicLabel(t.name), sub: KIND_LABEL[t.kind] ?? t.kind, href: `/tracks/${t.slug}`, kind: "topic" as const }, rest: t.text })), 6));

  // a race's topic is searched and shown only if this person can see that topic, so search cannot be used to list a company's own topic names
  const seen = new Set(topics.map((t) => t.slug));
  const races = listFor(viewer ? { id: viewer.id } : null).filter((x) => x.state !== "canceled" && matches(q, x.c.title, seen.has(x.track.slug) ? x.trackName : ""));
  const when = (st: string) => (st === "live" ? "live now" : st === "upcoming" ? "starts soon" : "finished");
  add("Races", best(q, races.map((x) => ({ item: { title: x.c.title, sub: seen.has(x.track.slug) ? `${topicLabel(x.trackName)} · ${when(x.state)}` : `Race · ${when(x.state)}`, href: `/competitions/${x.c.slug}`, kind: "race" as const } })), 5));

  if (viewer) {
    const mine = db.select({ id: teams.id, name: teams.name }).from(teamMembers).innerJoin(teams, eq(teams.id, teamMembers.teamId)).where(and(eq(teamMembers.userId, viewer.id), isNull(teams.archivedAt))).all();
    add("Your teams", best(q, mine.filter((t) => matches(q, t.name)).map((t) => ({ item: { title: t.name, sub: "Team", href: `/teams/${t.id}`, kind: "team" as const } })), 4));
    const certs = db.select({ code: certificates.code, level: certificates.level, track: tracks.name, revokedAt: certificates.revokedAt }).from(certificates).innerJoin(tracks, eq(tracks.id, certificates.trackId)).where(eq(certificates.userId, viewer.id)).all();
    add("Your certificates", best(q, certs.filter((c) => !c.revokedAt && matches(q, c.track, topicLabel(c.track), certTitle(c.level), "certificate")).map((c) => ({ item: { title: `${topicLabel(c.track)}: ${certTitle(c.level)}`, sub: "Certificate", href: `/cert/${c.code}`, kind: "certificate" as const } })), 4));
  }
  return out;
}
