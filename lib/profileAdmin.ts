import { eq } from "drizzle-orm";
import { brands, companies, db, profileEntries } from "@/lib/db";
import { type ProfileScope, saveAnswer, saveSectionMeta, sectionOf } from "@/lib/profile";
import { reachOf, scopeInReach, userInReach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";

type Me = { id: number; role: "admin" | "manager" | "learner" };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Managers and admins may edit the profile of a company or brand they run. Shared academy brands and personal brands have no profile. */
export function canEditProfile(me: Me, scope: ProfileScope, refId: number): boolean {
  if (me.role !== "admin" && me.role !== "manager") return false;
  if (scope === "company") return !!db.select({ id: companies.id }).from(companies).where(eq(companies.id, refId)).get() && scopeInReach(reachOf(me.id), { kind: "company", id: refId });
  const b = db.select().from(brands).where(eq(brands.id, refId)).get();
  return !!b && b.kind === "company" && scopeInReach(reachOf(me.id), { kind: "brand", id: b.id });
}

/**
 * Saves one section from its form: every field it shows, then the button pressed ("save", "reviewed" = still true today,
 * "na" = does not apply, "open" = applies again). Only fields whose text changed are written, so the "last changed by" stays honest.
 */
export function saveSectionForm(me: Me, fd: FormData): SetupState {
  const scope = str(fd.get("scope")), refId = Number(fd.get("refId")), key = str(fd.get("section")), intent = str(fd.get("intent")) || "save";
  if ((scope !== "company" && scope !== "brand") || !Number.isInteger(refId)) return { error: "Pick a company or brand." };
  const section = sectionOf(key);
  if (!section || !section.scopes.includes(scope)) return { error: "That section does not exist here." };
  if (!canEditProfile(me, scope, refId)) return { error: "You do not run this company or brand." };

  const ownerRaw = str(fd.get("ownerId")), ownerId = ownerRaw ? Number(ownerRaw) : null;
  if (ownerId != null && (!Number.isInteger(ownerId) || !userInReach(reachOf(me.id), ownerId))) return { error: "The owner must be someone you run." };

  if (intent !== "na") {
    const have = new Map(db.select().from(profileEntries).all().filter((e) => e.scope === scope && e.refId === refId && e.section === key).map((e) => [e.field, e.value]));
    for (const fl of section.fields) {
      const v = fd.get(`f_${fl.key}`);
      if (typeof v !== "string") continue; // field not on the form: leave it alone
      if (v.trim() !== (have.get(fl.key) ?? "")) saveAnswer(scope, refId, key, fl.key, v, me.id);
    }
  }
  saveSectionMeta(scope, refId, key, me.id, {
    ownerId, reviewed: intent === "reviewed",
    status: intent === "na" ? "na" : intent === "open" || intent === "save" || intent === "reviewed" ? "open" : undefined,
  });
  return { done: intent === "na" ? `${section.label} marked as not applying.` : intent === "reviewed" ? `${section.label} confirmed as current.` : `${section.label} saved.` };
}
