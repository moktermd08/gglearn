import { and, eq, isNull } from "drizzle-orm";
import { companies, cvEntries, cvLinks, cvProfiles, db, userScopes, users } from "@/lib/db";
import { roleLabel } from "@/lib/journey";
import { platformFacts } from "@/lib/cv/build";
import { approvedFor } from "@/lib/cv/endorse";

/**
 * What the platform can offer to write for the owner, and what is still missing. Nothing here is ever published by itself: a suggestion is a
 * button the owner presses, and the text is theirs to edit.
 */
export type Tip = { id: string; text: string; section: string };

export function suggestFor(userId: number, base: string) {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return null;
  const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, userId)).get();
  const f = platformFacts(userId, base);
  const role = u.jobRole && u.jobRole !== "general" && u.jobRole !== "customer" ? roleLabel(u.jobRole) : "";
  const headline = f.goal ? `Aspiring ${roleLabel(f.goal.targetRole)}${role ? ` · ${role}` : ""}` : role;
  const top = f.skills.slice(0, 2).map((s) => s.title);
  const parts = [
    role ? `${role} ` : "Learner ",
    f.validCerts ? `with ${f.validCerts} verified ${f.validCerts === 1 ? "certificate" : "certificates"}` : "",
    f.topics ? `${f.validCerts ? "and " : "with "}${f.levels} levels passed in timed exams across ${f.topics} ${f.topics === 1 ? "topic" : "topics"}` : "",
  ].filter(Boolean);
  const summary = f.topics || f.validCerts
    ? `${parts.join(" ").replace(/\s+/g, " ").trim()}.${top.length ? ` Strongest in ${top.join(" and ")}.` : ""}${f.activeDays >= 10 ? ` Studies consistently: active on ${f.activeDays} of the last 84 days.` : ""} Looking for a role where accuracy and steady improvement matter.`
    : "";
  // the company they belong to on the platform, offered as one experience entry to add (never added silently)
  const orgs = u.audience === "staff" ? db.select({ id: companies.id, name: companies.name }).from(userScopes).innerJoin(companies, eq(companies.id, userScopes.refId)).where(and(eq(userScopes.userId, userId), eq(userScopes.kind, "company"))).all() : [];
  const have = new Set(db.select({ o: cvEntries.org }).from(cvEntries).where(and(eq(cvEntries.userId, userId), eq(cvEntries.kind, "experience"))).all().map((e) => e.o.toLowerCase()));
  const experience = orgs.filter((o) => !have.has(o.name.toLowerCase())).map((o) => ({ org: o.name, title: role || "Team member", startsOn: new Date(u.createdAt * 1000).toISOString().slice(0, 7) }));

  const entries = db.select({ k: cvEntries.kind }).from(cvEntries).where(and(eq(cvEntries.userId, userId), eq(cvEntries.visible, true))).all().map((e) => e.k);
  const count = (k: string) => entries.filter((x) => x === k).length;
  const links = (() => { try { return (JSON.parse(p?.links ?? "[]") as unknown[]).length; } catch { return 0; } })();
  const shared = db.select({ id: cvLinks.id }).from(cvLinks).where(and(eq(cvLinks.userId, userId), isNull(cvLinks.revokedAt))).all().length;
  const checks: { id: string; weight: number; ok: boolean; tip: string; section: string }[] = [
    { id: "headline", weight: 10, ok: !!p?.headline, tip: "Add a headline: one line saying who you are and what you are after.", section: "profile" },
    { id: "summary", weight: 15, ok: (p?.summary.length ?? 0) >= 150, tip: "Write a summary of two or three sentences. You can start from the one we suggest.", section: "profile" },
    { id: "email", weight: 5, ok: !!p?.contactEmail, tip: "Add the email you want employers to use. It stays hidden unless you show it.", section: "profile" },
    { id: "location", weight: 5, ok: !!p?.location, tip: "Add your town or city: employers filter by place.", section: "profile" },
    { id: "experience", weight: 20, ok: count("experience") >= 1, tip: "Add a job or placement, with two or three things you achieved.", section: "experience" },
    { id: "education", weight: 10, ok: count("education") >= 1, tip: "Add your education or training.", section: "education" },
    { id: "verified", weight: 10, ok: f.certs.length >= 1, tip: "Earn a certificate: employers can check it is real, which no typed CV can offer.", section: "certificates" },
    { id: "assessed", weight: 5, ok: f.skills.length >= 3, tip: "Pass levels in three topics so your skills are backed by exams.", section: "assessed" },
    { id: "skills", weight: 5, ok: count("skill") >= 3, tip: "List at least three skills of your own.", section: "skills" },
    { id: "reference", weight: 5, ok: approvedFor(userId).length >= 1, tip: "Ask a manager or mentor for a reference: it is the one thing on a CV that someone else says about you.", section: "endorsements" },
    { id: "links", weight: 5, ok: links >= 1, tip: "Add a link, such as LinkedIn or a portfolio.", section: "profile" },
    { id: "share", weight: 5, ok: shared >= 1, tip: "Make a share link so an employer can read it, or download the PDF.", section: "share" },
  ];
  const percent = checks.reduce((a, c) => a + (c.ok ? c.weight : 0), 0);
  const tips: Tip[] = checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => ({ id: c.id, text: c.tip, section: c.section }));
  return { headline, summary, experience, percent, tips, facts: { certs: f.certs.length, topics: f.topics, levels: f.levels, quotes: f.quotes.length } };
}
