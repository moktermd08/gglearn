/**
 * Checks blocking an account and leaving a message: npm run check:account (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows.
 * Run db:push first). Only a super admin, never on themselves or another super admin, the reason and the message are checked and kept, a message
 * can be dismissed and comes back when it is replaced, everything is logged under the super admin, and the block is enforced in the one place every
 * session is recognised, with the reason revealed only after the person has proved who they are.
 */
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { accountControls, db, notifications, securityLog, users } from "../lib/db";
import { blockAccount, clearMessage, controlOf, dismissMessage, isBlocked, messageFor, setMessage, unblockAccount, whyNotControl } from "../lib/accountControl";

process.env.SESSION_SECRET ??= "check-account-secret-0123456789abcdef";
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const ok = (r: { error?: string; done?: string }) => !!r.done && !r.error;
const bad = (r: { error?: string; done?: string }) => !!r.error && !r.done;
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

process.env.SUPER_ADMIN_EMAILS = "boss@acct.check,boss2@acct.check";
const made: number[] = [];
const person = (tag: string, role: "learner" | "manager" | "admin", extra: Partial<typeof users.$inferInsert> = {}) => {
  const u = db.insert(users).values({ email: `${tag}@acct.check`, name: `T ${tag}`, jobRole: "developer", role, ...extra }).returning().get();
  made.push(u.id);
  return u;
};
try {
  const boss = person("boss", "admin"), boss2 = person("boss2", "admin"), plain = person("plain", "admin"), target = person("target", "learner"), mgr = person("mgr", "manager");

  // who may
  check("a super admin may act on an ordinary person", whyNotControl(boss, target.id) === null);
  check("an ordinary admin, a manager and a learner may not", [whyNotControl(plain, target.id), whyNotControl(mgr, target.id), whyNotControl(target, mgr.id)].every((v) => v !== null));
  check("not on themselves, nor on another super admin", whyNotControl(boss, boss.id) !== null && whyNotControl(boss, boss2.id) !== null);
  check("not on someone who does not exist", whyNotControl(boss, 999999999) !== null);
  check("a super admin may act on a manager or an ordinary admin", whyNotControl(boss, mgr.id) === null && whyNotControl(boss, plain.id) === null);

  // blocking
  check("a non-super admin cannot block, and nothing is blocked", bad(blockAccount(plain, target.id, "A perfectly good reason")) && !isBlocked(target.id));
  check("a short reason is refused, and a very long one", bad(blockAccount(boss, target.id, "nope")) && bad(blockAccount(boss, target.id, "x".repeat(400))) && !isBlocked(target.id));
  check("a super admin blocks, with the reason kept", ok(blockAccount(boss, target.id, "Paused while we check a security concern", "1.2.3.4")) && isBlocked(target.id) && controlOf(target.id)!.blockReason.startsWith("Paused") && controlOf(target.id)!.blockedBy === boss.id);
  check("it is written to the security log under the super admin", !!db.select().from(securityLog).where(and(eq(securityLog.actorId, boss.id), eq(securityLog.targetId, target.id), eq(securityLog.action, "account_block"))).get());
  check("blocking twice is refused", bad(blockAccount(boss, target.id, "Another good reason here")));
  check("an ordinary admin cannot lift it", bad(unblockAccount(plain, target.id)) && isBlocked(target.id));
  check("a super admin lifts it, and the person is told", ok(unblockAccount(boss, target.id)) && !isBlocked(target.id) && controlOf(target.id)!.blockReason === "" && !!db.select().from(notifications).where(and(eq(notifications.userId, target.id), eq(notifications.title, "Your account is available again"))).get());
  check("lifting it twice is refused, and it is logged", bad(unblockAccount(boss, target.id)) && !!db.select().from(securityLog).where(and(eq(securityLog.targetId, target.id), eq(securityLog.action, "account_unblock"))).get());
  check("a block on someone else leaves the others alone", ok(blockAccount(boss, mgr.id, "A reason that is long enough")) && !isBlocked(target.id) && isBlocked(mgr.id));
  unblockAccount(boss, mgr.id);

  // messages
  check("a non-super admin cannot leave a message", bad(setMessage(plain, target.id, "Please read this", "info")) && messageFor(target.id) === null);
  check("a message that is too short or too long is refused", bad(setMessage(boss, target.id, "hi", "info")) && bad(setMessage(boss, target.id, "x".repeat(600), "info")));
  check("a super admin sets one, shown as information by default", ok(setMessage(boss, target.id, "Please finish your training by Friday.\n\n\n\nCall me if stuck.", "banana")) && messageFor(target.id)?.tone === "info" && messageFor(target.id)?.text === "Please finish your training by Friday.\n\nCall me if stuck.");
  check("the person is notified of it, and it is logged", !!db.select().from(notifications).where(and(eq(notifications.userId, target.id), eq(notifications.title, "A message from the administrators"))).get() && !!db.select().from(securityLog).where(and(eq(securityLog.targetId, target.id), eq(securityLog.action, "account_message_set"))).get());
  check("the person presses OK and it stops showing", (() => { dismissMessage(target.id); return messageFor(target.id) === null; })());
  check("a replaced message shows again, even after OK", (() => { const before = controlOf(target.id)!; db.update(accountControls).set({ messageAt: (before.messageAt ?? 0) - 5, dismissedAt: before.dismissedAt }).where(eq(accountControls.userId, target.id)).run(); return ok(setMessage(boss, target.id, "An important change", "warning")) && messageFor(target.id)?.tone === "warning" && messageFor(target.id)?.text === "An important change"; })());
  check("a super admin clears it, and clearing nothing is refused", ok(clearMessage(boss, target.id)) && messageFor(target.id) === null && bad(clearMessage(boss, target.id)));
  check("someone with no row has no message and is not blocked", messageFor(plain.id) === null && !isBlocked(plain.id));
  check("a message is plain text: nothing in it is kept as markup by the banner", !src("components/AccountMessage.tsx").includes("dangerouslySetInnerHTML"));

  // enforcement: the places that must stay true
  const auth = src("lib/auth.ts");
  check("a blocked account is never signed in: the check is where every session is recognised", /export async function realUser\(\)[\s\S]*?isBlocked\(user\.id\)/.test(auth) && auth.includes("async function sessionUser()"));
  check("the sign-in page tells a blocked person why, from a genuine session only", auth.includes("export async function blockedNotice()") && src("app/(site)/login/page.tsx").includes("await blockedNotice()"));
  const actions = src("app/actions.ts");
  const loginAt = actions.indexOf("export async function login("), body = actions.slice(loginAt, loginAt + 3500);
  check("password sign-in reveals a block only after the password is right", body.indexOf("verifyPassword(pw") > -1 && body.indexOf("controlOf(u.id)") > body.indexOf("verifyPassword(pw") && body.indexOf("controlOf(u.id)") > body.indexOf("return \"Wrong email or password.\""));
  check("no sign-in route sets up a session that outlives a block: every route ends in the same recogniser", actions.includes("startSession(") && !/isBlocked/.test(actions));
  const fn = (name: string) => { const i = actions.indexOf(`export async function ${name}(`); return i < 0 ? "" : actions.slice(i, i + 900); };
  check("nobody can reset a super admin's password or offboard them", fn("resetPassword").includes("isSuperAdmin(u)") && fn("offboard").includes("isSuperAdmin(u)"));
  check("the panel does not offer a password reset or offboarding for a super admin", src("app/(admin)/admin/people/page.tsx").includes("!isSuperAdmin(u) && (me.role"));
  const sa = src("app/super-actions.ts");
  check("block and message actions are the super admin's own acts, never through a view", /async function superAdminOnly[\s\S]*?refuseWhileViewingAs\(\)/.test(sa) && ["blockAccountAction", "unblockAccountAction", "setMessageAction", "clearMessageAction"].every((n) => sa.includes(`function ${n}(`)));
  check("the message is shown on the learner site and in the admin", src("app/(site)/layout.tsx").includes("<AccountMessage />") && src("app/(admin)/layout.tsx").includes("<AccountMessage />"));
} finally {
  if (made.length) {
    db.delete(securityLog).where(inArray(securityLog.targetId, made)).run();
    db.delete(securityLog).where(inArray(securityLog.actorId, made)).run();
    db.delete(notifications).where(inArray(notifications.userId, made)).run();
    db.delete(accountControls).where(inArray(accountControls.userId, made)).run();
    db.delete(users).where(inArray(users.id, made)).run();
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
