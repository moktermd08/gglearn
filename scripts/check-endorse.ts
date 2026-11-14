/**
 * Checks references (endorsements) on a CV: npm run check:endorse (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows; the
 * database parts need two companies, and are skipped on an empty database. Run db:push first).
 * Who may write one, that nothing reaches a reader until the person approves it, that an edit takes approval away, that a withdrawal is
 * immediate, and that what is said is plain text with no links.
 */
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { companies, cvEndorsements, cvProfiles, db, mentorships, notifications, userScopes, users } from "../lib/db";
import { buildCv } from "../lib/cv/build";
import { askable, approvedFor, cancelRequest, cleanEndorsement, decideEndorsement, relationshipOf, requestEndorsement, whyNotEndorse, withdrawEndorsement, writeEndorsement } from "../lib/cv/endorse";
import { renderPdf } from "../lib/cv/pdf";
import { ENDORSE, PRESETS } from "../lib/cv/types";

process.env.SESSION_SECRET ??= "check-endorse-secret-0123456789abcdef";
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const form = (o: Record<string, string | number>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, String(v)); return fd; };
const ok = (r: { error?: string; done?: string } | null) => !!r?.done && !r.error;
const bad = (r: { error?: string; done?: string } | null) => !!r?.error && !r.done;
const GOOD = "I managed them on the 2026 onboarding project. They rebuilt the new-starter checklist on their own initiative and new starters asked half as many questions afterwards.";
const BASE = "https://example.test";

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
check("every reference action refuses while viewing as someone", (src("app/cv-actions.ts").match(/const me = await owner\(\);/g) ?? []).length >= 15 && ["requestEndorsementAction", "decideEndorsementAction", "cancelRequestAction", "writeEndorsementAction", "withdrawEndorsementAction"].every((n) => src("app/cv-actions.ts").includes(`function ${n}(`)));
check("the author's page is a 404 unless the rule allows it", src("app/(site)/endorse/[id]/page.tsx").includes("whyNotEndorse(me, id) !== null") && src("app/(site)/endorse/[id]/page.tsx").includes("notFound()"));
check("only approved references can reach the CV builder", src("lib/cv/endorse.ts").includes("eq(cvEndorsements.status, \"approved\")") && src("lib/cv/build.ts").includes("approvedFor(userId)"));
check("text is tidied and cut", cleanEndorsement("  a   b\r\n\r\n\r\n\r\nc ", 50) === "a b\n\nc" && cleanEndorsement("x".repeat(900), 10).length === 10);

