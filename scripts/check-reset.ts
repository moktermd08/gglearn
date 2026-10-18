/** Checks password reset by email: npm run check:reset (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { db, passwordResets, users } from "../lib/db";
import { finishReset, findOpenReset, RESET_TTL_SEC, startReset } from "../lib/passwordReset";
import { hashPassword, verifyPassword } from "../lib/password";
import { passwordChangedMail, resetMail } from "../lib/mail";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@reset.check")).all().map((r) => r.id);
  if (!us.length) return;
  db.delete(passwordResets).where(inArray(passwordResets.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run();
};

async function main() {
  sweep();
  try {
    const oldHash = await hashPassword("old-password-1");
    const mk = (n: string, status: "active" | "offboarded" = "active") => db.insert(users).values({ name: `${n} Tester`, email: `${n}@reset.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: oldHash, status }).returning().get();
    const ana = mk("ana"), gone = mk("gone", "offboarded"), ben = mk("ben");

    check("an unknown address gets no link", startReset("nobody@reset.check") === null);
    check("someone who has left gets no link", startReset(gone.email) === null);
    check("a malformed address gets none", ["", "   ", "not an email", "'; drop table users; --"].every((e) => startReset(e) === null));
    const r = startReset("  ANA@reset.check ")!;
    check("an active account gets a link, whatever the case or spaces", !!r && r.userId === ana.id && r.token.length >= 20);
    const row = db.select().from(passwordResets).where(eq(passwordResets.userId, ana.id)).get()!;
    check("only a hash of the token is stored, never the token", row.tokenHash !== r.token && !JSON.stringify(row).includes(r.token) && row.tokenHash.length === 64);
    check("the link lasts an hour", row.expiresAt - row.createdAt === RESET_TTL_SEC && row.usedAt === null);
    check("it is open until used", findOpenReset(r.token)?.userId === ana.id);

    const r2 = startReset(ana.email)!;
    check("asking again cancels the earlier link", findOpenReset(r.token) === null && findOpenReset(r2.token)?.userId === ana.id);
    check("junk tokens are never open", ["", "x", "../..", "a".repeat(100), r2.token.slice(1), `${r2.token}x`].every((t) => findOpenReset(t) === null));

    const newHash = await hashPassword("brand-new-password-2");
    const who = finishReset(r2.token, newHash);
    check("a good link sets the password for that person", who === ana.id && (await verifyPassword("brand-new-password-2", db.select().from(users).where(eq(users.id, ana.id)).get()!.passwordHash)));
    check("...and the old password no longer works", !(await verifyPassword("old-password-1", db.select().from(users).where(eq(users.id, ana.id)).get()!.passwordHash)));
    check("...and every other device is signed out", db.select().from(users).where(eq(users.id, ana.id)).get()!.sessionVersion === ana.sessionVersion + 1);
    check("...and the link is spent", finishReset(r2.token, await hashPassword("another-password-3")) === null && findOpenReset(r2.token) === null);
    check("the second use changed nothing", await verifyPassword("brand-new-password-2", db.select().from(users).where(eq(users.id, ana.id)).get()!.passwordHash));
    check("someone else's account was untouched", (await verifyPassword("old-password-1", db.select().from(users).where(eq(users.id, ben.id)).get()!.passwordHash)) && db.select().from(users).where(eq(users.id, ben.id)).get()!.sessionVersion === ben.sessionVersion);

    const b = startReset(ben.email)!;
    db.update(passwordResets).set({ expiresAt: Math.floor(Date.now() / 1000) - 1 }).where(eq(passwordResets.userId, ben.id)).run();
    check("an expired link is refused", findOpenReset(b.token) === null && finishReset(b.token, newHash) === null);
    const c = startReset(ben.email)!;
    db.update(users).set({ status: "offboarded" }).where(eq(users.id, ben.id)).run();
    check("a link for an account that has since been closed is refused", findOpenReset(c.token) === null && finishReset(c.token, newHash) === null);
    check("each person's links are separate", (() => { db.update(users).set({ status: "active" }).where(eq(users.id, ben.id)).run(); const a2 = startReset(ana.email)!, b2 = startReset(ben.email)!; return findOpenReset(a2.token)?.userId === ana.id && findOpenReset(b2.token)?.userId === ben.id; })());

    // the emails
    const m = resetMail("ana@x.test", "https://x.test/reset/abc", 60, "Moksy <Academy>");
    check("the reset email carries the link, the time limit and what to do if it was not them", m.text.includes("https://x.test/reset/abc") && /60 minutes/.test(m.text) && /ignore this email/.test(m.text) && m.html.includes("https://x.test/reset/abc"));
    check("a name that looks like HTML is escaped in the email", !m.html.includes("<Academy>") && m.html.includes("&lt;Academy&gt;"));
    const pc = passwordChangedMail("ana@x.test", "https://x.test/forgot");
    check("the change notice says what happened and how to undo it", /was just changed/.test(pc.text) && pc.text.includes("https://x.test/forgot") && /signed out everywhere/.test(pc.text));
  } finally {
    sweep();
  }
  check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@reset.check")).all().length === 0);
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
}
main();
