import { cleanBlock, cleanLine, isEmail, safeUrl } from "@/lib/cv/text";
import { ENTRY_KIND_LIST, LIMITS, type EntryKind } from "@/lib/cv/types";

/**
 * Reading a CV the person already has: a JSON Resume file (the open standard, jsonresume.org) or the CSV files from a LinkedIn data export.
 * Nothing here touches the database. A file is UNTRUSTED INPUT, so everything read from it is picked field by field (never copied as it came),
 * tidied by the same functions the forms use, cut to the same limits, and checked again when it is applied (lib/cv/importApply.ts), whatever
 * a browser sent back. Nothing is ever evaluated or rendered as HTML.
 */
export type Candidate = { kind: EntryKind; title: string; org: string; location: string; startsOn: string; endsOn: string; current: boolean; body: string };
export type ProfileFields = { headline?: string; summary?: string; location?: string; contactEmail?: string; phone?: string; links?: { label: string; url: string }[] };
export type Parsed = { source: "jsonresume" | "linkedin"; profile: ProfileFields; entries: Candidate[]; warnings: string[] };

export const IMPORT_LIMITS = { fileBytes: 1_000_000, totalBytes: 2_000_000, files: 8, candidates: 200, rows: 2000 } as const;

// ---- dates

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
const yearOk = (y: number) => y >= 1950 && y <= 2100;

/** "2020-01-15", "2020-01", "2020", "Jan 2020", "January 2020", "01/2020" -> "2020-01" or "2020"; anything else, "Present" included, -> "". */
export function parseWhen(v: unknown): string {
  const s = cleanLine(v, 40);
  if (!s) return "";
  let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:[T ].*)?$/.exec(s);
  if (m) { const y = Number(m[1]), mo = Number(m[2]); return yearOk(y) && mo >= 1 && mo <= 12 ? `${y}-${pad(mo)}` : ""; }
  m = /^(\d{4})$/.exec(s);
  if (m) return yearOk(Number(m[1])) ? m[1] : "";
  m = /^(\d{1,2})[/.](\d{4})$/.exec(s);
  if (m) { const mo = Number(m[1]), y = Number(m[2]); return yearOk(y) && mo >= 1 && mo <= 12 ? `${y}-${pad(mo)}` : ""; }
  m = /^([A-Za-z]{3,9})\.?,?\s+(?:\d{1,2},?\s+)?(\d{4})$/.exec(s);
  if (m) { const mo = MONTHS[m[1].slice(0, 3).toLowerCase()], y = Number(m[2]); return mo && yearOk(y) ? `${y}-${pad(mo)}` : ""; }
  return "";
}

// ---- tidying: the one place a candidate is made safe, used when reading AND when applying

/** A candidate with every field re-cleaned and capped, or null when it has no title or an unknown kind. */
export function sanitizeCandidate(c: unknown): Candidate | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const kind = ENTRY_KIND_LIST.find((k) => k === o.kind);
  const title = cleanLine(o.title, LIMITS.title);
  if (!kind || !title) return null;
  const startsOn = parseWhen(o.startsOn), current = o.current === true && !!startsOn;
  const endsOn = current ? "" : parseWhen(o.endsOn);
  return { kind, title, org: cleanLine(o.org, LIMITS.org), location: cleanLine(o.location, LIMITS.location), startsOn, endsOn: startsOn && endsOn && endsOn < startsOn ? "" : endsOn, current, body: cleanBlock(o.body, LIMITS.body) };
}

/** Profile fields re-cleaned and capped; anything unusable is dropped rather than guessed at. */
export function sanitizeProfile(p: unknown): ProfileFields {
  const o = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
  const out: ProfileFields = {};
  const headline = cleanLine(o.headline, LIMITS.headline); if (headline) out.headline = headline;
  const summary = cleanBlock(o.summary, LIMITS.summary); if (summary) out.summary = summary;
  const location = cleanLine(o.location, LIMITS.location); if (location) out.location = location;
  const email = cleanLine(o.contactEmail, LIMITS.email).toLowerCase(); if (email && isEmail(email)) out.contactEmail = email;
  const phone = cleanLine(o.phone, LIMITS.phone).replace(/[^\d+()\-\s.]/g, "").replace(/\s+/g, " ").trim(); if (phone) out.phone = phone;
  if (Array.isArray(o.links)) {
    const links = o.links.flatMap((l) => { const r = l && typeof l === "object" ? (l as Record<string, unknown>) : {}; const url = safeUrl(r.url); return url ? [{ label: cleanLine(r.label, LIMITS.linkLabel), url }] : []; });
    if (links.length) out.links = links.slice(0, LIMITS.links);
  }
  return out;
}

