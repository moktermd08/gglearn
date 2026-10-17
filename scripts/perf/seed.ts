/**
 * Fills a database with a large synthetic academy so the hot paths can be timed: npm run perf:seed
 * Refuses to run unless DATABASE_FILE points somewhere other than data/gglearn.db. Adds COMPANIES companies of PEOPLE people each
 * (one admin, one manager, the rest learners), each with enrolments, exam runs, certificates, notifications and a checklist.
 */
import path from "node:path";
import { db, brands, certificates, checklistItems, companies, enrollments, notifications, projects, runs, tracks, userScopes, users } from "../../lib/db";
import { signatureOf } from "../../lib/certs";

const file = process.env.DATABASE_FILE ?? "";
if (!file || path.resolve(file) === path.resolve(process.cwd(), "data", "gglearn.db")) {
  console.error("Set DATABASE_FILE to a scratch copy; this adds thousands of rows and must never touch the real database.");
  process.exit(1);
}
const COMPANIES = Number(process.env.PERF_COMPANIES ?? 20), PEOPLE = Number(process.env.PERF_PEOPLE ?? 500);
const now = Math.floor(Date.now() / 1000), DAY = 86400;
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
const ROLES = ["developer", "frontend developer", "designer", "support", "sales", "general"];

const allTracks = db.select().from(tracks).all();
db.transaction((tx) => {
  for (let c = 0; c < COMPANIES; c++) {
    const co = tx.insert(companies).values({ slug: `perf-co-${c}`, name: `Perf Company ${c}`, certValidMonths: 12, certSigner: "P. Signer" }).returning().get();
    const br = tx.insert(brands).values({ slug: `perf-brand-${c}`, name: `Perf Brand ${c}`, companyId: co.id, kind: "company" }).returning().get();
    tx.insert(projects).values({ slug: `perf-proj-${c}`, name: `Perf Project ${c}`, brandId: br.id, companyId: co.id }).run();
    const people = Array.from({ length: PEOPLE }, (_, i) => ({
      email: `perf-${c}-${i}@perf.local`, name: `Person ${c}-${i}`, passwordHash: "x", role: (i === 0 ? "admin" : i === 1 ? "manager" : "learner") as "admin" | "manager" | "learner",
      jobRole: pick(ROLES), createdAt: now - Math.floor(rnd() * 400) * DAY,
    }));
    const ids: number[] = [];
    for (const part of chunk(people, 500)) for (const u of tx.insert(users).values(part).returning({ id: users.id }).all()) ids.push(u.id);
    for (const part of chunk(ids, 2000)) tx.insert(userScopes).values(part.map((userId) => ({ userId, kind: "company" as const, refId: co.id }))).run();
    const enr: (typeof enrollments.$inferInsert)[] = [], rn: (typeof runs.$inferInsert)[] = [], notes: (typeof notifications.$inferInsert)[] = [], items: (typeof checklistItems.$inferInsert)[] = [];
    for (const userId of ids) {
      const mine = Array.from({ length: 14 }, () => pick(allTracks));
      for (const t of new Set(mine)) {
        enr.push({ userId, trackId: t.id, startedAt: now - Math.floor(rnd() * 200) * DAY });
        const passed = Math.floor(rnd() * 7);
        for (let l = 1; l <= passed; l++) rn.push({ userId, trackId: t.id, level: l, score: 0.85, passed: true, startedAt: now - 3600 * l, finishedAt: now - 3000 * l });
      }
      for (let n = 0; n < 5; n++) notes.push({ userId, key: `perf-${n}`, kind: "system", title: "Note", body: "x", readAt: n < 3 ? now : null });
      for (let n = 0; n < 6; n++) items.push({ userId, kind: "onboarding", label: `Step ${n}`, done: rnd() < 0.5 });
    }
    for (const part of chunk(enr, 2000)) tx.insert(enrollments).values(part).run();
    for (const part of chunk(rn, 1500)) tx.insert(runs).values(part).run();
    for (const part of chunk(notes, 2500)) tx.insert(notifications).values(part).run();
    for (const part of chunk(items, 2500)) tx.insert(checklistItems).values(part).run();
    const certs = ids.flatMap((userId, i) => [5, 10].map((level) => {
      const row = { userId, trackId: pick(allTracks).id, level, score: 0.9, code: `P${c}X${i}L${level}`.padEnd(10, "0"), issuedAt: now - 100 * DAY, expiresAt: now + Math.floor((rnd() * 140 - 40)) * DAY, renewedAt: null, signer: "P. Signer", signerTitle: "" };
      return { ...row, signature: signatureOf(row) };
    }));
    for (const part of chunk(certs, 1500)) tx.insert(certificates).values(part).onConflictDoNothing().run();
    console.log(`company ${c + 1}/${COMPANIES}`);
  }
});
console.log("users", db.select().from(users).all().length);
