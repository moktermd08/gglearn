/** Checks personal Google and Microsoft sign-in: npm run check:social. Runs a small OpenID provider on localhost; adds and removes its own rows. Run db:push first. */
process.env.SSO_ALLOW_LOCAL = "1";
process.env.GOOGLE_CLIENT_ID = "gid"; process.env.GOOGLE_CLIENT_SECRET = "gsec";
import { createSign, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import { eq, inArray, like } from "drizzle-orm";
import { checklistItems, companies, companySso, db, enrollments, notifications, oauthIdentities, userScopes, users } from "../lib/db";
import { LABEL, REASONS, available, begin, complete, configFor, disconnect, identitiesOf, trustedEmail } from "../lib/social";
import { openBox, forgetProvider } from "../lib/sso";
import { referralCode } from "../lib/referrals";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.name, "% Soc")).all().map((r) => r.id);
  const cs = db.select({ id: companies.id }).from(companies).where(like(companies.slug, "social-check-%")).all().map((r) => r.id);
  if (cs.length) db.delete(companySso).where(inArray(companySso.companyId, cs)).run();
  if (us.length) { db.delete(oauthIdentities).where(inArray(oauthIdentities.userId, us)).run(); for (const t of [checklistItems, enrollments, notifications, userScopes] as const) db.delete(t).where(inArray((t as unknown as { userId: never }).userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
  if (cs.length) db.delete(companies).where(inArray(companies.id, cs)).run();
};
sweep();

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const b = (o: object | Buffer) => (Buffer.isBuffer(o) ? o : Buffer.from(JSON.stringify(o))).toString("base64url");
let issuer = "", nextToken = "";
const server = createServer((req, res) => {
  const send = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.url === "/.well-known/openid-configuration") return send(200, { issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` });
  if (req.url === "/jwks") return send(200, { keys: [{ ...(rsa.publicKey.export({ format: "jwk" }) as object), kid: "k1", use: "sig" }] });
  if (req.url === "/token" && req.method === "POST") { req.resume(); req.on("end", () => send(200, { id_token: nextToken })); return; }
  send(404, {});
});

async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.SOCIAL_TEST_ISSUER_GOOGLE = issuer; forgetProvider(issuer);
  try {
    const REDIR = "http://app.test/auth/google/callback";
    const mk = (n: string, over: Partial<typeof users.$inferInsert> = {}) => db.insert(users).values({ name: `${n} Soc`, email: `${n}@social.test`, jobRole: "general", audience: "staff", passwordHash: "pw", ...over }).returning().get();
    const row = (id: number) => db.select().from(users).where(eq(users.id, id)).get()!;
    const idt = (claims: Record<string, unknown>, o: { key?: typeof rsa } = {}) => {
      const head = b({ alg: "RS256", typ: "JWT", kid: "k1" }), body = b({ iss: issuer, aud: "gid", exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000), sub: "g-1", email_verified: true, ...claims });
      return `${head}.${body}.${b(createSign("RSA-SHA256").update(`${head}.${body}`).sign((o.key ?? rsa).privateKey))}`;
    };
    const flow = async (claims: Record<string, unknown>, opts: { ref?: string; tried?: string; link?: number; signedIn?: number | null } = {}) => {
      const s = await begin("google", REDIR, { next: "/dashboard", ref: opts.ref, tried: opts.tried, link: opts.link });
      if ("error" in s) return { error: "begin" } as const;
      const bx = openBox(s.box)!;
      nextToken = idt({ nonce: bx.n, ...claims });
      return complete("google", s.box, { code: "c", state: bx.s }, REDIR, opts.signedIn ?? null);
    };
    const identityRows = (sub: string) => db.select().from(oauthIdentities).where(eq(oauthIdentities.subject, sub)).all();

    // ---- what is on offer ----
    check("a provider is offered only when its credentials are set", available().join() === "google" && configFor("microsoft") === null && LABEL.google === "Google");
    check("the test issuer cannot be used without the test switch", (() => { process.env.SSO_ALLOW_LOCAL = ""; const c = configFor("google"); process.env.SSO_ALLOW_LOCAL = "1"; return c?.issuer === "https://accounts.google.com"; })());
    process.env.MICROSOFT_CLIENT_ID = "mid"; process.env.MICROSOFT_CLIENT_SECRET = "msec";
    const ms = configFor("microsoft")!, tid = "11111111-2222-3333-4444-555555555555";
    check("Microsoft accepts a token issued by the person's own tenant, and nothing else", ms.issuerOk!(`https://login.microsoftonline.com/${tid}/v2.0`, { tid }) && !ms.issuerOk!(`https://login.microsoftonline.com/${tid}/v2.0`, { tid: "99999999-2222-3333-4444-555555555555" }) && !ms.issuerOk!(`https://login.microsoftonline.com/${tid}/v2.0`, {}) && !ms.issuerOk!(`https://evil.test/${tid}/v2.0`, { tid }) && !ms.issuerOk!("https://login.microsoftonline.com/not-a-guid/v2.0", { tid: "not-a-guid" }) && !ms.issuerOk!(`https://login.microsoftonline.com/${tid}/v2.0/x`, { tid }));
    const gg = configFor("google")!; delete process.env.SOCIAL_TEST_ISSUER_GOOGLE; const real = configFor("google")!; process.env.SOCIAL_TEST_ISSUER_GOOGLE = issuer;
    check("Google accepts only Google as issuer", real.issuerOk!("https://accounts.google.com", {}) && real.issuerOk!("accounts.google.com", {}) && !real.issuerOk!("https://accounts.google.com.evil.test", {}) && gg.issuer === issuer);
    check("Google's email is believed only when verified", trustedEmail("google", { email: "A@X.com", email_verified: true }) === "a@x.com" && trustedEmail("google", { email: "a@x.com", email_verified: "true" }) === "a@x.com" && trustedEmail("google", { email: "a@x.com", email_verified: false }) === null && trustedEmail("google", { email: "a@x.com" }) === null && trustedEmail("google", { email_verified: true }) === null && trustedEmail("google", { email: "nope", email_verified: true }) === null);
    check("Microsoft's email is believed for personal accounts and verified work domains only", trustedEmail("microsoft", { email: "a@x.com", tid: "9188040d-6c67-4c5b-b112-36a304b66dad" }) === "a@x.com" && trustedEmail("microsoft", { email: "a@x.com", tid, xms_edov: true }) === "a@x.com" && trustedEmail("microsoft", { email: "a@x.com", tid, xms_edov: "1" }) === "a@x.com" && trustedEmail("microsoft", { email: "a@x.com", tid }) === null && trustedEmail("microsoft", { email: "a@x.com", tid, xms_edov: false }) === null && trustedEmail("microsoft", { email: "a@x.com" }) === null);

    // ---- starting ----
    const s = await begin("google", REDIR, { next: "/x", ref: "r1", tried: "py", link: 5 });
    if ("error" in s) { check("begin works", false); return; }
    const q = new URL(s.url).searchParams, bx = openBox(s.box)!;
    check("it goes to the provider with PKCE, state, nonce and an account chooser", q.get("client_id") === "gid" && q.get("code_challenge_method") === "S256" && q.get("state") === bx.s && q.get("nonce") === bx.n && q.get("prompt") === "select_account" && q.get("scope") === "openid email profile");
    check("the box remembers the provider, where to go, the referral, the topic tried and who is connecting", bx.p === "google" && bx.next === "/x" && bx.ref === "r1" && bx.try === "py" && bx.link === 5);
    delete process.env.GOOGLE_CLIENT_SECRET;
    check("it does not start without credentials", "error" in (await begin("google", REDIR, { next: "/" })));
    process.env.GOOGLE_CLIENT_SECRET = "gsec";

    // ---- a new person ----
    const inviter = mk("inviter");
    const first = await flow({ sub: "g-new", email: "Newbie@social.test", name: "Newbie Soc" }, { ref: referralCode(inviter.id) });
    const nu = "userId" in first ? row(first.userId) : null;
    check("a new person gets an account the way open sign-up makes one", !!nu && "created" in first && first.created === true && nu.email === "newbie@social.test" && nu.role === "learner" && nu.guest === "yes" && nu.audience === "staff" && nu.passwordHash === "" && nu.emailNudges === "off" && nu.referredBy === inviter.id);
    check("and goes where they were headed", "next" in first && first.next === "/dashboard" && identityRows("g-new").length === 1 && identityRows("g-new")[0].userId === nu?.id);
    const again = await flow({ sub: "g-new", email: "changed-address@social.test" });
    check("signing in again finds the same account, even if the email at the provider changed", "userId" in again && again.userId === nu?.id && again.created === false && db.select().from(users).where(like(users.email, "%@social.test")).all().filter((u) => u.name.endsWith("Soc")).length === 2);

    // ---- who is refused ----
    const pre = mk("pre", { passwordHash: "attackers-known-password" });
    const hit = await flow({ sub: "g-pre", email: "pre@social.test" });
    check("an address that already has an account is never linked automatically", "error" in hit && hit.error === "exists" && identityRows("g-pre").length === 0 && row(pre.id).passwordHash === "attackers-known-password");
    const unv = await flow({ sub: "g-unv", email: "unverified@social.test", email_verified: false });
    check("an email the provider does not vouch for makes no account", "error" in unv && unv.error === "email" && identityRows("g-unv").length === 0 && !db.select().from(users).where(eq(users.email, "unverified@social.test")).get());
    const co = db.insert(companies).values({ slug: "social-check-a", name: "Social A" }).returning().get();
    db.insert(companySso).values({ companyId: co.id, enabled: "yes", issuer: "https://idp.example.com", clientId: "x", clientSecret: "x", domains: "bigco-social.test" }).run();
    const claimed = await flow({ sub: "g-co", email: "someone@bigco-social.test" });
    check("an email on a company's single sign-on domain is sent to the company's sign-in", "error" in claimed && claimed.error === "company" && identityRows("g-co").length === 0 && !db.select().from(users).where(eq(users.email, "someone@bigco-social.test")).get());
    const wrongAud = await flow({ sub: "g-aud", email: "aud@social.test", aud: "someone-else" });
    check("a token for another application is refused", "error" in wrongAud && wrongAud.error === "audience");
    const sw = await begin("google", REDIR, { next: "/" });
    check("a box made for one provider cannot finish another's sign-in", !("error" in sw) && (await complete("microsoft", sw.box, { code: "c", state: openBox(sw.box)!.s }, REDIR, null) as { error?: string }).error === "expired");
    db.update(users).set({ status: "offboarded" }).where(eq(users.id, nu!.id)).run();
    const off = await flow({ sub: "g-new", email: "newbie@social.test" });
    check("someone switched off cannot sign in this way", "error" in off && off.error === "inactive");
    db.update(users).set({ status: "active" }).where(eq(users.id, nu!.id)).run();

    // ---- a company that later requires its own sign-in ----
    const emp = mk("emp", { email: "emp@bigco-social.test" });
    db.insert(userScopes).values({ userId: emp.id, kind: "company", refId: co.id }).run();
    db.insert(oauthIdentities).values({ provider: "google", subject: "g-emp", userId: emp.id, email: emp.email }).run();
    db.update(companySso).set({ enforce: "yes", verifiedAt: 1 }).where(eq(companySso.companyId, co.id)).run();
    const enforced = await flow({ sub: "g-emp", email: "emp@bigco-social.test" });
    check("a company that requires its own sign-in is not bypassed by a connected account", "error" in enforced && enforced.error === "company");

    // ---- connecting from a profile ----
    const me = mk("me"), other = mk("other");
    const linked = await flow({ sub: "g-me", email: "anything@else.test", email_verified: false }, { link: me.id, signedIn: me.id });
    check("a signed-in person can connect an account, whatever its email", "linked" in linked && linked.linked === true && identityRows("g-me")[0]?.userId === me.id);
    check("connecting needs the person to still be signed in as themselves", ((await flow({ sub: "g-x1" }, { link: me.id, signedIn: null })) as { error?: string }).error === "expired" && ((await flow({ sub: "g-x2" }, { link: me.id, signedIn: other.id })) as { error?: string }).error === "expired" && identityRows("g-x1").length + identityRows("g-x2").length === 0);
    check("an account connected to someone else cannot be taken", ((await flow({ sub: "g-me" }, { link: other.id, signedIn: other.id })) as { error?: string }).error === "taken" && identityRows("g-me")[0].userId === me.id);
    check("connecting the same account again changes nothing", "linked" in (await flow({ sub: "g-me" }, { link: me.id, signedIn: me.id })) && identityRows("g-me").length === 1);

    // ---- disconnecting ----
    const sole = mk("sole", { passwordHash: "" });
    db.insert(oauthIdentities).values({ provider: "google", subject: "g-sole", userId: sole.id, email: "" }).run();
    check("the last way in cannot be removed", "error" in disconnect(sole.id, "google") && identitiesOf(sole.id).length === 1);
    db.insert(oauthIdentities).values({ provider: "microsoft", subject: "m-sole", userId: sole.id, email: "" }).run();
    check("with a second connection one can go", "ok" in disconnect(sole.id, "google") && identitiesOf(sole.id).length === 1);
    check("with a password a connection can go", "ok" in disconnect(me.id, "google") && identitiesOf(me.id).length === 0 && "ok" in disconnect(me.id, "google"));
    check("every refusal has words to show, and no stray text can be shown", ["expired", "state", "denied", "off", "provider", "token", "algorithm", "key", "signature", "issuer", "audience", "nonce", "email", "inactive", "company", "exists", "taken"].every((k) => !!REASONS[k]) && REASONS["<x>"] === undefined);
  } finally {
    server.close(); sweep();
  }
}
main().then(() => {
  check("the test's own rows are gone", db.select().from(users).where(like(users.name, "% Soc")).all().length === 0 && db.select().from(oauthIdentities).where(like(oauthIdentities.subject, "g-%")).all().length === 0);
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
});
