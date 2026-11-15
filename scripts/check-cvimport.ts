/**
 * Checks importing and exporting a CV: npm run check:cvimport (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows. Run db:push first).
 * A file is untrusted input: dates and CSV are read correctly, every field is cleaned and capped, hostile files do nothing, a tampered preview is
 * cleaned again when applied, nothing is duplicated or overwritten unless chosen, and what is exported can be imported back.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { certificates, cvEntries, cvProfiles, db, tracks, users } from "../lib/db";
import { exportJsonResume } from "../lib/cv/export";
import { IMPORT_LIMITS, parseCsv, parseJsonResume, parseLinkedIn, parseWhen, readFiles, sanitizeCandidate, sanitizeProfile } from "../lib/cv/import";
import { applyImport } from "../lib/cv/importApply";
import { LIMITS } from "../lib/cv/types";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const parsed = (r: unknown) => !(r && typeof r === "object" && "error" in r);
const BASE = "https://example.test";

// ---- dates
check("dates in the forms files use are read", parseWhen("2020-01-15") === "2020-01" && parseWhen("2020-01") === "2020-01" && parseWhen("2020") === "2020" && parseWhen("Jan 2020") === "2020-01" && parseWhen("January 2020") === "2020-01" && parseWhen("01/2020") === "2020-01" && parseWhen("Mar 15, 2021") === "2021-03" && parseWhen("2020-06-01T00:00:00Z") === "2020-06");
check("nonsense, Present and out-of-range dates are empty, not guessed", ["", "Present", "soon", "2020-13", "1800", "2300", "Foo 2020", "13/2020", "2020-00"].every((d) => parseWhen(d) === ""));

// ---- CSV
const csv = parseCsv("﻿\"Company Name\",Title,Description\r\n\"Acme, Inc\",\"Dev\",\"Line one\nLine two with \"\"quotes\"\"\"\r\n\r\nB,C,D\r\n");
check("CSV: quotes, commas, doubled quotes, newlines inside a field, a byte-order mark and CRLF", csv.length === 3 && csv[0][0] === "Company Name" && csv[1][0] === "Acme, Inc" && csv[1][2] === "Line one\nLine two with \"quotes\"" && csv[2].join("|") === "B|C|D");
check("CSV: a huge file is cut, and does not hang", (() => { const t0 = Date.now(); const rows = parseCsv("a,b\n".repeat(200000)); return rows.length <= IMPORT_LIMITS.rows && Date.now() - t0 < 2000; })());
check("CSV: ragged rows and empty input do not throw", parseCsv("a,b,c\n1\n1,2,3,4,5\n").length === 3 && parseCsv("").length === 0);

// ---- JSON Resume
const resume = {
  basics: { name: "Ada Lovelace", label: "Analyst", email: "ada@example.test", phone: "+44 7000 000000", summary: "Wrote the first program.", location: { city: "London", countryCode: "GB" }, profiles: [{ network: "GitHub", url: "https://github.com/ada" }, { network: "Bad", url: "javascript:alert(1)" }], url: "https://ada.example.test" },
  work: [{ name: "Analytical Engines Ltd", position: "Programmer", startDate: "2020-01", summary: "Wrote programs.", highlights: ["Built the first loop", "Documented it"] }, { name: "Old Co", position: "Clerk", startDate: "2015", endDate: "2019-12" }],
  education: [{ institution: "Home", area: "Mathematics", studyType: "BSc", startDate: "2010", endDate: "2014", score: "First", courses: ["Algebra"] }],
  projects: [{ name: "Notes", description: "A set of notes", highlights: ["Translated a paper"], startDate: "2019" }],
  volunteer: [{ organization: "Charity", position: "Helper", startDate: "2021-05" }],
  awards: [{ title: "Medal", awarder: "Society", date: "2018-06-01" }],
  certificates: [{ name: "Cert A", issuer: "Body", date: "2022-01" }],
  languages: [{ language: "French", fluency: "Fluent" }],
  skills: [{ name: "Web", keywords: ["HTML", "CSS"] }, { name: "Maths" }],
  references: [{ name: "Someone", reference: "A great person." }],
};
const full = parseJsonResume(JSON.stringify(resume));
if ("error" in full) throw new Error(full.error);
const kinds = (k: string) => full.entries.filter((e) => e.kind === k);
check("JSON Resume: work, education, projects, volunteering, awards, languages and skills map to the right kinds", kinds("experience").length === 2 && kinds("education").length === 1 && kinds("project").length === 1 && kinds("volunteer").length === 1 && kinds("award").length === 2 && kinds("language").length === 1 && kinds("skill").length === 3);
check("JSON Resume: a job with no end date is current, one with an end date is not, and bullets are kept", kinds("experience")[0].current && !kinds("experience")[1].current && kinds("experience")[1].endsOn === "2019-12" && kinds("experience")[0].body.includes("Built the first loop"));
check("JSON Resume: the profile is read, and an unsafe link is dropped", full.profile.headline === "Analyst" && full.profile.contactEmail === "ada@example.test" && full.profile.location === "London, GB" && (full.profile.links ?? []).some((l) => l.url === "https://github.com/ada") && !(full.profile.links ?? []).some((l) => l.url.startsWith("javascript")));
check("JSON Resume: references are not imported, and the person is told why", !full.entries.some((e) => e.title === "Someone") && full.warnings.some((w) => w.includes("References")));
check("JSON Resume: a certificate from elsewhere becomes an award, not a platform certificate", kinds("award").some((a) => a.title === "Cert A" && a.org === "Body"));
check("not JSON, not an object, or nothing recognisable is refused with a reason", !parsed(parseJsonResume("not json")) && !parsed(parseJsonResume("[1,2]")) && !parsed(parseJsonResume("{\"hello\":1}")) && !parsed(parseJsonResume("")));
const polluted = parseJsonResume("{\"__proto__\":{\"polluted\":true},\"constructor\":{\"prototype\":{\"polluted2\":true}},\"basics\":{\"label\":\"X\"},\"work\":[{\"__proto__\":{\"title\":\"Hacked\"},\"name\":\"Co\",\"position\":\"Dev\"}]}");
check("a prototype-pollution attempt changes nothing and the file still reads", parsed(polluted) && ({} as Record<string, unknown>).polluted === undefined && ({} as Record<string, unknown>).polluted2 === undefined && ("entries" in polluted && polluted.entries[0].title === "Dev"));
const hostile = parseJsonResume(JSON.stringify({ basics: { label: "<script>alert(1)</script>".repeat(50), summary: "x".repeat(9000), email: "not an email", url: "ftp://x" }, work: Array.from({ length: 400 }, (_, i) => ({ name: "<img src=x onerror=alert(1)>", position: `Job ${i}`, startDate: "2020" })), skills: [{ keywords: [123, null, { a: 1 }, "ok"] }] }));
if ("error" in hostile) throw new Error(hostile.error);
check("hostile content is kept as plain text and capped: markup is data, long text is cut, a bad email is dropped", (hostile.profile.headline ?? "").length <= LIMITS.headline && (hostile.profile.summary ?? "").length <= LIMITS.summary && hostile.profile.contactEmail === undefined && hostile.entries.every((e) => e.title.length <= LIMITS.title && e.org.length <= LIMITS.org));
check("a file with hundreds of items is capped, with a warning", hostile.entries.length <= IMPORT_LIMITS.candidates && hostile.warnings.some((w) => w.includes("first")));
check("odd values inside a list are ignored", (() => { const r = parseJsonResume(JSON.stringify({ skills: [{ keywords: [123, null, { a: 1 }, ["x"], "ok"] }, 7, null, "str"], work: [5, null, "x", { name: 9, position: [] }] })); return "entries" in r && r.entries.length === 1 && r.entries[0].title === "ok"; })());
check("duplicates inside one file are read once", (() => { const r = parseJsonResume(JSON.stringify({ work: [{ name: "A", position: "B", startDate: "2020" }, { name: "a", position: "b", startDate: "2020" }] })); return "entries" in r && r.entries.length === 1; })());

// ---- LinkedIn
const li = parseLinkedIn([
  { name: "Positions.csv", text: "Company Name,Title,Description,Location,Started On,Finished On\n\"Acme, Inc\",Engineer,\"Did things\nMore things\",London,Jan 2020,\nOld Co,Clerk,,Leeds,Mar 2015,Dec 2019\n" },
  { name: "Education.csv", text: "School Name,Start Date,End Date,Notes,Degree Name,Activities\nUni,2010,2014,Good,BSc Maths,Chess\n" },
  { name: "Skills.csv", text: "Name\nExcel\nSQL\n" },
  { name: "Languages.csv", text: "Name,Proficiency\nFrench,Professional working\n" },
  { name: "Certifications.csv", text: "Name,Url,Authority,Started On,Finished On,License Number\nAWS Cert,https://x.example,Amazon,Mar 2021,,123\n" },
  { name: "Volunteering.csv", text: "Company Name,Role,Cause,Started On,Finished On,Description\nCharity,Helper,Education,Jun 2021,,Helped\n" },
  { name: "Profile.csv", text: "First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers\nAda,L,,1 Private Street,1815-12-10,Engineer,I build things.,Tech,N1,\"London, United Kingdom\",,[PERSONAL:https://ada.example.test],\n" },
  { name: "Email Addresses.csv", text: "Email Address,Confirmed,Primary,Updated On\nold@example.test,Yes,No,2019\nada@example.test,Yes,Yes,2020\n" },
  { name: "Connections.csv", text: "First Name,Company,Position\nBob,X,Y\n" },
]);
if ("error" in li) throw new Error(li.error);
const lk = (k: string) => li.entries.filter((e) => e.kind === k);
check("LinkedIn: positions, education, skills, languages, certifications and volunteering are read", lk("experience").length === 2 && lk("education").length === 1 && lk("skill").length === 2 && lk("language").length === 1 && lk("award").length === 1 && lk("volunteer").length === 1);
check("LinkedIn: a quoted company with a comma, and a description with a line break, survive; no end date means current", lk("experience")[0].org === "Acme, Inc" && lk("experience")[0].body === "Did things\nMore things" && lk("experience")[0].current && !lk("experience")[1].current);
check("LinkedIn: the profile is read, the primary email is chosen, and the private address and birth date are not", li.profile.headline === "Engineer" && li.profile.location === "London, United Kingdom" && li.profile.contactEmail === "ada@example.test" && !JSON.stringify(li).includes("Private Street") && !JSON.stringify(li).includes("1815") && (li.profile.links ?? [])[0]?.url === "https://ada.example.test/");
check("LinkedIn: a file that is not recognised is skipped with a note, and connections are never imported", li.warnings.some((w) => w.includes("Connections.csv")) && !li.entries.some((e) => e.title === "Bob"));
const people = { name: "Connections.csv", text: "Notes:\nThis is a note line\n\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\nBob,Smith,https://li.example/bob,bob@example.test,X Ltd,Boss,01 Jan 2020\n" };
const mine = { name: "Profile.csv", text: "First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers\nAda,L,,Home,1815-12-10,Real headline,Real summary,Tech,N1,Leeds,,,\n" };
const both = (order: { name: string; text: string }[]) => parseLinkedIn(order);
check("LinkedIn: a Connections file never overwrites the profile or leaks someone else\x27s email, whichever order the files come in", [both([mine, people]), both([people, mine])].every((r) => !("error" in r) && r.profile.headline === "Real headline" && r.profile.summary === "Real summary" && r.profile.contactEmail === undefined && !JSON.stringify(r).includes("bob@example.test") && !JSON.stringify(r).includes("Bob") && r.warnings.some((w) => w.includes("Connections.csv"))));
check("LinkedIn: a Connections file on its own is refused, not read as a profile", !parsed(parseLinkedIn([people])));
check("LinkedIn: a table with only a number column is not taken for phone numbers, and one with an email column but no primary is not taken for the person\x27s email", (() => { const r = parseLinkedIn([{ name: "Skills.csv", text: "Name\nSQL\n" }, { name: "x.csv", text: "Number\n5551234\n" }, { name: "y.csv", text: "Email Address,Name\nz@example.test,Z\n" }]); return !("error" in r) && r.profile.phone === undefined && r.profile.contactEmail === undefined; })());
check("LinkedIn: files that are not an export are refused with a reason", !parsed(parseLinkedIn([{ name: "x.csv", text: "a,b\n1,2\n" }])) && !parsed(parseLinkedIn([{ name: "x.csv", text: "" }])));
check("reading files: one json, or csv files, never both, never several jsons, never something else", !parsed(readFiles([])) && !parsed(readFiles([{ name: "a.json", text: "{}" }, { name: "b.csv", text: "a\n1" }])) && !parsed(readFiles([{ name: "a.json", text: "{}" }, { name: "b.json", text: "{}" }])) && !parsed(readFiles([{ name: "a.exe", text: "x" }])) && parsed(readFiles([{ name: "resume.JSON", text: JSON.stringify(resume) }])));

// ---- sanitising (what is checked again when applied)
check("a tampered candidate is cleaned: unknown kind, no title, huge fields, bad dates, current without a start", sanitizeCandidate({ kind: "hacker", title: "x" }) === null && sanitizeCandidate({ kind: "skill", title: "   " }) === null && sanitizeCandidate(null) === null && sanitizeCandidate("x") === null && (() => { const c = sanitizeCandidate({ kind: "experience", title: "T".repeat(500), org: "O".repeat(500), body: "B".repeat(9000), startsOn: "garbage", endsOn: "2020", current: true })!; return c.title.length === LIMITS.title && c.org.length === LIMITS.org && c.body.length <= LIMITS.body && c.startsOn === "" && !c.current; })());
check("an end before the start is dropped, and a current job has no end", sanitizeCandidate({ kind: "experience", title: "A", startsOn: "2020", endsOn: "2019" })!.endsOn === "" && sanitizeCandidate({ kind: "experience", title: "A", startsOn: "2020", endsOn: "2021", current: true })!.endsOn === "");
check("tampered profile fields are cleaned: bad email, script links, huge text, phone junk", (() => { const p = sanitizeProfile({ headline: "h".repeat(999), contactEmail: "nope", phone: "+44 (0) abc 123", links: [{ label: "x", url: "javascript:alert(1)" }, { label: "ok", url: "https://ok.example" }, "junk", null], summary: 12 }); return p.headline!.length === LIMITS.headline && p.contactEmail === undefined && p.phone === "+44 (0) 123" && p.links!.length === 1 && p.links![0].url === "https://ok.example/" && p.summary === undefined; })());

// ---- the source
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
check("the import actions work as the person (or a super admin through a view, logged) and limit size and rate", /actingUser\(\)/.test(src("app/cv-import-actions.ts")) && src("app/cv-import-actions.ts").includes("logViewAsUse(") && src("app/cv-import-actions.ts").includes("IMPORT_LIMITS.fileBytes") && src("app/cv-import-actions.ts").includes("allowed(key"));
check("nothing in an import is ever rendered as HTML", ![...walk("components/cv"), "app/(site)/profile/cv/import/page.tsx"].filter((f) => f.endsWith("x")).some((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML")));
check("the export needs a signed-in person and is never cached", src("app/(site)/profile/cv/export/route.ts").includes("currentUser()") && src("app/(site)/profile/cv/export/route.ts").includes("no-store"));

// ---- the database: applying, and the round trip
const made: number[] = [], certIds: number[] = [];
const person = (tag: string) => { const u = db.insert(users).values({ email: `t-${tag}@cvimport.check`, name: `T ${tag}`, jobRole: "developer" }).returning().get(); made.push(u.id); return u; };
const track = db.select().from(tracks).get();
try {
  const a = person("a");
  const cand = (title: string, kind = "experience", extra: Record<string, unknown> = {}) => ({ kind, title, org: "Org", startsOn: "2020-01", ...extra });
  check("applying adds the chosen items and says so", (() => { const r = applyImport(a.id, { entries: [cand("First"), cand("Second"), cand("Third")], profile: {} }); return "added" in r && r.added === 3 && db.select().from(cvEntries).where(eq(cvEntries.userId, a.id)).all().length === 3; })());
  check("the first item in the file ends up on top", (() => { const order = db.select().from(cvEntries).where(eq(cvEntries.userId, a.id)).orderBy(cvEntries.sort, cvEntries.id).all().map((e) => e.title); return order.join() === "First,Second,Third"; })());
  check("importing the same things again adds nothing and never duplicates", (() => { const r = applyImport(a.id, { entries: [cand("First"), cand("first"), cand("Second")], profile: {} }); return "error" in r && db.select().from(cvEntries).where(eq(cvEntries.userId, a.id)).all().length === 3; })());
  check("a later import goes above what was there, in file order", (() => { applyImport(a.id, { entries: [cand("New one"), cand("New two")], profile: {} }); return db.select().from(cvEntries).where(eq(cvEntries.userId, a.id)).orderBy(cvEntries.sort, cvEntries.id).all().map((e) => e.title).slice(0, 2).join() === "New one,New two"; })());
  check("nothing chosen is refused", "error" in (applyImport(a.id, { entries: [], profile: {} }) as object) && "error" in (applyImport(a.id, null) as object) && "error" in (applyImport(a.id, "string") as object));
  check("a profile field is only changed when it was chosen, and the others are untouched", (() => { db.insert(cvProfiles).values({ userId: a.id, headline: "Keep me", summary: "Keep me too" }).run(); const r = applyImport(a.id, { entries: [], profile: { location: "Leeds" } }); const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, a.id)).get()!; return "profile" in r && p.location === "Leeds" && p.headline === "Keep me" && p.summary === "Keep me too"; })());
  check("links are added to the ones already there, never duplicated, and capped", (() => { applyImport(a.id, { entries: [], profile: { links: [{ label: "A", url: "https://a.example" }] } }); applyImport(a.id, { entries: [], profile: { links: [{ label: "A again", url: "https://a.example" }, ...Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, url: `https://l${i}.example` }))] } }); const links = JSON.parse(db.select().from(cvProfiles).where(eq(cvProfiles.userId, a.id)).get()!.links) as { url: string }[]; return links.length === LIMITS.links && new Set(links.map((l) => l.url)).size === links.length; })());
  check("a tampered preview is cleaned again on the server: scripts in links, bad email, huge text", (() => { const b = person("b"); applyImport(b.id, { entries: [cand("T".repeat(900), "skill", { body: "B".repeat(9999) })], profile: { contactEmail: "nope", links: [{ label: "x", url: "javascript:alert(1)" }], headline: "h".repeat(999) } }); const e = db.select().from(cvEntries).where(eq(cvEntries.userId, b.id)).get()!; const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, b.id)).get(); return e.title.length === LIMITS.title && e.body.length <= LIMITS.body && p!.contactEmail === "" && !p!.links.includes("javascript") && p!.headline.length === LIMITS.headline; })());
  check("an unknown kind in a tampered preview is dropped, not stored", (() => { const b = person("b2"); const r = applyImport(b.id, { entries: [{ kind: "hacker", title: "X" }, cand("Real")], profile: {} }); return "added" in r && r.added === 1 && db.select().from(cvEntries).where(eq(cvEntries.userId, b.id)).all().every((e) => e.title === "Real"); })());
  check("nothing takes a CV over the entry limit", (() => { const c = person("c"); for (let i = 0; i < LIMITS.entries - 2; i++) db.insert(cvEntries).values({ userId: c.id, kind: "skill", title: `S${i}` }).run(); const r = applyImport(c.id, { entries: [cand("N1"), cand("N2"), cand("N3"), cand("N4"), cand("N5")], profile: {} }); const n = db.select().from(cvEntries).where(eq(cvEntries.userId, c.id)).all().length; const full = applyImport(c.id, { entries: [cand("N6")], profile: {} }); return "added" in r && r.added === 2 && r.skipped === 3 && n === LIMITS.entries && "error" in full; })());
  check("importing for one person never touches another's CV", (() => { const d = person("d"), e = person("e"); applyImport(d.id, { entries: [cand("Only d")], profile: { headline: "D head" } }); return db.select().from(cvEntries).where(eq(cvEntries.userId, e.id)).all().length === 0 && !db.select().from(cvProfiles).where(eq(cvProfiles.userId, e.id)).get(); })());

  // export, and the round trip
  const x = person("x");
  db.insert(cvProfiles).values({ userId: x.id, headline: "Head", summary: "Sum", location: "Leeds", contactEmail: "x@example.test", phone: "+44 7000", links: JSON.stringify([{ label: "Site", url: "https://x.example/" }]), hidden: "[]" }).run();
  db.insert(cvEntries).values([
    { userId: x.id, kind: "experience", title: "Dev", org: "Acme", startsOn: "2022-01", current: true, body: "Built a thing\nShipped it", sort: 0 },
    { userId: x.id, kind: "experience", title: "Hidden job", org: "Secret", visible: false, sort: 1 },
    { userId: x.id, kind: "education", title: "Maths", org: "Uni", startsOn: "2010", endsOn: "2014", sort: 2 },
    { userId: x.id, kind: "skill", title: "Excel", sort: 3 }, { userId: x.id, kind: "language", title: "French", org: "Fluent", sort: 4 },
    { userId: x.id, kind: "project", title: "Side", org: "Me", startsOn: "2019", sort: 5 }, { userId: x.id, kind: "award", title: "Medal", org: "Society", startsOn: "2018", sort: 6 }, { userId: x.id, kind: "volunteer", title: "Helper", org: "Charity", startsOn: "2021-05", current: true, sort: 7 },
  ]).run();
  if (track) { const c = db.insert(certificates).values({ userId: x.id, trackId: track.id, level: 5, code: "CVIMP001", score: 0.9 }).returning().get(); certIds.push(c.id); }
  const out = exportJsonResume(x.id, BASE)!;
  const flat = JSON.stringify(out);
  check("the export is a JSON Resume: the right shape, the person's own details, and what is on their CV", (out.basics as { name: string; email: string }).name === "T x" && (out.basics as { email: string }).email === "x@example.test" && Array.isArray(out.work) && (out.work as unknown[]).length === 1 && (out.education as unknown[]).length === 1 && typeof out.$schema === "string");
  check("something the person hid is not in it", !flat.includes("Hidden job") && !flat.includes("Secret"));
  check("a certificate earned here carries its public verification address", !track || (out.certificates as { url?: string }[]).some((c) => c.url === `${BASE}/cert/CVIMP001`));
  check("someone who has left, or does not exist, has no export", exportJsonResume(999999999, BASE) === null);
  const back = parseJsonResume(flat);
  if ("error" in back) throw new Error(back.error);
  const key = (e: { kind: string; title: string; org: string; startsOn: string; endsOn: string; current: boolean }) => `${e.kind}|${e.title}|${e.org}|${e.startsOn}|${e.endsOn}|${e.current}`;
  const orig = db.select().from(cvEntries).where(eq(cvEntries.userId, x.id)).all().filter((e) => e.visible).map(key).sort();
  const got = back.entries.filter((e) => !(e.kind === "skill" && e.title.startsWith("Level") ) && !(e.kind === "award" && e.org === "gglearn")).map(key).sort();
  check("exporting and importing again gives back what the person typed", orig.every((k) => got.includes(k)));
  check("the profile comes back too", back.profile.headline === "Head" && back.profile.summary === "Sum" && back.profile.contactEmail === "x@example.test" && back.profile.location === "Leeds");
} finally {
  if (made.length) {
    if (certIds.length) db.delete(certificates).where(inArray(certificates.id, certIds)).run();
    db.delete(cvEntries).where(inArray(cvEntries.userId, made)).run();
    db.delete(cvProfiles).where(inArray(cvProfiles.userId, made)).run();
    db.delete(users).where(inArray(users.id, made)).run();
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
