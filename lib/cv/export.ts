import { and, eq } from "drizzle-orm";
import { cvEntries, cvProfiles, db, users } from "@/lib/db";
import { hiddenKeys, platformFacts } from "@/lib/cv/build";
import { approvedFor } from "@/lib/cv/endorse";
import { parseJson, safeUrl } from "@/lib/cv/text";

/**
 * The person's CV as a JSON Resume file (jsonresume.org): their own data, to keep or to take elsewhere. It is what is on their full CV, so
 * something they hid, or chose not to show, is not in it. A certificate earned here carries its public verification address. Their own contact
 * details are included: it is their file, for them. Importing it again (lib/cv/import.ts) gives back what they typed.
 */
export function exportJsonResume(userId: number, base: string): Record<string, unknown> | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.status !== "active") return null;
  const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, userId)).get();
  const entries = db.select().from(cvEntries).where(and(eq(cvEntries.userId, userId), eq(cvEntries.visible, true))).orderBy(cvEntries.sort, cvEntries.id).all();
  const hidden = hiddenKeys(userId), facts = platformFacts(userId, base);
  const of = (kind: string) => entries.filter((e) => e.kind === kind);
  const hl = (e: { body: string }) => (e.body ? e.body.split("\n") : []);
  const when = (e: { startsOn: string; endsOn: string; current: boolean }) => ({ ...(e.startsOn ? { startDate: e.startsOn } : {}), ...(e.endsOn && !e.current ? { endDate: e.endsOn } : {}) });
  const profiles = parseJson<{ label: string; url: string }[]>(p?.links ?? "[]", []).flatMap((l) => { const url = safeUrl(l?.url); return url ? [{ network: l.label || new URL(url).hostname, url }] : []; });
  const platformCerts = facts.certs.filter((c) => !hidden.has(c.key!) && c.verify).map((c) => ({ name: c.title, issuer: "gglearn", ...(c.verify!.url ? { url: c.verify!.url } : {}) }));
  const assessed = facts.skills.filter((s) => !hidden.has(s.key!)).slice(0, 15).map((s) => ({ name: s.title, level: s.subtitle ?? "" }));
  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: { name: u.name, label: p?.headline ?? "", ...(p?.contactEmail ? { email: p.contactEmail } : {}), ...(p?.phone ? { phone: p.phone } : {}), summary: p?.summary ?? "", ...(p?.location ? { location: { city: p.location } } : {}), profiles },
    work: of("experience").map((e) => ({ name: e.org, position: e.title, ...(e.location ? { location: e.location } : {}), ...when(e), highlights: hl(e) })),
    volunteer: of("volunteer").map((e) => ({ organization: e.org, position: e.title, ...when(e), highlights: hl(e) })),
    education: of("education").map((e) => ({ institution: e.org, area: e.title, ...when(e), courses: hl(e) })),
    awards: of("award").map((e) => ({ title: e.title, awarder: e.org, ...(e.startsOn ? { date: e.startsOn } : {}) })),
    certificates: platformCerts,
    skills: [...of("skill").map((e) => ({ name: e.title })), ...assessed],
    languages: of("language").map((e) => ({ language: e.title, fluency: e.org })),
    projects: of("project").map((e) => ({ name: e.title, ...(e.org ? { entity: e.org } : {}), ...when(e), highlights: hl(e) })),
    references: approvedFor(userId).filter((r) => !hidden.has(`endorsement:${r.id}`)).map((r) => ({ name: r.author, reference: r.body })),
    meta: { version: "v1.0.0", lastModified: new Date().toISOString() },
  };
}
