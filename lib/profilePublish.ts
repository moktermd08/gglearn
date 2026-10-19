import { and, asc, eq, like } from "drizzle-orm";
import { brands, companies, db, knowledgeChanges, knowledgeItems, questions, tracks } from "@/lib/db";
import { recordChange } from "@/lib/freshness";
import { PHASE_DAYS, PHASE_LABEL, type Phase, type ProfileScope, type SectionState, isAnswered, needsOf, phaseOfSection, profileOf, showValue } from "@/lib/profile";
import { type Family, familyToken } from "@/lib/roleFamily";
import { canEditProfile } from "@/lib/profileAdmin";
import { resetCatalogCache } from "@/lib/paths";
import type { SetupState } from "@/lib/setup";

/**
 * Turns a company's or brand's profile into learning. Each answered section becomes a knowledge item on one track ("<Name>: how we work"),
 * the same items the question generator and the study pages already read. So what the profile says is what people are taught and asked.
 * A track is created once and updated in place after that. New tracks are required: of everyone (mandatory) or of the role families that must learn it.
 * Nobody is held to one until it has approved questions, and an admin can loosen it at /admin/paths (publishing again never overwrites that policy).
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };

/** The slug is fixed by who it is for, so the track is found again and never duplicated. */
export const profileSlug = (scope: ProfileScope, refId: number) => `profile-${scope}-${refId}`;
/**
 * A section is taught in the track for its phase (Section.by) and for who must learn it (Section.needs). Sections for everyone: the first
 * 30 days keep the original slug, so everything published before phases existed stays where it is. Sections some role families must learn get a track of their own, required of those families
 * ("family:eng" in the track's roles, so a role added later is covered); everyone else can still read it.
 */
export type Audience = Family[] | "all";
export const phaseSlug = (scope: ProfileScope, refId: number, phase: Phase, who: Audience = "all") => {
  const base = phase === "d30" ? profileSlug(scope, refId) : `${profileSlug(scope, refId)}-${phase}`;
  return who === "all" ? base : `${profileSlug(scope, refId)}-${phase}-${who.map((f) => f.toLowerCase()).join("-")}`;
};
const trackName = (base: string, phase: Phase, who: Audience) =>
  (phase === "d30" ? `${base}: how we work` : `${base}: how we work, ${PHASE_LABEL[phase].toLowerCase()}`) + (who === "all" ? "" : ` (${who.join(", ")})`);
/** Every track published from this profile: the original slug and anything that starts with it plus a dash. */
const trackSlugs = (scope: ProfileScope, refId: number) => { const base = profileSlug(scope, refId); return (slug: string) => slug === base || slug.startsWith(base + "-"); };
function profileTracks(tx: Pick<typeof db, "select">, scope: ProfileScope, refId: number) {
  const mine = trackSlugs(scope, refId);
  return tx.select().from(tracks).where(like(tracks.slug, profileSlug(scope, refId) + "%")).all().filter((t) => mine(t.slug)).sort((a, b) => a.dueDays - b.dueDays || a.slug.length - b.slug.length || a.slug.localeCompare(b.slug));
}

/** The text taught for one section: only what was answered, under the question it answers. */
export function sectionBody(s: SectionState): string {
  const parts = s.fields.filter((f) => isAnswered(f, s.answers[f.key])).map((f) => `${f.label}\n${showValue(f, s.answers[f.key])}`);
  return parts.length ? `${s.section.label}: ${s.section.why}\n\n${parts.join("\n\n")}` : "";
}

export type PublishState = "empty" | "unpublished" | "changed" | "current";

/** Per section: not worth publishing yet, never published, edited since, or up to date. */
export function publishStates(scope: ProfileScope, refId: number): { track: typeof tracks.$inferSelect | null; tracks: (typeof tracks.$inferSelect)[]; states: Map<string, PublishState>; questions: number; waiting: Map<number, number> } {
  const all = profileTracks(db, scope, refId);
  const track = all.find((t) => t.slug === profileSlug(scope, refId)) ?? all[0] ?? null;
  const items = new Map(all.flatMap((t) => db.select().from(knowledgeItems).where(eq(knowledgeItems.trackId, t.id)).all().map((i) => [i.title, i.body] as const)));
  const states = new Map<string, PublishState>();
  for (const s of profileOf(scope, refId)) {
    const body = s.status === "open" ? sectionBody(s) : "";
    const had = items.get(s.section.label);
    states.set(s.section.key, !body ? "empty" : had == null ? "unpublished" : had === body ? "current" : "changed");
  }
  const n = all.reduce((sum, t) => sum + db.select({ id: questions.id }).from(questions).where(and(eq(questions.trackId, t.id), eq(questions.status, "active"))).all().length, 0);
  const waiting = new Map(all.map((t) => [t.id, db.select({ id: questions.id }).from(questions).where(and(eq(questions.trackId, t.id), eq(questions.status, "review"))).all().length] as const));
  return { track, tracks: all, states, questions: n, waiting };
}

