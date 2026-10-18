import { MINUTE, allowed, hit } from "@/lib/rate-limit";

/**
 * Sending email, through Resend (the same provider and the same two settings pattern as ggsocial). It does nothing unless both are set:
 *   RESEND_API_KEY  an API key from resend.com
 *   MAIL_FROM       the sender, on a domain verified in Resend, e.g. "gglearn <gglearn@your-domain>"
 * RESEND_API_URL is optional and only for testing against a stand-in service; leave it unset in production.
 * Without them nothing is sent and every screen falls back to what it did before (copy the link, or Open in email).
 * A send never throws: the caller gets { ok: false, error } and the person is told to use the link instead.
 */
export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string; headers?: Record<string, string> };
export type SendResult = { ok: true; id: string } | { ok: false; error: string };
type Fetch = typeof fetch;

export const mailConfigured = (env = process.env) => !!env.RESEND_API_KEY?.trim() && !!env.MAIL_FROM?.trim();

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One email. `key` makes a repeat of the same send (a retry, a double click) arrive once. */
export async function sendMail(m: Mail, opts: { key?: string; env?: NodeJS.ProcessEnv; fetchImpl?: Fetch } = {}): Promise<SendResult> {
  const env = opts.env ?? process.env;
  if (!mailConfigured(env)) return { ok: false, error: "Email is not set up on this server." };
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${(env.RESEND_API_URL?.trim() || "https://api.resend.com").replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(opts.key ? { "Idempotency-Key": opts.key } : {}) },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html, ...(m.replyTo ? { reply_to: m.replyTo } : {}), ...(m.headers ? { headers: m.headers } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok && body.id) return { ok: true, id: String(body.id) };
    // Resend's own message (for example an unverified sending domain) helps whoever fixes it; the key is never part of it
    return { ok: false, error: String(body.message ?? `The mail service answered ${res.status}.`).slice(0, 200) };
  } catch {
    return { ok: false, error: "The mail service could not be reached." };
  }
}

export type InviteMail = { to: string; link: string; from: string; where: string; role: string; access: string; replyTo?: string };

