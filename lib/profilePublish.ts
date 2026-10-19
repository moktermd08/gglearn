import { and, asc, eq } from "drizzle-orm";
import { brands, companies, db, knowledgeItems, questions, tracks } from "@/lib/db";
import { recordChange } from "@/lib/freshness";
import { PHASE_DAYS, PHASE_LABEL, type Phase, type ProfileScope, type SectionState, isAnswered, phaseOfSection, profileOf, showValue } from "@/lib/profile";
import { canEditProfile } from "@/lib/profileAdmin";
import { resetCatalogCache } from "@/lib/paths";
import type { SetupState } from "@/lib/setup";

/**
 * Turns a company's or brand's profile into learning. Each answered section becomes a knowledge item on one track ("<Name>: how we work"),
 * the same items the question generator and the study pages already read. So what the profile says is what people are taught and asked.
 * The track is created once (growth tier, nobody required until an admin sets a policy and it has questions) and updated in place after that.
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };

/** The slug is fixed by who it is for, so the track is found again and never duplicated. */
export const profileSlug = (scope: ProfileScope, refId: number) => `profile-${scope}-${refId}`;
/**
 * A section is taught in the track of the phase it belongs to (Section.by). The first 30 days keep the original slug, so everything
 * published before phases existed stays where it is. Day 1 and week 1 are what every joiner must have done, so those tracks are mandatory.
 */
const PHASES: Phase[] = ["d1", "w1", "d30", "d60", "d90"];
export const phaseSlug = (scope: ProfileScope, refId: number, phase: Phase) => (phase === "d30" ? profileSlug(scope, refId) : `${profileSlug(scope, refId)}-${phase}`);
const trackName = (base: string, phase: Phase) => (phase === "d30" ? `${base}: how we work` : `${base}: how we work, ${PHASE_LABEL[phase].toLowerCase()}`);

/** The text taught for one section: only what was answered, under the question it answers. */
export function sectionBody(s: SectionState): string {
  const parts = s.fields.filter((f) => isAnswered(f, s.answers[f.key])).map((f) => `${f.label}\n${showValue(f, s.answers[f.key])}`);
  return parts.length ? `${s.section.label}: ${s.section.why}\n\n${parts.join("\n\n")}` : "";
}

export type PublishState = "empty" | "unpublished" | "changed" | "current";

/** Per section: not worth publishing yet, never published, edited since, or up to date. */
export function publishStates(scope: ProfileScope, refId: number): { track: typeof tracks.$inferSelect | null; tracks: (typeof tracks.$inferSelect)[]; states: Map<string, PublishState>; questions: number; waiting: Map<number, number> } {
  const all = PHASES.map((p) => db.select().from(tracks).where(eq(tracks.slug, phaseSlug(scope, refId, p))).get()).filter((t): t is typeof tracks.$inferSelect => !!t);
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
  const bodies = profileOf(scope, refId).filter((s) => s.status === "open").map((s) => ({ title: s.section.label, body: sectionBody(s), phase: phaseOfSection(s.section) })).filter((s) => s.body);
  if (!bodies.length) return { error: "Nothing is answered yet, so there is nothing to publish." };

  let added = 0, updated = 0, same = 0;
  db.transaction((tx) => {
    const made = new Map<Phase, typeof tracks.$inferSelect>();
    const trackFor = (phase: Phase) => {
      let track = made.get(phase) ?? tx.select().from(tracks).where(eq(tracks.slug, phaseSlug(scope, refId, phase))).get();
      if (!track) {
        const early = phase === "d1" || phase === "w1";
        track = tx.insert(tracks).values({
          brandId: home.id, slug: phaseSlug(scope, refId, phase), name: trackName(base, phase), kind: "subject", scope, tier: early ? "mandatory" : "growth", audience: "staff",
          requiredLevel: early ? 3 : 5, dueDays: PHASE_DAYS[phase], policySource: "admin",
          description: `What ${base} says about itself, taught by ${PHASE_LABEL[phase].toLowerCase()}. Written from the profile, so it stays current when the profile does.`,
        }).returning().get();
      }
      made.set(phase, track);
      return track;
    };
    for (const b of bodies) {
      const track = trackFor(b.phase);
      const item = tx.select().from(knowledgeItems).where(and(eq(knowledgeItems.trackId, track.id), eq(knowledgeItems.title, b.title))).get();
      if (!item) { tx.insert(knowledgeItems).values({ trackId: track.id, title: b.title, body: b.body }).run(); added++; }
      else if (item.body !== b.body) { recordChange(tx, item, b.body, { note: o.note, material: o.material, by: me.id }); updated++; }
      else same++;
    }
  });
  resetCatalogCache();
  return { done: `Published ${added} new and ${updated} changed section${added + updated === 1 ? "" : "s"}${same ? `, ${same} already current` : ""}.${o.material && updated ? " People already enrolled will be asked to read the changes." : ""}` };
}