const finish = (source: Parsed["source"], profile: unknown, raw: Candidate[], warnings: string[]): Parsed => {
  const seen = new Set<string>(), entries: Candidate[] = [];
  let dropped = 0;
  for (const r of raw) {
    const c = sanitizeCandidate(r);
    if (!c) { dropped++; continue; }
    const key = `${c.kind}|${c.title.toLowerCase()}|${c.org.toLowerCase()}|${c.startsOn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(c);
  }
  if (dropped) warnings.push(`${dropped} ${dropped === 1 ? "item" : "items"} had no title or could not be read, and ${dropped === 1 ? "was" : "were"} left out.`);
  if (entries.length > IMPORT_LIMITS.candidates) { warnings.push(`Only the first ${IMPORT_LIMITS.candidates} items were read.`); entries.length = IMPORT_LIMITS.candidates; }
  return { source, profile: sanitizeProfile(profile), entries, warnings };
};

// ---- JSON Resume

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const own = (o: Record<string, unknown>, k: string): unknown => (Object.hasOwn(o, k) ? o[k] : undefined); // never reads anything inherited
const list = (o: Record<string, unknown>, k: string): Record<string, unknown>[] => { const v = own(o, k); return Array.isArray(v) ? v.filter(isObj).slice(0, 500) : []; };
const lines = (v: unknown): string => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []).join("\n");
const bodyOf = (o: Record<string, unknown>) => [typeof own(o, "summary") === "string" ? (own(o, "summary") as string) : typeof own(o, "description") === "string" ? (own(o, "description") as string) : "", lines(own(o, "highlights"))].filter(Boolean).join("\n");

export function parseJsonResume(text: string): Parsed | { error: string } {
  let data: unknown;
  try { data = JSON.parse(text.replace(/^﻿/, "")); } catch { return { error: "That is not a valid JSON file." }; }
  if (!isObj(data)) return { error: "That does not look like a JSON Resume (it should be an object with basics, work, education…)." };
  const known = ["basics", "work", "education", "skills", "projects", "volunteer", "awards", "languages", "certificates"].filter((k) => Object.hasOwn(data as object, k));
  if (!known.length) return { error: "That does not look like a JSON Resume: none of basics, work, education or skills is in it." };
  const warnings: string[] = [];
  const b = isObj(own(data, "basics")) ? (own(data, "basics") as Record<string, unknown>) : {};
  const loc = isObj(own(b, "location")) ? (own(b, "location") as Record<string, unknown>) : {};
  const links = list(b, "profiles").map((p) => ({ label: own(p, "network"), url: own(p, "url") }));
  const site = safeUrl(own(b, "url")); if (site) links.unshift({ label: "Website", url: site });
  const profile = { headline: own(b, "label"), summary: own(b, "summary"), location: [own(loc, "city"), own(loc, "region"), own(loc, "countryCode")].filter((x) => typeof x === "string" && x).join(", "), contactEmail: own(b, "email"), phone: own(b, "phone"), links };

  const raw: Candidate[] = [];
  const add = (kind: EntryKind, o: Record<string, unknown>, title: unknown, org: unknown, from: unknown, to: unknown, current: boolean, extra: Partial<Candidate> = {}) => raw.push({ kind, title: String(title ?? ""), org: String(org ?? ""), location: String(typeof own(o, "location") === "string" ? own(o, "location") : ""), startsOn: parseWhen(from), endsOn: parseWhen(to), current, body: bodyOf(o), ...extra });
  for (const w of list(data, "work")) add("experience", w, own(w, "position") ?? own(w, "name"), own(w, "name") ?? own(w, "company"), own(w, "startDate"), own(w, "endDate"), !!parseWhen(own(w, "startDate")) && !own(w, "endDate"));
  for (const e of list(data, "education")) add("education", e, own(e, "area") ? [own(e, "studyType"), own(e, "area")].filter(Boolean).join(" ") : own(e, "studyType") ?? own(e, "institution"), own(e, "institution"), own(e, "startDate"), own(e, "endDate"), false, { body: [typeof own(e, "score") === "string" ? `Result: ${own(e, "score")}` : "", lines(own(e, "courses"))].filter(Boolean).join("\n") });
  for (const p of list(data, "projects")) add("project", p, own(p, "name"), own(p, "entity") ?? "", own(p, "startDate"), own(p, "endDate"), false);
  for (const v of list(data, "volunteer")) add("volunteer", v, own(v, "position") ?? own(v, "organization"), own(v, "organization"), own(v, "startDate"), own(v, "endDate"), !!parseWhen(own(v, "startDate")) && !own(v, "endDate"));
  for (const a of list(data, "awards")) add("award", a, own(a, "title"), own(a, "awarder"), own(a, "date"), "", false, { body: "" });
  // a certificate from somewhere else is kept as an award: this platform's own certificates are issued here, not imported
  for (const c of list(data, "certificates")) add("award", c, own(c, "name"), own(c, "issuer"), own(c, "date"), "", false, { body: "" });
  for (const l of list(data, "languages")) add("language", l, own(l, "language"), own(l, "fluency") ?? "", "", "", false, { body: "" });
  for (const s of list(data, "skills")) {
    const kw = Array.isArray(own(s, "keywords")) ? (own(s, "keywords") as unknown[]).filter((k): k is string => typeof k === "string") : [];
    for (const name of kw.length ? kw : [typeof own(s, "name") === "string" ? (own(s, "name") as string) : ""]) raw.push({ kind: "skill", title: name, org: "", location: "", startsOn: "", endsOn: "", current: false, body: "" });
  }
  if (list(data, "references").length) warnings.push("References were not imported: a reference here comes from a real manager or mentor who writes it and you approve it.");
  return finish("jsonresume", profile, raw, warnings);
}

// ---- CSV (the files in a LinkedIn data export)

/** RFC 4180: quoted fields, doubled quotes, newlines inside quotes, a leading byte-order mark, CRLF. Capped, so a huge file cannot hang it. */
export function parseCsv(text: string, maxRows: number = IMPORT_LIMITS.rows): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length && rows.length <= maxRows; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === "\"") { if (s[i + 1] === "\"") { field += "\""; i++; } else quoted = false; } else field += ch;
    } else if (ch === "\"" && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some((c) => c !== "")) rows.push(row); row = []; }
    else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((c) => c !== "")) rows.push(row); }
  return rows.slice(0, maxRows);
}

type Table = { name: string; header: string[]; rows: Record<string, string>[] };
const table = (name: string, text: string): Table | null => {
  const rows = parseCsv(text);
  if (rows.length < 1) return null;
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return { name, header, rows: rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()]))) };
};
const col = (r: Record<string, string>, ...names: string[]) => { for (const n of names) if (Object.hasOwn(r, n) && r[n]) return r[n]; return ""; };
const hasCols = (t: Table, ...cols: string[]) => cols.every((c) => t.header.includes(c));
/** A table of OTHER people (connections, invitations, endorsements received): it has first and last names and a company or position, or says when they connected. */
const isPeople = (t: Table) => t.header.includes("connected on") || (hasCols(t, "first name", "last name") && (t.header.includes("company") || t.header.includes("position")));

export function parseLinkedIn(files: { name: string; text: string }[]): Parsed | { error: string } {
  const tables = files.map((f) => table(f.name, f.text)).filter((t): t is Table => !!t);
  if (!tables.length) return { error: "I could not read any of those files as a table." };
  const warnings: string[] = [], raw: Candidate[] = [], profile: ProfileFields = {};
  let used = 0;
  const blank = { org: "", location: "", startsOn: "", endsOn: "", current: false, body: "" };
  for (const t of tables) {
    if (hasCols(t, "company name", "title")) { // Positions
      used++;
      for (const r of t.rows) { const from = parseWhen(col(r, "started on")), to = parseWhen(col(r, "finished on")); raw.push({ kind: "experience", title: col(r, "title"), org: col(r, "company name"), location: col(r, "location"), startsOn: from, endsOn: to, current: !!from && !col(r, "finished on"), body: col(r, "description") }); }
    } else if (hasCols(t, "school name")) { // Education
      used++;
      for (const r of t.rows) raw.push({ kind: "education", title: col(r, "degree name") || "Studies", org: col(r, "school name"), location: "", startsOn: parseWhen(col(r, "start date")), endsOn: parseWhen(col(r, "end date")), current: false, body: col(r, "notes") });
    } else if (hasCols(t, "name") && t.header.length <= 2 && !t.header.includes("proficiency")) { // Skills
      used++;
      for (const r of t.rows) raw.push({ ...blank, kind: "skill", title: col(r, "name") });
    } else if (hasCols(t, "name", "proficiency")) { // Languages
      used++;
      for (const r of t.rows) raw.push({ ...blank, kind: "language", title: col(r, "name"), org: col(r, "proficiency") });
    } else if (hasCols(t, "name", "authority")) { // Certifications
      used++;
      for (const r of t.rows) raw.push({ ...blank, kind: "award", title: col(r, "name"), org: col(r, "authority"), startsOn: parseWhen(col(r, "started on")) });
    } else if (hasCols(t, "title", "description") && (t.header.includes("url") || t.header.includes("started on")) && !t.header.includes("company name")) { // Projects
      used++;
      for (const r of t.rows) raw.push({ kind: "project", title: col(r, "title"), org: "", location: "", startsOn: parseWhen(col(r, "started on")), endsOn: parseWhen(col(r, "finished on")), current: false, body: col(r, "description") });
    } else if (hasCols(t, "company name", "role")) { // Volunteering
      used++;
      for (const r of t.rows) raw.push({ kind: "volunteer", title: col(r, "role"), org: col(r, "company name"), location: "", startsOn: parseWhen(col(r, "started on")), endsOn: parseWhen(col(r, "finished on")), current: !!parseWhen(col(r, "started on")) && !col(r, "finished on"), body: col(r, "description") });
    } else if (hasCols(t, "title", "issued on")) { // Honors
      used++;
      for (const r of t.rows) raw.push({ ...blank, kind: "award", title: col(r, "title"), startsOn: parseWhen(col(r, "issued on")), body: col(r, "description") });
    } else if (isPeople(t)) { // Connections and similar: other people's details are never imported
      warnings.push(`"${t.name}" lists other people, so it was skipped.`);
    } else if (hasCols(t, "first name", "last name") && (t.header.includes("headline") || t.header.includes("summary"))) { // Profile
      used++;
      const r = t.rows[0] ?? {};
      profile.headline = col(r, "headline"); profile.summary = col(r, "summary"); profile.location = col(r, "geo location");
      const urls = [...col(r, "websites").matchAll(/https?:\/\/[^\s,\]]+/gi)].map((m) => ({ label: "", url: m[0] }));
      if (urls.length) profile.links = urls;
    } else if (hasCols(t, "email address", "primary")) { // Email Addresses (the person's own: it says which is primary)
      used++;
      const primary = t.rows.find((r) => /^yes$/i.test(col(r, "primary"))) ?? t.rows[0];
      if (primary) profile.contactEmail = col(primary, "email address");
    } else if (hasCols(t, "number") && (t.header.includes("type") || t.header.includes("extension"))) { // Phone Numbers
      used++;
      if (t.rows[0]) profile.phone = col(t.rows[0], "number");
    } else warnings.push(`"${t.name}" was not recognised, so it was skipped.`);
  }
  if (!used) return { error: "None of those files looked like part of a LinkedIn data export. Upload files such as Positions.csv, Education.csv, Skills.csv or Profile.csv." };
  return finish("linkedin", profile, raw, warnings);
}

/** One file or several: a lone .json is a JSON Resume; CSV files are a LinkedIn export. */
export function readFiles(files: { name: string; text: string }[]): Parsed | { error: string } {
  if (!files.length) return { error: "Choose a file first." };
  const json = files.filter((f) => /\.json$/i.test(f.name)), csv = files.filter((f) => /\.csv$/i.test(f.name));
  if (json.length && csv.length) return { error: "Upload either one JSON Resume file or LinkedIn CSV files, not both together." };
  if (json.length > 1) return { error: "Upload one JSON Resume file at a time." };
  if (json.length === 1) return parseJsonResume(json[0].text);
  if (csv.length) return parseLinkedIn(csv);
  return { error: "I can read a .json (JSON Resume) file or the .csv files from a LinkedIn data export." };
}
