import { MINUTE, allowed, hit } from "@/lib/rate-limit";

/**
 * Sending email, through Resend (the same provider and the same two settings pattern as ggsocial). It does nothing unless both are set:
 *   RESEND_API_KEY  an API key from resend.com
 *   MAIL_FROM       the sender, on a domain verified in Resend, e.g. "gglearn <gglearn@your-domain>"
 * RESEND_API_URL is optional and only for testing against a stand-in service; leave it unset in production.
 * Without them nothing is sent and every screen falls back to what it did before (copy the link, or Open in email).
 * A send never throws: the caller gets { ok: false, error } and the person is told to use the link instead.
 */
export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string };
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
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
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
