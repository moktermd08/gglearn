import { eq, sql } from "drizzle-orm";
import { cvEntries, cvProfiles, db } from "@/lib/db";
import { IMPORT_LIMITS, sanitizeCandidate, sanitizeProfile, type Candidate, type ProfileFields } from "@/lib/cv/import";
import { parseJson } from "@/lib/cv/text";
import { LIMITS, whyNoRoom, type EntryKind } from "@/lib/cv/types";

/**
 * Saves what the person ticked in the preview. The browser sends back what it was shown, but it is not trusted: every candidate and every profile
 * field is cleaned and capped again here, entries the person already has are skipped (never duplicated), nothing takes them over the entry limit,
 * and a profile field is only changed when the person chose it.
 */
export type ImportResult = { error: string } | { added: number; skipped: number; profile: string[] };

const keyOf = (c: Pick<Candidate, "kind" | "title" | "org" | "startsOn">) => `${c.kind}|${c.title.toLowerCase()}|${c.org.toLowerCase()}|${c.startsOn}`;

export function applyImport(userId: number, payload: unknown): ImportResult {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const incoming = (Array.isArray(p.entries) ? p.entries : []).slice(0, IMPORT_LIMITS.candidates).map(sanitizeCandidate).filter((c): c is Candidate => !!c);
  const fields = sanitizeProfile(p.profile);
  if (!incoming.length && !Object.keys(fields).length) return { error: "Nothing was chosen to import." };

  const have = db.select().from(cvEntries).where(eq(cvEntries.userId, userId)).all();
  const known = new Set(have.map((e) => keyOf({ kind: e.kind, title: e.title, org: e.org, startsOn: e.startsOn })));
  const fresh: Candidate[] = [];
  let skipped = 0;
  for (const c of incoming) { const k = keyOf(c); if (known.has(k)) { skipped++; continue; } known.add(k); fresh.push(c); }
  const counts: Partial<Record<EntryKind, number>> = {};
  for (const e of have) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  let full = "";
  for (let i = 0; i < fresh.length; ) { // each kind has its own room (ENTRY_CAPS); what does not fit is skipped
    const why = whyNoRoom(counts, fresh[i].kind);
    if (why) { skipped++; full = why; fresh.splice(i, 1); } else { counts[fresh[i].kind] = (counts[fresh[i].kind] ?? 0) + 1; i++; }
  }
  if (!fresh.length && incoming.length && !Object.keys(fields).length) return { error: full ? full : "Everything you chose is already on your CV." };

  db.transaction((tx) => {
    const top = tx.select({ lo: sql<number | null>`min(${cvEntries.sort})` }).from(cvEntries).where(eq(cvEntries.userId, userId)).get()?.lo ?? 1;
    fresh.forEach((c, i) => tx.insert(cvEntries).values({ userId, ...c, sort: top - (fresh.length - i) }).run()); // the first one in the file ends up on top
    if (Object.keys(fields).length) {
      const cur = tx.select().from(cvProfiles).where(eq(cvProfiles.userId, userId)).get();
      const links = (() => {
        if (!fields.links) return undefined;
        const existing = parseJson<{ label: string; url: string }[]>(cur?.links ?? "[]", []), seen = new Set(existing.map((l) => l.url));
        return JSON.stringify([...existing, ...fields.links.filter((l) => !seen.has(l.url))].slice(0, LIMITS.links));
      })();
      const set = { ...(fields.headline !== undefined ? { headline: fields.headline } : {}), ...(fields.summary !== undefined ? { summary: fields.summary } : {}), ...(fields.location !== undefined ? { location: fields.location } : {}), ...(fields.contactEmail !== undefined ? { contactEmail: fields.contactEmail } : {}), ...(fields.phone !== undefined ? { phone: fields.phone } : {}), ...(links !== undefined ? { links } : {}), updatedAt: Math.floor(Date.now() / 1000) };
      tx.insert(cvProfiles).values({ userId, ...set }).onConflictDoUpdate({ target: cvProfiles.userId, set }).run();
    }
  });
  return { added: fresh.length, skipped, profile: Object.keys(fields) as (keyof ProfileFields)[] };
}
