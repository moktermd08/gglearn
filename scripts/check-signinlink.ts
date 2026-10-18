/** Checks sign-in links (passwordless): npm run check:signinlink (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { db, loginLinks, users } from "../lib/db";
import { LOGIN_LINK_TTL_SEC, peekLoginLink, spendLoginLink, startLoginLink } from "../lib/loginLink";
import { signInLinkMail } from "../lib/mail";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@signin.check")).all().map((r) => r.id);
  if (!us.length) return;
  db.delete(loginLinks).where(inArray(loginLinks.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
try {
  const mk = (n: string, status: "active" | "offboarded" = "active") => db.insert(users).values({ name: `${n[0].toUpperCase()}${n.slice(1)} Tester`, email: `${n}@signin.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "keep-me", status }).returning().get();
  const ana = mk("ana"), gone = mk("gone", "offboarded"), ben = mk("ben");

  check("an unknown address gets no link", startLoginLink("nobody@signin.check") === null);
  check("someone who has left gets none", startLoginLink(gone.email) === null);
  check("junk gets none", ["", "  ", "not an email", "x' or '1'='1"].every((e) => startLoginLink(e) === null));
  const a = startLoginLink("  ANA@signin.check ")!;
  check("an active account gets a link, whatever the case or spaces", !!a && a.userId === ana.id);
  const row = db.select().from(loginLinks).where(eq(loginLinks.userId, ana.id)).get()!;
  check("only a hash is stored", row.tokenHash !== a.token && row.tokenHash.length === 64 && !JSON.stringify(row).includes(a.token));
  check("the link lasts fifteen minutes", row.expiresAt - row.createdAt === LOGIN_LINK_TTL_SEC && LOGIN_LINK_TTL_SEC === 900);

  const seen = peekLoginLink(a.token);
  check("looking at a link tells whose it is, first name only", seen?.userId === ana.id && seen.firstName === "Ana");
  peekLoginLink(a.token); peekLoginLink(a.token);
  check("looking, however many times (a mail scanner does), never uses it up", peekLoginLink(a.token) !== null && db.select().from(loginLinks).where(eq(loginLinks.userId, ana.id)).get()!.usedAt === null);

  const a2 = startLoginLink(ana.email)!;
  check("asking again cancels the earlier link", peekLoginLink(a.token) === null && peekLoginLink(a2.token)?.userId === ana.id);
  check("junk tokens are never open", ["", "x", "../..", "a".repeat(100), a2.token.slice(1), `${a2.token}x`].every((t) => peekLoginLink(t) === null && spendLoginLink(t) === null));

  const sv = db.select().from(users).where(eq(users.id, ana.id)).get()!.sessionVersion;
  check("pressing the button spends it and says who to sign in", spendLoginLink(a2.token) === ana.id);
  check("a link works once", spendLoginLink(a2.token) === null && peekLoginLink(a2.token) === null);
  const after = db.select().from(users).where(eq(users.id, ana.id)).get()!;
  check("signing in this way leaves the password and other sessions alone", after.passwordHash === "keep-me" && after.sessionVersion === sv);
  check("someone else's account is untouched", db.select().from(users).where(eq(users.id, ben.id)).get()!.passwordHash === "keep-me");

  const b = startLoginLink(ben.email)!;
  db.update(loginLinks).set({ expiresAt: Math.floor(Date.now() / 1000) - 1 }).where(eq(loginLinks.userId, ben.id)).run();
  check("an expired link is refused", peekLoginLink(b.token) === null && spendLoginLink(b.token) === null);
  const c = startLoginLink(ben.email)!;
  db.update(users).set({ status: "offboarded" }).where(eq(users.id, ben.id)).run();
  check("a link for an account that has since been closed is refused", peekLoginLink(c.token) === null && spendLoginLink(c.token) === null);

  const m = signInLinkMail("ana@x.test", "https://x.test/signin/abc", 15, "Moksy <Academy>");
  check("the email has the link, the time limit and what to do if it was not them", m.text.includes("https://x.test/signin/abc") && /15 minutes/.test(m.text) && /ignore this email/.test(m.text) && m.html.includes("https://x.test/signin/abc"));
  check("it tells the reader to press a button, not that opening it signs them in", /press the button/.test(m.text));
  check("a name that looks like HTML is escaped", !m.html.includes("<Academy>") && m.html.includes("&lt;Academy&gt;"));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@signin.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
