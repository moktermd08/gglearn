import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { answerNotes, certificates, cvEntries, cvProfiles, cvQuotes, db, runs, tracks, users } from "@/lib/db";
import { certState, signatureStatus } from "@/lib/certs";
import { goalOf, roleLabel } from "@/lib/journey";
import { LEVELS, MAX_LEVEL, certTitle } from "@/lib/levels";
import { activityFor } from "@/lib/stats";
import { topicLabel } from "@/lib/topicName";
import { SECTION_KEYS, SECTION_TITLE, type SectionKey, type TemplateKey, type View } from "@/lib/cv/types";
import { dateRange, isHexColour, monthYear, parseJson, safeUrl } from "@/lib/cv/text";

/**
 * Turns a person, what they have saved, what the platform knows about them and a VIEW (what this reader may be shown) into one plain document.
 * The web page, the PDF and the owner's preview are all drawn from it. Everything the owner hid, and everything the view does not allow, is
 * left out here and nowhere else, so no output can show what another would not.
 */
export type CvItem = {
  title: string; subtitle?: string; dates?: string; body?: string[];
  verify?: { code: string; url: string; status: "valid" | "expiring" | "expired" | "permanent" };
  level?: { n: number; of: number; title: string };
  key?: string; // for platform items: what the owner hides by ("cert:12")
};
export type CvSection = { key: SectionKey; title: string; items: CvItem[]; chips?: boolean; note?: string };
export type CvContact = { kind: "email" | "phone" | "location" | "link"; label: string; value: string; href?: string };
export type CvDoc = {
  userId: number; name: string; headline: string; contact: CvContact[]; sections: CvSection[];
  template: TemplateKey; accent: string; generatedAt: number;
  assessedNote: string; // how the platform's own evidence was assessed, shown with it
};

export const ASSESSED_NOTE = "Levels are passed in timed exams on gglearn. Each certificate links to a public page that confirms it is genuine and shows whether it is current.";
const MAX_ASSESSED = 15, MAX_QUOTE = 280;

/** The keys of platform items the owner has left off. */
export const hiddenKeys = (userId: number): Set<string> => new Set(parseJson<string[]>(db.select({ h: cvProfiles.hidden }).from(cvProfiles).where(eq(cvProfiles.userId, userId)).get()?.h ?? "[]", []).filter((k) => typeof k === "string"));

/** What the platform can say about this person, before the owner's hiding and the view's limits. */
export function platformFacts(userId: number, base: string) {
  const certs = db.select({ c: certificates, t: tracks }).from(certificates).innerJoin(tracks, eq(tracks.id, certificates.trackId)).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt)).all()
    .filter(({ c }) => c.revokedAt == null && signatureStatus(c) !== "altered") // a revoked or tampered certificate is never offered
    .map(({ c, t }): CvItem => {
      const life = certState(c);
      return {
        key: `cert:${c.id}`, title: `${topicLabel(t.name)}: ${certTitle(c.level)}`,
        subtitle: `Level ${c.level} of ${MAX_LEVEL} · ${Math.round(c.score * 100)}% · issued ${monthYear(new Date(c.issuedAt * 1000).toISOString().slice(0, 7))}${c.expiresAt ? ` · ${life.state === "expired" ? "expired" : "valid until"} ${monthYear(new Date(c.expiresAt * 1000).toISOString().slice(0, 7))}` : ""}`,
        verify: { code: c.code, url: `${base}/cert/${c.code}`, status: life.state },
      };
    });
  const best = db.select({ t: runs.trackId, m: sql<number>`max(${runs.level})` }).from(runs).where(and(eq(runs.userId, userId), eq(runs.passed, true))).groupBy(runs.trackId).all();
  const names = new Map(db.select({ id: tracks.id, name: tracks.name }).from(tracks).all().map((t) => [t.id, t.name]));
  const skills = best.map((b) => ({ id: b.t, n: Math.min(Number(b.m), MAX_LEVEL), name: topicLabel(names.get(b.t) ?? "") })).filter((s) => s.n > 0 && s.name)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .map((s): CvItem => ({ key: `skill:${s.id}`, title: s.name, level: { n: s.n, of: MAX_LEVEL, title: LEVELS[s.n - 1] ?? "" }, subtitle: `Level ${s.n} of ${MAX_LEVEL}, ${LEVELS[s.n - 1] ?? ""}` }));
  const quotes = db.select({ q: cvQuotes, n: answerNotes, who: users, track: tracks }).from(cvQuotes)
    .innerJoin(answerNotes, eq(answerNotes.id, cvQuotes.noteId)).innerJoin(users, eq(users.id, answerNotes.authorId)).innerJoin(runs, eq(runs.id, answerNotes.runId)).innerJoin(tracks, eq(tracks.id, runs.trackId))
    .where(and(eq(cvQuotes.userId, userId), isNull(answerNotes.deletedAt), eq(answerNotes.quotable, true))).orderBy(desc(cvQuotes.id)).all() // a note its author withdrew or removed is gone from here too
    .map(({ q, n, who, track }): CvItem => ({
      key: `quote:${q.id}`, title: `“${n.body.replace(/\s+/g, " ").slice(0, MAX_QUOTE)}”`,
      subtitle: `${who.name}, ${who.role === "learner" ? "mentor" : who.role}, after reviewing their exam answers in ${topicLabel(track.name)}`,
    }));
  const activity = activityFor(userId, 12);
  const levels = skills.reduce((a, s) => a + s.level!.n, 0);
  const valid = certs.filter((c) => c.verify!.status !== "expired").length;
  return { certs, skills, quotes, levels, topics: skills.length, validCerts: valid, activeDays: activity.filter((d) => d.value > 0).length, goal: goalOf(userId) };
}