async function main() {
  const cos = db.select().from(companies).orderBy(companies.id).limit(2).all();
  if (cos.length < 2) { console.log("skip database checks (needs two companies)"); return; }
  const [A, B] = cos.map((c) => c.id);
  const made: number[] = [];
  const person = (tag: string, role: "learner" | "manager" | "admin", scope?: number, extra: Partial<typeof users.$inferInsert> = {}) => {
    const u = db.insert(users).values({ email: `t-${tag}@endorse.check`, name: `T ${tag}`, jobRole: "developer", role, ...extra }).returning().get();
    made.push(u.id);
    if (scope) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: scope }).run();
    return u;
  };
  try {
    const owner = person("owner", "learner", A), mgr = person("mgr", "manager", A), adminA = person("adminA", "admin", A), mgrB = person("mgrB", "manager", B);
    const mentor = person("mentor", "learner"), parent = person("parent", "learner"), stranger = person("stranger", "learner"), gone = person("gone", "learner", A, { status: "offboarded" });
    const boss = person("boss", "admin"); // runs everyone (no scopes)
    db.insert(mentorships).values([{ mentorId: mentor.id, menteeId: owner.id, kind: "mentor" }, { mentorId: parent.id, menteeId: owner.id, kind: "parent" }]).run();
    const as = (u: { id: number; role: string }) => ({ id: u.id, role: u.role });

    // who may write one
    check("a manager who runs them is a manager to them", relationshipOf(as(mgr), owner.id) === "manager" && whyNotEndorse(as(mgr), owner.id) === null);
    check("an admin who runs them too", relationshipOf(as(adminA), owner.id) === "manager");
    check("a mentor they chose is a mentor to them", relationshipOf(as(mentor), owner.id) === "mentor" && whyNotEndorse(as(mentor), owner.id) === null);
    check("a manager of another company may not", whyNotEndorse(as(mgrB), owner.id) !== null);
    check("a parent may not, nor a stranger, nor the person themselves", [whyNotEndorse(as(parent), owner.id), whyNotEndorse(as(stranger), owner.id), whyNotEndorse(as(owner), owner.id)].every((v) => v !== null));
    check("not for someone who has left, or does not exist", whyNotEndorse(as(mgr), gone.id) !== null && whyNotEndorse(as(mgr), 999999999) !== null);
    db.insert(mentorships).values({ mentorId: mgr.id, menteeId: owner.id, kind: "mentor" }).run();
    check("someone who is both a manager and a mentor is shown as a manager", relationshipOf(as(mgr), owner.id) === "manager");

    // what they may say
    const mk = (body: string, context = "") => writeEndorsement(as(mgr), owner.id, form({ body, context }));
    check("a reference that is too short is refused", bad(mk("Good worker.")));
    check("one that is too long is refused", bad(mk("word ".repeat(300))) && ENDORSE.max === 800);
    check("a web address or an email address is refused, in the text or the context", bad(mk(`${GOOD} See https://example.test/me`)) && bad(mk(`${GOOD} Email me at a@b.co`)) && bad(mk(GOOD, "visit www.example.test")));
    check("a context that is too long is refused", bad(mk(GOOD, "x".repeat(200))));
    check("nothing was saved by a refused one", !db.select().from(cvEndorsements).where(eq(cvEndorsements.userId, owner.id)).get());

    // asking
    check("the person cannot ask someone who is not their manager or mentor", bad(requestEndorsement(as(owner), stranger.id)) && bad(requestEndorsement(as(owner), parent.id)) && bad(requestEndorsement(as(owner), mgrB.id)));
    check("they ask a manager, who is told", ok(requestEndorsement(as(owner), mgr.id)) && !!db.select().from(notifications).where(and(eq(notifications.userId, mgr.id), eq(notifications.href, `/endorse/${owner.id}`))).get());
    check("asking twice is refused, and a request shows nothing on the CV", bad(requestEndorsement(as(owner), mgr.id)) && approvedFor(owner.id).length === 0);
    const e1 = () => db.select().from(cvEndorsements).where(and(eq(cvEndorsements.userId, owner.id), eq(cvEndorsements.authorId, mgr.id))).get()!;
    check("they can cancel a request before anything is written", ok(requestEndorsement(as(owner), mentor.id)) && ok(cancelRequest(as(owner), db.select().from(cvEndorsements).where(eq(cvEndorsements.authorId, mentor.id)).get()!.id)) && !db.select().from(cvEndorsements).where(eq(cvEndorsements.authorId, mentor.id)).get());

    // writing, and the consent chain
    check("the author writes it, and it is pending, with the relationship the platform worked out", ok(mk(GOOD, "Managed them on onboarding")) && e1().status === "pending" && e1().relationship === "manager");
    check("the person is told", !!db.select().from(notifications).where(and(eq(notifications.userId, owner.id), eq(notifications.href, "/profile/cv#endorsements"))).get());
    const cv = () => buildCv(owner.id, PRESETS.full.view, BASE)!.sections.find((s) => s.key === "endorsements")?.items ?? [];
    check("a pending reference is not on the CV in any view", cv().length === 0 && !JSON.stringify(buildCv(owner.id, PRESETS.full.view, BASE)).includes("onboarding checklist"));
    check("only the person can approve it", bad(decideEndorsement(as(stranger), e1().id, true)) && bad(decideEndorsement(as(mgr), e1().id, true)) && e1().status === "pending");
    check("they approve it, and it appears with the author's name and relationship", ok(decideEndorsement(as(owner), e1().id, true)) && cv().length === 1 && cv()[0].title === "T mgr · Manager" && (cv()[0].body ?? []).join(" ").includes("checklist"));
    check("it shows in a view that allows references and not in one that does not", (() => { const v = structuredClone(PRESETS.full.view); v.sections.endorsements = false; return !buildCv(owner.id, v, BASE)!.sections.some((s) => s.key === "endorsements"); })());
    check("approving twice, or something not pending, is refused", bad(decideEndorsement(as(owner), e1().id, true)));
    check("the person can hide it without removing it", (() => { db.insert(cvProfiles).values({ userId: owner.id, hidden: JSON.stringify([`endorsement:${e1().id}`]) }).onConflictDoUpdate({ target: cvProfiles.userId, set: { hidden: JSON.stringify([`endorsement:${e1().id}`]) } }).run(); const r = cv().length === 0; db.update(cvProfiles).set({ hidden: "[]" }).where(eq(cvProfiles.userId, owner.id)).run(); return r && cv().length === 1; })());
    check("editing an approved reference takes approval away at once", ok(mk(`${GOOD} They also trained two new starters.`)) && e1().status === "pending" && cv().length === 0);
    check("approving again puts it back", ok(decideEndorsement(as(owner), e1().id, true)) && cv().length === 1 && cv()[0].body!.join(" ").includes("trained two"));
    check("the author is told when it is approved", !!db.select().from(notifications).where(and(eq(notifications.userId, mgr.id), eq(notifications.title, "T owner will show your reference on their CV"))).get());
    check("someone else cannot withdraw it, and the person cannot use the author's withdraw", bad(withdrawEndorsement(as(stranger), e1().id)) && bad(withdrawEndorsement(as(owner), e1().id)) && cv().length === 1);
    check("the author withdraws it and it leaves the CV at once", ok(withdrawEndorsement(as(mgr), e1().id)) && e1().status === "withdrawn" && cv().length === 0);
    check("they can write a new one after withdrawing", ok(mk(GOOD)) && e1().status === "pending");

    // declining and asking again
    check("the person declines it, and it appears nowhere", ok(decideEndorsement(as(owner), e1().id, false)) && e1().status === "declined" && cv().length === 0);
    check("the author cannot rewrite one the person declined", bad(mk(GOOD)) && e1().status === "declined");
    check("the person cannot ask the same author again straight away", bad(requestEndorsement(as(owner), mgr.id)));
    db.update(cvEndorsements).set({ decidedAt: Math.floor(Date.now() / 1000) - 31 * 86400 }).where(eq(cvEndorsements.id, e1().id)).run();
    check("but can after the waiting time", ok(requestEndorsement(as(owner), mgr.id)) && e1().status === "requested");

    // a mentor, offered unprompted
    check("a mentor offers one unprompted, and it is labelled a mentor", ok(writeEndorsement(as(mentor), owner.id, form({ body: GOOD }))) && db.select().from(cvEndorsements).where(eq(cvEndorsements.authorId, mentor.id)).get()!.relationship === "mentor");
    const mentorRow = () => db.select().from(cvEndorsements).where(eq(cvEndorsements.authorId, mentor.id)).get()!;
    decideEndorsement(as(owner), mentorRow().id, true);
    check("an author who has left no longer appears", (() => { const before = cv().length; db.update(users).set({ status: "offboarded" }).where(eq(users.id, mentor.id)).run(); const r = cv().length === before - 1; db.update(users).set({ status: "active" }).where(eq(users.id, mentor.id)).run(); return r; })());

    // how many show
    check("no more than the limit are shown, newest first", (() => {
      const extra = Array.from({ length: 7 }, (_, i) => person(`x${i}`, "manager", A));
      for (const a of extra) { db.insert(cvEndorsements).values({ userId: owner.id, authorId: a.id, status: "approved", relationship: "manager", body: GOOD, decidedAt: Math.floor(Date.now() / 1000) + 10 }).run(); }
      return cv().length === ENDORSE.shown;
    })());

    // who can be asked
    const names = askable(as(owner)).map((a) => a.id);
    check("the people they can ask are their mentors and the managers who run them", names.includes(mgr.id) && names.includes(mentor.id) && names.includes(adminA.id));
    check("not a parent, a stranger, another company's manager, or someone who runs everyone", ![parent.id, stranger.id, mgrB.id, boss.id, owner.id].some((i) => names.includes(i)));

    // the PDF carries it
    check("the PDF carries an approved reference", (await PDFDocument.load(await renderPdf(buildCv(owner.id, PRESETS.full.view, BASE) as never))).getPageCount() >= 1);
  } finally {
    if (made.length) {
      db.delete(notifications).where(inArray(notifications.userId, made)).run();
      db.delete(cvEndorsements).where(inArray(cvEndorsements.userId, made)).run();
      db.delete(cvEndorsements).where(inArray(cvEndorsements.authorId, made)).run();
      db.delete(cvProfiles).where(inArray(cvProfiles.userId, made)).run();
      db.delete(mentorships).where(inArray(mentorships.menteeId, made)).run();
      db.delete(userScopes).where(inArray(userScopes.userId, made)).run();
      db.delete(users).where(inArray(users.id, made)).run();
    }
  }
}

main().then(() => { console.log(fails ? `\n${fails} FAILED` : "\nall passed"); process.exit(fails ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