/** The invitation, as plain text and as HTML. Every name that came from a person is escaped. */
export function inviteMail(i: InviteMail): Mail {
  const sentence = `${i.from} has invited you to join ${i.where} on gglearn as ${i.role}${i.access === "learner" ? "" : ` (with ${i.access} access)`}.`;
  const text = `Hi,\n\n${sentence}\n\nCreate your account here (the link works once and expires in 7 days):\n${i.link}\n\nIf you were not expecting this, you can ignore it.`;
  const link = escapeHtml(i.link);
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5">
<p>Hi,</p><p>${escapeHtml(sentence)}</p>
<p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Create your account</a></p>
<p style="font-size:13px;color:#6b7280">The link works once and expires in 7 days. If the button does not work, copy this address into your browser:<br>${link}</p>
<p style="font-size:13px;color:#6b7280">If you were not expecting this, you can ignore it.</p></div>`;
  return { to: i.to, subject: `${i.from} invited you to gglearn`, text, html, replyTo: i.replyTo };
}

const BUTTON = "display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600";
const wrap = (inner: string) => `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5">${inner}</div>`;

/** The password-reset email: one button, one hour, and what to do if it was not them. */
export function resetMail(to: string, link: string, minutes: number, academy = "gglearn"): Mail {
  const text = `Hi,\n\nSomeone asked to reset the password for your ${academy} account. If that was you, choose a new one here (the link works once and expires in ${minutes} minutes):\n${link}\n\nIf it was not you, ignore this email: your password stays as it is.`;
  const l = escapeHtml(link);
  return { to, subject: `Reset your ${academy} password`, text, html: wrap(`<p>Hi,</p><p>Someone asked to reset the password for your ${escapeHtml(academy)} account. If that was you, choose a new one:</p>
<p><a href="${l}" style="${BUTTON}">Choose a new password</a></p>
<p style="font-size:13px;color:#6b7280">The link works once and expires in ${minutes} minutes. If the button does not work, copy this address into your browser:<br>${l}</p>
<p style="font-size:13px;color:#6b7280">If it was not you, ignore this email: your password stays as it is.</p>`) };
}

/** The sign-in link email: one button, fifteen minutes, and what to do if it was not them. */
export function signInLinkMail(to: string, link: string, minutes: number, academy = "gglearn"): Mail {
  const text = `Hi,\n\nHere is your sign-in link for ${academy}. Open it and press the button to sign in (it works once and expires in ${minutes} minutes):\n${link}\n\nIf you did not ask for this, ignore this email: nobody can sign in without it.`;
  const l = escapeHtml(link);
  return { to, subject: `Your ${academy} sign-in link`, text, html: wrap(`<p>Hi,</p><p>Here is your sign-in link for ${escapeHtml(academy)}. Open it and press the button to sign in:</p>
<p><a href="${l}" style="${BUTTON}">Open my sign-in page</a></p>
<p style="font-size:13px;color:#6b7280">It works once and expires in ${minutes} minutes. If the button does not work, copy this address into your browser:<br>${l}</p>
<p style="font-size:13px;color:#6b7280">If you did not ask for this, ignore this email: nobody can sign in without it.</p>`) };
}

/** The notice after a password has been changed by a reset, so the real owner finds out if it was not them. */
export function passwordChangedMail(to: string, loginLink: string, academy = "gglearn"): Mail {
  const text = `Hi,\n\nThe password for your ${academy} account was just changed, and you were signed out everywhere else.\n\nIf that was you, there is nothing to do. If it was not, reset it again straight away and tell whoever runs your team:\n${loginLink}`;
  const l = escapeHtml(loginLink);
  return { to, subject: `Your ${academy} password was changed`, text, html: wrap(`<p>Hi,</p><p>The password for your ${escapeHtml(academy)} account was just changed, and you were signed out everywhere else.</p>
<p>If that was you, there is nothing to do. If it was not, reset it again straight away and tell whoever runs your team:</p><p><a href="${l}" style="${BUTTON}">Reset it again</a></p>`) };
}

export const MAX_MAILS_PER_HOUR = 100;
export const MAX_CONTEST_MAILS_PER_DAY = 50;

type Batch = { sent: string[]; failed: { email: string; error: string }[] };

/** Sends each mail in turn under one person's limit for a window. One failure never stops the rest; the result says who got one and who did not, with a reason. */
async function sendBatch(bucket: string, limit: number, windowMs: number, tooMany: string, mails: (Mail & { key?: string })[], fetchImpl?: Fetch): Promise<Batch> {
  const sent: string[] = [], failed: Batch["failed"] = [];
  for (const m of mails) {
    if (!allowed(bucket, limit)) { failed.push({ email: m.to, error: tooMany }); continue; }
    hit(bucket, windowMs);
    const r = await sendMail(m, { key: m.key, fetchImpl });
    if (r.ok) sent.push(m.to); else failed.push({ email: m.to, error: r.error });
  }
  return { sent, failed };
}

/** Emails a batch of account invitations on behalf of one person, with a limit per person per hour. */
export const sendInvites = (by: number, mails: (InviteMail & { key?: string })[], fetchImpl?: Fetch) =>
  sendBatch(`mail-invite:${by}`, MAX_MAILS_PER_HOUR, 60 * MINUTE, "Too many emails this hour. Use the link instead.", mails.map((m) => ({ ...inviteMail(m), key: m.key })), fetchImpl);

export type ContestMail = { to: string; link: string; from: string; title: string; topic: string; replyTo?: string };

/** The note to someone who already has an account, telling them a race is waiting. Every name that came from a person is escaped. */
export function contestInviteMail(i: ContestMail): Mail {
  const sentence = `${i.from} invited you to the race "${i.title}" on ${i.topic}.`;
  const text = `Hi,\n\n${sentence}\n\nOpen it to accept or say no thanks:\n${i.link}\n\nIf you were not expecting this, you can ignore it.`;
  const link = escapeHtml(i.link);
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5">
<p>Hi,</p><p>${escapeHtml(sentence)}</p>
<p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">See the invitation</a></p>
<p style="font-size:13px;color:#6b7280">If the button does not work, copy this address into your browser:<br>${link}</p>
<p style="font-size:13px;color:#6b7280">If you were not expecting this, you can ignore it.</p></div>`;
  return { to: i.to, subject: `${i.from} invited you to a race on gglearn`, text, html, replyTo: i.replyTo };
}

/** Emails race invitations on behalf of one organiser, with a limit per organiser per day, so nobody can use the sender address to mail at scale. */
export const sendContestInvites = (by: number, mails: (ContestMail & { key?: string })[], fetchImpl?: Fetch) =>
  sendBatch(`mail-contest:${by}`, MAX_CONTEST_MAILS_PER_DAY, 24 * 60 * MINUTE, "Too many race invitations emailed today.", mails.map((m) => ({ ...contestInviteMail(m), key: m.key })), fetchImpl);
