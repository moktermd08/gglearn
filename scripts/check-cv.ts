/**
 * Checks the CV manager: npm run check:cv (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows. Run db:push first).
 * What a person types is cleaned and checked, a share link cannot be forged, guessed, reused after it is revoked or expired, or opened without
 * its passcode, what the owner hid or a view does not allow never reaches a reader, and the PDF is valid and survives hostile text.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { answerNotes, answers, certificates, cvEntries, cvLinks, cvProfiles, cvQuotes, db, questions, runs, tracks, users } from "../lib/db";
import { buildCv } from "../lib/cv/build";
import { createLink, gateOpen, gateValue, linkByToken, openLink, recordView, revokeLink, tokenOf, updateLink, viewOf, viewForOwner } from "../lib/cv/links";
import { renderPdf } from "../lib/cv/pdf";
import { cleanBlock, cleanLine, dateRange, isEmail, monthYear, safeUrl } from "../lib/cv/text";
import { LIMITS, PRESETS, SECTION_KEYS } from "../lib/cv/types";

process.env.SESSION_SECRET ??= "check-cv-secret-0123456789abcdef";
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const BASE = "https://example.test";

async function main() {

// ---- text
check("an address without a scheme gets https", safeUrl("linkedin.com/in/me") === "https://linkedin.com/in/me");
check("javascript:, data:, file: and mailto: addresses are refused", [safeUrl("javascript:alert(1)"), safeUrl("data:text/html,x"), safeUrl("file:///etc/passwd"), safeUrl("mailto:a@b.co")].every((v) => v === null));
check("an address with a login in it, or no dot in the host, is refused", safeUrl("https://user:pw@evil.example/x") === null && safeUrl("https://localhost/x") === null && safeUrl("not a url") === null);
check("control characters and extra spaces are dropped from one-line text", cleanLine(" a\u0000  b\n\tc ", 50) === "a b c" && cleanLine("x".repeat(300), 10).length === 10);
check("bullets are tidied one per line, markers dropped", cleanBlock("- one\r\n\r\n•  two  \n* three", 100) === "one\ntwo\nthree");
check("emails are checked", isEmail("a.b@c.co") && !isEmail("a b@c.co") && !isEmail("a@b") && !isEmail("<x>@y.co"));
check("dates read well", monthYear("2024-05") === "May 2024" && monthYear("2024") === "2024" && monthYear("2024-13") === "" && dateRange("2022-01", "", true) === "Jan 2022 – Present" && dateRange("2019", "2021", false) === "2019 – 2021");

// ---- the source: what must stay true
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const readerFiles = [...walk("components/cv"), ...walk("app/(cv)")].filter((f) => /\.(tsx?|ts)$/.test(f));
check("nothing a reader sees is ever rendered as HTML", !readerFiles.some((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML")));
check("the reader layout sends no referrer and is not indexed by default", src("app/(cv)/layout.tsx").includes('referrer: "no-referrer"') && src("app/(cv)/layout.tsx").includes("index: false"));
check("external links in a CV are noopener noreferrer", src("components/cv/CvView.tsx").includes("noopener noreferrer"));
check("every CV action refuses while viewing as someone", src("app/cv-actions.ts").includes("refuseWhileViewingAs()") && (src("app/cv-actions.ts").match(/const me = await owner\(\);/g) ?? []).length >= 10);
check("an unknown, revoked or expired link is a plain 404 on the page and the PDF", src("app/(cv)/cv/[token]/page.tsx").includes("if (!link) notFound()") && src("app/(cv)/cv/[token]/pdf/route.ts").includes("if (!link || !link.allowPdf) return NO()"));
check("a passcode link is gated on the page and on the PDF", src("app/(cv)/cv/[token]/page.tsx").includes("gateOpen(") && src("app/(cv)/cv/[token]/pdf/route.ts").includes("gateOpen("));
check("the CV is built only from the builder, which the page, the PDF and the preview all use", ["app/(cv)/cv/[token]/page.tsx", "app/(cv)/cv/[token]/pdf/route.ts", "app/(site)/profile/cv/pdf/route.ts", "app/(site)/profile/cv/preview/page.tsx"].every((f) => src(f).includes("buildCv(")));

// ---- the PDF
const doc = (over: Record<string, unknown> = {}) => ({
  userId: 1, name: "Zoë Ñandú", headline: "Headline", contact: [{ kind: "email", label: "Email", value: "z@example.test", href: "mailto:z@example.test" }], template: "classic", accent: "", generatedAt: Math.floor(Date.now() / 1000), assessedNote: "n",
  sections: [{ key: "summary", title: "Profile", items: [{ title: "", body: ["Hello"] }] }], ...over,
});
const pdf = async (d: unknown) => renderPdf(d as never);
const first = await pdf(doc());
check("a PDF is produced, valid, and carries the title", Buffer.from(first.slice(0, 5)).toString() === "%PDF-" && (await PDFDocument.load(first)).getTitle() === "Zoë Ñandú: CV");
const many = await pdf(doc({ sections: [{ key: "experience", title: "Experience", items: Array.from({ length: 60 }, (_, i) => ({ title: `Job ${i}`, subtitle: "Somewhere", dates: "2020 – 2021", body: ["A long achievement ".repeat(12), "Another point"] })) }] }));
check("a long CV runs onto more pages", (await PDFDocument.load(many)).getPageCount() > 1);
const hostile = await pdf(doc({ name: "😀 ✓ عربى 中文 \u0000 name", headline: "x".repeat(400), sections: [{ key: "summary", title: "Profile", items: [{ title: "😀".repeat(50), body: ["A".repeat(500), "https://example.test/" + "a".repeat(400), "عربى 中文 ✓ ‮"] }] }] }));
check("emoji, other scripts, control characters and very long words do not break it", (await PDFDocument.load(hostile)).getPageCount() >= 1);
for (const t of ["classic", "modern", "compact"]) check(`the ${t} layout renders`, (await PDFDocument.load(await pdf(doc({ template: t, accent: "#e11d48" })))).getPageCount() >= 1);

// ---- links and the builder, against the database
const made: number[] = [], runIds: number[] = [], noteIds: number[] = [], certIds: number[] = [];
const person = (tag: string, extra: Partial<typeof users.$inferInsert> = {}) => { const u = db.insert(users).values({ email: `t-${tag}@cv.check`, name: `T ${tag}`, jobRole: "developer", ...extra }).returning().get(); made.push(u.id); return u; };
const track = db.select().from(tracks).get();
try {
  const owner = person("owner"), other = person("other"), gone = person("gone", { status: "offboarded" });
  db.insert(cvProfiles).values({ userId: owner.id, headline: "Test headline", summary: "A summary.", location: "Leeds", contactEmail: "owner@example.test", phone: "+44 7000 000000", links: JSON.stringify([{ label: "Site", url: "https://example.test" }, { label: "Bad", url: "javascript:alert(1)" }]) }).run();
  db.insert(cvEntries).values([
    { userId: owner.id, kind: "experience", title: "Shown job", org: "Acme", startsOn: "2022-01", current: true, body: "Did a thing", sort: 0 },
    { userId: owner.id, kind: "experience", title: "Hidden job", org: "Secret Co", visible: false, sort: 1 },
    { userId: owner.id, kind: "skill", title: "Excel", sort: 2 },
  ]).run();

  // the token
  const made1 = await createLink(owner.id, { label: "Recruiter", kind: "private" });
  if ("error" in made1) throw new Error(made1.error);
  const L = made1.link, tok = tokenOf(L);
  check("a good token finds its link", linkByToken(tok)?.id === L.id && openLink(tok)?.id === L.id);
  const [idPart, sig] = tok.split(".");
  check("a changed id, a changed signature, or a counted-up id finds nothing", linkByToken(`${Number(idPart) + 1}.${sig}`) === null && linkByToken(`${idPart}.${"A".repeat(32)}`) === null && linkByToken(`${idPart}.${sig.slice(0, 31)}${sig[31] === "A" ? "B" : "A"}`) === null);
  check("garbage finds nothing", ["", "x", "1", "1.", "a.b", "../1.x", `${idPart}.${sig}/extra`].every((t) => linkByToken(t) === null));
  check("another link's signature does not open this one", (() => { const b = db.insert(cvLinks).values({ userId: owner.id, kind: "private", nonce: "different", sections: "{}", contact: "{}" }).returning().get(); const tb = tokenOf(b); made.length; const r = linkByToken(`${L.id}.${tb.split(".")[1]}`) === null; db.delete(cvLinks).where(eq(cvLinks.id, b.id)).run(); return r; })());
  check("a view shows nothing that is not switched on", (() => { const v = viewOf({ sections: "{}", contact: "garbage" }); return SECTION_KEYS.every((k) => v.sections[k] === false) && !v.contact.email; })());
  check("a recruiter link starts from the recruiter view, a public one from the public view", viewOf(L).contact.email === true && (await (async () => { const r = await createLink(owner.id, { kind: "public" }); return "link" in r && viewOf(r.link).contact.email === false && viewOf(r.link).sections.goal === false; })()));

  // passcode
  check("a passcode link needs a code of enough length", "error" in (await createLink(owner.id, { kind: "passcode", passcode: "abc" })) && "error" in (await createLink(owner.id, { kind: "passcode" })));
  const pc = await createLink(owner.id, { kind: "passcode", passcode: "correct horse" });
  if ("error" in pc) throw new Error(pc.error);
  check("the passcode is stored only as a hash", pc.link.passHash.length > 20 && !pc.link.passHash.includes("correct") && pc.link.kind === "passcode");
  const gv = gateValue(pc.link.id), t0 = Math.floor(Date.now() / 1000);
  check("the gate opens only for its own link, and not after it expires", gateOpen(pc.link.id, gv) && !gateOpen(pc.link.id + 1, gv) && !gateOpen(pc.link.id, gv, t0 + 13 * 3600) && !gateOpen(pc.link.id, undefined) && !gateOpen(pc.link.id, "123.abc"));
  check("an invalid kind is refused", "error" in (await createLink(owner.id, { kind: "everyone" })));

  // states
  check("a link that has ended, or been revoked, is not open", (() => {
    const exp = db.insert(cvLinks).values({ userId: owner.id, kind: "private", nonce: "n1", sections: "{}", contact: "{}", expiresAt: t0 - 5 }).returning().get();
    const rev = db.insert(cvLinks).values({ userId: owner.id, kind: "private", nonce: "n2", sections: "{}", contact: "{}", revokedAt: t0 - 5 }).returning().get();
    const ok = openLink(tokenOf(exp)) === null && openLink(tokenOf(rev)) === null && linkByToken(tokenOf(exp)) !== null;
    db.delete(cvLinks).where(inArray(cvLinks.id, [exp.id, rev.id])).run(); return ok;
  })());
  check("a link whose owner has left is not open", (() => { const g = db.insert(cvLinks).values({ userId: gone.id, kind: "private", nonce: "n3", sections: "{}", contact: "{}" }).returning().get(); const r = openLink(tokenOf(g)) === null; db.delete(cvLinks).where(eq(cvLinks.id, g.id)).run(); return r; })());
  check("someone else cannot change or revoke my link", "error" in updateLink(other.id, L.id, { label: "x" }) && "error" in revokeLink(other.id, L.id) && openLink(tok) !== null);
  check("the owner changes what it shows, and a change only changes that link", (() => { const r = updateLink(owner.id, L.id, { sections: { goal: true }, contact: { phone: false } }); return "link" in r && viewOf(r.link).sections.goal === true && viewOf(r.link).contact.phone === false && viewOf(r.link).contact.email === true; })());
  recordView(L.id); recordView(L.id);
  check("a view is counted, with a time and nothing about the reader", (() => { const r = db.select().from(cvLinks).where(eq(cvLinks.id, L.id)).get()!; return r.views === 2 && r.lastViewedAt != null; })());
  check("the owner can only preview their own links", viewForOwner(other.id, String(L.id)).link === null && viewForOwner(owner.id, String(L.id)).link?.id === L.id);

  // the builder: what a reader gets
  const pub = buildCv(owner.id, PRESETS.public.view, BASE)!, rec = buildCv(owner.id, PRESETS.recruiter.view, BASE)!;
  check("the public view shows work and location but not email or phone", pub.contact.some((c) => c.kind === "location") && !pub.contact.some((c) => c.kind === "email" || c.kind === "phone"));
  check("the recruiter view adds email and phone", rec.contact.some((c) => c.kind === "email") && rec.contact.some((c) => c.kind === "phone"));
  check("a link with an unsafe address in it is left out", !rec.contact.some((c) => (c.href ?? "").startsWith("javascript:")) && rec.contact.some((c) => c.kind === "link" && c.href === "https://example.test/"));
  const jobs = rec.sections.find((s) => s.key === "experience")?.items ?? [];
  check("an entry the owner hid never appears, in any view", jobs.length === 1 && jobs[0].title === "Shown job" && !JSON.stringify(buildCv(owner.id, PRESETS.full.view, BASE)).includes("Secret Co"));
  check("a section the view switches off is not in the document", (() => { const v = structuredClone(PRESETS.recruiter.view); v.sections.experience = false; return !buildCv(owner.id, v, BASE)!.sections.some((s) => s.key === "experience"); })());
  check("the career goal appears only when the view allows it", !rec.sections.some((s) => s.key === "goal"));
  check("someone who has left has no CV", buildCv(gone.id, PRESETS.full.view, BASE) === null && buildCv(999999999, PRESETS.full.view, BASE) === null);
  check("the PDF is drawn from the same document", (await PDFDocument.load(await renderPdf(rec))).getPageCount() >= 1);

  // certificates and quotes need a track
  if (!track) console.log("skip certificate and quote checks (needs a track)");
  else {
    const cert = (code: string, extra: Partial<typeof certificates.$inferInsert> = {}) => { const c = db.insert(certificates).values({ userId: owner.id, trackId: track.id, level: 5, code, score: 0.9, ...extra }).returning().get(); certIds.push(c.id); return c; };
    const good = cert("CVTEST01"), revoked = cert("CVTEST02", { level: 6, revokedAt: t0 - 10 });
    const withCerts = buildCv(owner.id, PRESETS.full.view, BASE)!;
    const certItems = withCerts.sections.find((s) => s.key === "certificates")?.items ?? [];
    check("a certificate is shown with a link that proves it", certItems.some((i) => i.verify?.code === "CVTEST01" && i.verify.url === `${BASE}/cert/CVTEST01`));
    check("a revoked certificate is never shown", !certItems.some((i) => i.verify?.code === "CVTEST02") && revoked.revokedAt != null);
    db.update(cvProfiles).set({ hidden: JSON.stringify([`cert:${good.id}`]) }).where(eq(cvProfiles.userId, owner.id)).run();
    check("a certificate the owner hid is gone", !(buildCv(owner.id, PRESETS.full.view, BASE)!.sections.find((s) => s.key === "certificates")?.items ?? []).some((i) => i.verify?.code === "CVTEST01"));
    db.update(cvProfiles).set({ hidden: "[]" }).where(eq(cvProfiles.userId, owner.id)).run();

    const q = db.select().from(questions).get();
    if (!q) console.log("skip quote checks (needs a question)");
    else {
      const run = db.insert(runs).values({ userId: owner.id, trackId: q.trackId, level: 1, score: 0.7, passed: false, finishedAt: t0 }).returning().get(); runIds.push(run.id);
      const ans = db.insert(answers).values({ runId: run.id, questionId: q.id, response: "a", score: 0.7 }).returning().get();
      const note = (quotable: boolean, kind: "praise" | "suggestion" = "praise") => { const n = db.insert(answerNotes).values({ answerId: ans.id, runId: run.id, learnerId: owner.id, authorId: other.id, kind, body: `Well reasoned, ${quotable ? "quote" : "private"}`, quotable }).returning().get(); noteIds.push(n.id); return n; };
      const yes = note(true), no = note(false);
      db.insert(cvQuotes).values([{ userId: owner.id, noteId: yes.id }, { userId: owner.id, noteId: no.id }]).run();
      const quotes = () => buildCv(owner.id, PRESETS.full.view, BASE)!.sections.find((s) => s.key === "quotes")?.items ?? [];
      check("only praise its author allowed to be quoted appears, with their name", quotes().length === 1 && quotes()[0].title.includes("quote") && (quotes()[0].subtitle ?? "").includes("T other"));
      db.update(answerNotes).set({ quotable: false }).where(eq(answerNotes.id, yes.id)).run();
      check("when the author withdraws permission it disappears from the CV", quotes().length === 0);
      db.update(answerNotes).set({ quotable: true, deletedAt: t0 }).where(eq(answerNotes.id, yes.id)).run();
      check("a note that was removed disappears from the CV", quotes().length === 0);
    }
  }
  check("the limit on live links is enforced", await (async () => {
    const o2 = person("many"); let last: { error: string } | { link: unknown } = { link: 1 };
    for (let i = 0; i <= LIMITS.activeLinks; i++) last = await createLink(o2.id, { kind: "private" });
    return "error" in last;
  })());
} finally {
  if (made.length) {
    if (noteIds.length) db.delete(cvQuotes).where(inArray(cvQuotes.noteId, noteIds)).run();
    db.delete(answerNotes).where(inArray(answerNotes.learnerId, made)).run();
    if (runIds.length) db.delete(answers).where(inArray(answers.runId, runIds)).run();
    if (runIds.length) db.delete(runs).where(inArray(runs.id, runIds)).run();
    if (certIds.length) db.delete(certificates).where(inArray(certificates.id, certIds)).run();
    db.delete(cvQuotes).where(inArray(cvQuotes.userId, made)).run();
    db.delete(cvLinks).where(inArray(cvLinks.userId, made)).run();
    db.delete(cvEntries).where(inArray(cvEntries.userId, made)).run();
    db.delete(cvProfiles).where(inArray(cvProfiles.userId, made)).run();
    db.delete(users).where(inArray(users.id, made)).run();
  }
  void and;
}
}

main().then(() => { console.log(fails ? `\n${fails} FAILED` : "\nall passed"); process.exit(fails ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