/** The brand a new profile track belongs to: the brand itself, or a company's first brand. */
function homeBrand(scope: ProfileScope, refId: number) {
  if (scope === "brand") return db.select().from(brands).where(eq(brands.id, refId)).get() ?? null;
  return db.select().from(brands).where(and(eq(brands.companyId, refId), eq(brands.kind, "company"))).orderBy(asc(brands.id)).get() ?? null;
}

/**
 * Publishes every answered section. Changed text is recorded as a change to the knowledge item; `material` asks people already enrolled
 * to read it again, and is off by default so fixing a typo does not interrupt anyone. Only an admin, because it creates a track.
 */
export function publishProfile(me: Me, scope: ProfileScope, refId: number, o: { material: boolean; note: string }): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can publish a profile to learning." };
  if (!canEditProfile(me, scope, refId)) return { error: "You do not run this company or brand." };
  const home = homeBrand(scope, refId);
  if (!home) return { error: "Add a brand to this company first: a track has to belong to a brand." };
  const company = scope === "company" ? db.select().from(companies).where(eq(companies.id, refId)).get() : null;
  const base = company ? company.academyName || company.name : home.name;
  const bodies = profileOf(scope, refId).filter((s) => s.status === "open").map((s) => ({ title: s.section.label, body: sectionBody(s), phase: phaseOfSection(s.section), who: needsOf(s.section) })).filter((s) => s.body);
  if (!bodies.length) return { error: "Nothing is answered yet, so there is nothing to publish." };

  let added = 0, updated = 0, same = 0, moved = 0;
  db.transaction((tx) => {
    const made = new Map<string, typeof tracks.$inferSelect>();
    const trackFor = (phase: Phase, who: Audience) => {
      const slug = phaseSlug(scope, refId, phase, who);
      let track = made.get(slug) ?? tx.select().from(tracks).where(eq(tracks.slug, slug)).get();
      if (!track) {
        const early = phase === "d1" || phase === "w1";
        const forFamilies = who !== "all";
        track = tx.insert(tracks).values({
          brandId: home.id, slug, name: trackName(base, phase, who), kind: "subject", scope, tier: forFamilies ? "role" : "mandatory", audience: "staff",
          roles: forFamilies ? who.map(familyToken).join(",") : "", requiredLevel: early ? 3 : 5, dueDays: PHASE_DAYS[phase], policySource: "admin",
          description: `What ${base} says about itself, taught by ${PHASE_LABEL[phase].toLowerCase()}${forFamilies ? ` to ${who.join(", ")}` : ""}. Written from the profile, so it stays current when the profile does.`,
        }).returning().get();
      }
      made.set(slug, track);
      return track;
    };
    const mine = profileTracks(tx, scope, refId).map((t) => t.id);
    for (const b of bodies) {
      const track = trackFor(b.phase, b.who);
      let item = tx.select().from(knowledgeItems).where(and(eq(knowledgeItems.trackId, track.id), eq(knowledgeItems.title, b.title))).get();
      if (!item) {
        // the same section published earlier under another phase or audience (it was changed, or this is an older publish): move its text, history and
        // reading records with it, so there is one copy. Questions written for the old track stay there, as they are about that track as a whole.
        const earlier = tx.select().from(knowledgeItems).where(eq(knowledgeItems.title, b.title)).all().find((i) => mine.includes(i.trackId));
        if (earlier) {
          tx.update(knowledgeItems).set({ trackId: track.id }).where(eq(knowledgeItems.id, earlier.id)).run();
          tx.update(knowledgeChanges).set({ trackId: track.id }).where(eq(knowledgeChanges.itemId, earlier.id)).run();
          item = { ...earlier, trackId: track.id };
          moved++;
        }
      }
      if (!item) { tx.insert(knowledgeItems).values({ trackId: track.id, title: b.title, body: b.body }).run(); added++; }
      else if (item.body !== b.body) { recordChange(tx, item, b.body, { note: o.note, material: o.material, by: me.id }); updated++; }
      else same++;
    }
  });
  resetCatalogCache();
  return { done: `Published ${added} new and ${updated} changed section${added + updated === 1 ? "" : "s"}${same ? `, ${same} already current` : ""}${moved ? `, ${moved} moved to the track for whoever must learn it` : ""}.${o.material && updated ? " People already enrolled will be asked to read the changes." : ""}` };
}