/** The CV for this person as this view may see it, or null when there is no such active person. */
export function buildCv(userId: number, view: View, base: string): CvDoc | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.status !== "active") return null;
  const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, userId)).get();
  const hidden = hiddenKeys(userId), facts = platformFacts(userId, base);
  const entries = db.select().from(cvEntries).where(and(eq(cvEntries.userId, userId), eq(cvEntries.visible, true))).orderBy(cvEntries.sort, cvEntries.id).all();
  const showing = (key: SectionKey) => view.sections[key] === true;
  const keep = (items: CvItem[]) => items.filter((i) => !i.key || !hidden.has(i.key));

  const byKind = (kind: (typeof entries)[number]["kind"]): CvItem[] => entries.filter((e) => e.kind === kind).map((e) => ({
    title: e.title, subtitle: [e.org, e.location].filter(Boolean).join(" · ") || undefined, dates: dateRange(e.startsOn, e.endsOn, e.current) || undefined, body: e.body ? e.body.split("\n") : undefined,
  }));
  const sections: CvSection[] = [];
  const add = (key: SectionKey, items: CvItem[], extra: Partial<CvSection> = {}) => { if (showing(key) && items.length) sections.push({ key, title: SECTION_TITLE[key], items, ...extra }); };

  add("summary", p?.summary ? [{ title: "", body: p.summary.split("\n") }] : []);
  add("experience", byKind("experience"));
  add("projects", byKind("project"));
  add("education", byKind("education"));
  add("certificates", keep(facts.certs));
  add("assessed", keep(facts.skills).slice(0, MAX_ASSESSED), { note: ASSESSED_NOTE });
  add("skills", byKind("skill"), { chips: true });
  const lines = [facts.topics ? `${facts.levels} levels passed across ${facts.topics} ${facts.topics === 1 ? "topic" : "topics"}` : "", facts.validCerts ? `${facts.validCerts} verified ${facts.validCerts === 1 ? "certificate" : "certificates"}` : "", facts.activeDays ? `Active on ${facts.activeDays} of the last 84 days` : ""].filter(Boolean);
  add("highlights", hidden.has("stat:highlights") ? [] : lines.length ? [{ title: "", body: lines }] : []);
  add("quotes", keep(facts.quotes));
  add("volunteer", byKind("volunteer"));
  add("awards", byKind("award"));
  add("languages", byKind("language"));
  add("goal", facts.goal ? [{ title: `${roleLabel(facts.goal.targetRole)}`, dates: `by ${monthYear(new Date(facts.goal.targetDate * 1000).toISOString().slice(0, 7))}` }] : []);

  // sections appear in the order SECTION_KEYS gives, except that the profile's own order of what the owner typed first (experience...) is kept as listed above
  const order = new Map(SECTION_KEYS.map((k, i) => [k, i]));
  sections.sort((a, b) => order.get(a.key)! - order.get(b.key)!);

  const contact: CvContact[] = [];
  if (p) {
    if (view.contact.location && p.location) contact.push({ kind: "location", label: "Location", value: p.location });
    if (view.contact.email && p.contactEmail) contact.push({ kind: "email", label: "Email", value: p.contactEmail, href: `mailto:${p.contactEmail}` });
    if (view.contact.phone && p.phone) contact.push({ kind: "phone", label: "Phone", value: p.phone, href: `tel:${p.phone.replace(/[^+\d]/g, "")}` });
    if (view.contact.links) for (const l of parseJson<{ label: string; url: string }[]>(p.links, [])) { const url = safeUrl(l?.url); if (url) contact.push({ kind: "link", label: String(l.label ?? "").slice(0, 40), value: url.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: url }); }
  }
  return {
    userId, name: u.name, headline: p?.headline || "", contact, sections, template: p?.template ?? "classic",
    accent: p?.accent && isHexColour(p.accent) ? p.accent : "", generatedAt: Math.floor(Date.now() / 1000), assessedNote: ASSESSED_NOTE,
  };
}
