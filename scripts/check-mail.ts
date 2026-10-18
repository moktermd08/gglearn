/** Checks sending email, with a fake mail service so nothing is ever sent: npm run check:mail */
import { MAX_MAILS_PER_HOUR, escapeHtml, inviteMail, mailConfigured, sendInvites, sendMail } from "../lib/mail";
import { clear } from "../lib/rate-limit";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const env = { RESEND_API_KEY: "re_secret_key_123", MAIL_FROM: "gglearn <gglearn@example.com>" } as unknown as NodeJS.ProcessEnv;
type Call = { url: string; init: RequestInit };
const fake = (status: number, body: object, calls: Call[] = []) => (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init! }); return new Response(JSON.stringify(body), { status }); }) as typeof fetch;
const mail = { to: "ana@example.com", subject: "Hi", text: "t", html: "<p>t</p>" };

(async () => {
  // configured or not
  check("not configured with nothing set", !mailConfigured({} as NodeJS.ProcessEnv));
  check("not configured with only a key", !mailConfigured({ RESEND_API_KEY: "k" } as unknown as NodeJS.ProcessEnv));
  check("not configured with only a sender", !mailConfigured({ MAIL_FROM: "a@b.c" } as unknown as NodeJS.ProcessEnv));
  check("not configured with blanks", !mailConfigured({ RESEND_API_KEY: "  ", MAIL_FROM: " " } as unknown as NodeJS.ProcessEnv));
  check("configured with both", mailConfigured(env));
  const calls0: Call[] = [];
  const off = await sendMail(mail, { env: {} as NodeJS.ProcessEnv, fetchImpl: fake(200, { id: "x" }, calls0) });
  check("unconfigured: nothing is sent and the caller is told", !off.ok && calls0.length === 0);

  // the request
  const calls: Call[] = [];
  const ok = await sendMail({ ...mail, replyTo: "boss@example.com" }, { env, key: "invite-abc", fetchImpl: fake(200, { id: "em_1" }, calls) });
  const sent = JSON.parse(String(calls[0]?.init.body));
  const hdr = calls[0]?.init.headers as Record<string, string>;
  check("a good send returns the id", ok.ok && ok.id === "em_1");
  check("it goes to Resend", calls[0]?.url === "https://api.resend.com/emails");
  const calls3: Call[] = [];
  await sendMail(mail, { env: { ...env, RESEND_API_URL: "http://127.0.0.1:3999/" } as unknown as NodeJS.ProcessEnv, fetchImpl: fake(200, { id: "e" }, calls3) });
  check("a stand-in address can be used for testing", calls3[0]?.url === "http://127.0.0.1:3999/emails");
  check("it carries the key as a bearer token", hdr.Authorization === "Bearer re_secret_key_123");
  check("a repeat of the same send is marked so it arrives once", hdr["Idempotency-Key"] === "invite-abc");
  check("the sender, recipient, subject and bodies are in the request", sent.from === env.MAIL_FROM && sent.to[0] === "ana@example.com" && sent.subject === "Hi" && sent.text === "t" && sent.html === "<p>t</p>");
  check("replies go to the person who invited", sent.reply_to === "boss@example.com");

  // failure never throws and never shows the key
  const bad = await sendMail(mail, { env, fetchImpl: fake(403, { message: "The gglearn.example domain is not verified." }) });
  check("a refusal comes back as an error with Resend's reason", !bad.ok && /not verified/.test(bad.error));
  const down = await sendMail(mail, { env, fetchImpl: (async () => { throw new Error("connect ECONNREFUSED re_secret_key_123"); }) as unknown as typeof fetch });
  check("an unreachable service comes back as an error, not a crash", !down.ok && /could not be reached/.test(down.error));
  check("the key is never in an error", !JSON.stringify([bad, down]).includes("re_secret_key_123"));
  const noId = await sendMail(mail, { env, fetchImpl: fake(200, {}) });
  check("a 200 with no id is not counted as sent", !noId.ok);

  // the invitation itself
  const evil = inviteMail({ to: "x@y.z", link: "https://g.example/join/abc", from: '<img src=x onerror=alert(1)>', where: 'A & "B"', role: "dev", access: "manager" });
  check("a name cannot inject markup into the HTML", !evil.html.includes("<img src=x") && evil.html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  check("the link, role and access are in the text", evil.text.includes("https://g.example/join/abc") && evil.text.includes("as dev (with manager access)"));
  check("a learner invite does not mention access", !inviteMail({ to: "a@b.c", link: "l", from: "G", where: "W", role: "dev", access: "learner" }).text.includes("access"));
  check("the subject names who invited", evil.subject.endsWith("invited you to gglearn"));
  check("escapeHtml covers the five characters", escapeHtml(`&<>"'`) === "&amp;&lt;&gt;&quot;&#39;");

  // a batch, with a limit per person per hour
  process.env.RESEND_API_KEY = env.RESEND_API_KEY; process.env.MAIL_FROM = env.MAIL_FROM;
  clear("mail-invite:777");
  const batch = [1, 2, 3].map((n) => ({ to: `p${n}@example.com`, link: `l${n}`, from: "G", where: "W", role: "dev", access: "learner" }));
  const calls2: Call[] = [];
  const r = await sendInvites(777, batch, fake(200, { id: "e" }, calls2));
  check("a batch emails each person once", r.sent.length === 3 && r.failed.length === 0 && calls2.length === 3);
  const mixed = await sendInvites(777, batch.slice(0, 2), (async (_u: string | URL | Request, init?: RequestInit) => new Response(JSON.stringify(JSON.parse(String(init!.body)).to[0] === "p1@example.com" ? { message: "bad address" } : { id: "e" }), { status: JSON.parse(String(init!.body)).to[0] === "p1@example.com" ? 422 : 200 })) as typeof fetch);
  check("one failure does not stop the rest, and says who", mixed.sent.join() === "p2@example.com" && mixed.failed.length === 1 && mixed.failed[0].email === "p1@example.com" && /bad address/.test(mixed.failed[0].error));
  clear("mail-invite:778");
  const many = Array.from({ length: MAX_MAILS_PER_HOUR + 5 }, (_, n) => ({ to: `m${n}@example.com`, link: "l", from: "G", where: "W", role: "dev", access: "learner" }));
  const capped = await sendInvites(778, many, fake(200, { id: "e" }));
  check("a person cannot send more than the hourly limit", capped.sent.length === MAX_MAILS_PER_HOUR && capped.failed.length === 5 && /Too many emails/.test(capped.failed[0].error));
  clear("mail-invite:777"); clear("mail-invite:778");

  console.log(fails ? `\n${fails} FAILED` : "\nall passed");
  process.exit(fails ? 1 : 0);
})();
