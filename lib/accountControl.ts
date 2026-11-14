import { eq } from "drizzle-orm";
import { accountControls, db, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { allowed, hit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/securityLog";
import { isSuperAdmin } from "@/lib/superAdmin";

/**
 * What a super admin can do to one account besides setting a password: block it, and leave a message for the person.
 *
 *  - BLOCK: the person cannot use the platform until it is lifted. It is checked where a session is recognised (lib/auth.ts), so a password, an
 *    emailed link, single sign-on, a social sign-in or a contest link all end the same way; sessions they already have stop working on the next
 *    request. Nothing about their records changes (that is what offboarding is for): it is for a compromised or misused account, or a pause.
 *    They are told the reason, but only once they have proved who they are (the right password, or a valid session for that account).
 *  - MESSAGE: a note shown on every page until the person presses OK, and in their notifications. Plain text, with an "info" or "warning" tone.
 *
 * Only a super admin, never on themselves and never on another super admin (a super admin's account is only changed by themselves). Every change is
 * written to the security log under the super admin.
 */
type Res = { error?: string; done?: string };
type Actor = { id: number; email: string; role: string; status: string };
const now = () => Math.floor(Date.now() / 1000);

export const MESSAGE_MAX = 500, REASON_MIN = 8, REASON_MAX = 300, MESSAGE_MIN = 3;

export const controlOf = (userId: number) => db.select().from(accountControls).where(eq(accountControls.userId, userId)).get();
export const isBlocked = (userId: number) => controlOf(userId)?.blockedAt != null;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

/** Why this person may not block, unblock or message that account, or null when they may. */
export function whyNotControl(actor: Actor | null | undefined, targetId: number): string | null {
  if (!isSuperAdmin(actor)) return "Only a super admin can do this.";
  if (actor!.id === targetId) return "Use your own profile for your own account.";
  const t = db.select().from(users).where(eq(users.id, targetId)).get();
  if (!t) return "That person does not exist.";
  if (isSuperAdmin(t)) return "A super admin's account is only changed by themselves.";
  return null;
}

function guard(actor: Actor, targetId: number): string | null {
  const no = whyNotControl(actor, targetId);
  if (no) return no;
  const key = `acct-control:${actor.id}`;
  if (!allowed(key, 120)) return "That is a lot of changes in an hour. Please wait a little.";
  hit(key, 60 * 60 * 1000);
  return null;
}
const upsert = (userId: number, set: Partial<typeof accountControls.$inferInsert>) =>
  db.insert(accountControls).values({ userId, ...set, updatedAt: now() }).onConflictDoUpdate({ target: accountControls.userId, set: { ...set, updatedAt: now() } }).run();

export function blockAccount(actor: Actor, targetId: number, reason: unknown, ip = ""): Res {
  const no = guard(actor, targetId);
  if (no) return { error: no };
  const why = clean(reason, REASON_MAX + 1).replace(/\n+/g, " ");
  if (why.length < REASON_MIN) return { error: `Say why, in at least ${REASON_MIN} characters. The person is shown it when they try to sign in.` };
  if (why.length > REASON_MAX) return { error: `Keep it under ${REASON_MAX} characters.` };
  if (isBlocked(targetId)) return { error: "That account is already blocked." };
  upsert(targetId, { blockedAt: now(), blockReason: why, blockedBy: actor.id });
  recordSecurityEvent({ actorId: actor.id, targetId, action: "account_block", detail: why, ip });
  return { done: "Blocked. They can no longer use the platform, and any session they have stops working on its next request." };
}

export function unblockAccount(actor: Actor, targetId: number, ip = ""): Res {
  const no = guard(actor, targetId);
  if (no) return { error: no };
  if (!isBlocked(targetId)) return { error: "That account is not blocked." };
  upsert(targetId, { blockedAt: null, blockReason: "", blockedBy: null });
  recordSecurityEvent({ actorId: actor.id, targetId, action: "account_unblock", ip });
  notify(targetId, { key: `acct-unblocked:${targetId}:${now()}`, kind: "system", title: "Your account is available again", body: "You can use the platform as normal.", href: "/dashboard" });
  return { done: "Unblocked. They can sign in again." };
}

/** Puts a message in front of the person on every page until they press OK. A new message shows again even if they dismissed the last. */
export function setMessage(actor: Actor, targetId: number, text: unknown, tone: unknown, ip = ""): Res {
  const no = guard(actor, targetId);
  if (no) return { error: no };
  const m = clean(text, MESSAGE_MAX + 1);
  if (m.length < MESSAGE_MIN) return { error: `Write at least ${MESSAGE_MIN} characters.` };
  if (m.length > MESSAGE_MAX) return { error: `Keep it under ${MESSAGE_MAX} characters.` };
  const t = tone === "warning" ? "warning" : "info";
  upsert(targetId, { message: m, tone: t, messageAt: now(), messageBy: actor.id, dismissedAt: null });
  recordSecurityEvent({ actorId: actor.id, targetId, action: "account_message_set", detail: `${t}: ${m}`.slice(0, 400), ip });
  notify(targetId, { key: `acct-message:${targetId}:${now()}`, kind: "system", title: "A message from the administrators", body: m.length > 120 ? `${m.slice(0, 117)}…` : m, href: "/dashboard" });
  return { done: "Set. They will see it on every page until they press OK." };
}

export function clearMessage(actor: Actor, targetId: number, ip = ""): Res {
  const no = guard(actor, targetId);
  if (no) return { error: no };
  const c = controlOf(targetId);
  if (!c?.message) return { error: "There is no message to clear." };
  upsert(targetId, { message: "", messageAt: null, messageBy: null, dismissedAt: null });
  recordSecurityEvent({ actorId: actor.id, targetId, action: "account_message_clear", ip });
  return { done: "Cleared." };
}

/** The message this person should be shown now: set, and not yet dismissed. */
export function messageFor(userId: number): { text: string; tone: "info" | "warning" } | null {
  const c = controlOf(userId);
  if (!c || !c.message || (c.dismissedAt != null && c.messageAt != null && c.dismissedAt >= c.messageAt)) return null;
  return { text: c.message, tone: c.tone };
}

/** The person presses OK. */
export function dismissMessage(userId: number): void {
  if (controlOf(userId)?.message) upsert(userId, { dismissedAt: now() });
}
