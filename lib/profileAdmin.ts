import { and, eq } from "drizzle-orm";
import { brands, companies, db, profileEntries, profileFields } from "@/lib/db";
import { type Column, type ProfileScope, cleanValue, fieldsFor, saveAnswer, saveSectionMeta, sectionOf } from "@/lib/profile";
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
    for (const fl of fieldsFor(scope, refId, key) ?? []) {
      const v = fd.get(`f_${fl.key}`);
      if (typeof v !== "string") continue; // field not on the form: leave it alone
      if (cleanValue(fl, v) !== (have.get(fl.key) ?? "")) saveAnswer(scope, refId, key, fl.key, v, me.id);
    }
  }
  saveSectionMeta(scope, refId, key, me.id, {
    ownerId, reviewed: intent === "reviewed",
    status: intent === "na" ? "na" : intent === "open" || intent === "save" || intent === "reviewed" ? "open" : undefined,
  });
  return { done: intent === "na" ? `${section.label} marked as not applying.` : intent === "reviewed" ? `${section.label} confirmed as current.` : `${section.label} saved.` };
}

const MAX_CUSTOM = 40;
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);

/**
 * Adds a question of this company's or brand's own to a section: a line, a paragraph, or a table with named columns ("Supplier, Contact, Renewal date").
 * Answers are stored like the built-in ones, so completeness, review and publishing to learning treat it the same.
 */
export function addCustomField(me: Me, fd: FormData): SetupState {
  const scope = str(fd.get("scope")), refId = Number(fd.get("refId")), section = str(fd.get("section")), label = str(fd.get("label")).slice(0, 80), kind = str(fd.get("kind")) || "long";
  if ((scope !== "company" && scope !== "brand") || !Number.isInteger(refId) || !sectionOf(section)?.scopes.includes(scope)) return { error: "Pick a section." };
  if (!canEditProfile(me, scope, refId)) return { error: "You do not run this company or brand." };
  if (label.length < 2) return { error: "Write the question: at least 2 characters." };
  if (kind !== "text" && kind !== "long" && kind !== "table") return { error: "Pick the kind of answer." };
  let columns: Column[] = [];
  if (kind === "table") {
    const labels = str(fd.get("columns")).split(",").map((c) => c.trim().slice(0, 30)).filter(Boolean);
    columns = labels.map((l) => ({ key: slugOf(l), label: l }));
    if (columns.length < 2 || columns.length > 6) return { error: "A table needs 2 to 6 column names, separated by commas." };
    if (columns.some((c) => !c.key) || new Set(columns.map((c) => c.key)).size !== columns.length) return { error: "Give each column a different name made of letters or numbers." };
  }
  const mine = db.select().from(profileFields).where(and(eq(profileFields.scope, scope), eq(profileFields.refId, refId))).all();
  if (mine.length >= MAX_CUSTOM) return { error: `That is the most own questions (${MAX_CUSTOM}). Retire one first.` };
  const base = slugOf(label) || "question", used = new Set([...(sectionOf(section)?.fields ?? []).map((f) => f.key), ...mine.filter((r) => r.section === section).map((r) => r.key)]);
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
  db.insert(profileFields).values({ scope, refId, section, key, label, hint: str(fd.get("hint")).slice(0, 200), kind, columns: kind === "table" ? JSON.stringify(columns) : "", required: fd.get("required") === "on" ? "yes" : "no", createdBy: me.id }).run();
  return { done: `Added "${label}".` };
}

/** Takes an own question off the form. Its answers are kept, so adding it back later shows them again. */
export function retireCustomField(me: Me, fieldId: number): SetupState {
  const r = db.select().from(profileFields).where(eq(profileFields.id, fieldId)).get();
  if (!r || !canEditProfile(me, r.scope, r.refId)) return { error: "You cannot change that question." };
  db.update(profileFields).set({ retired: "yes" }).where(eq(profileFields.id, r.id)).run();
  return { done: `Removed "${r.label}". Answers already given are kept.` };
}
