/** Checks single sign-on: npm run check:sso. Runs a small OpenID provider on localhost (keys, discovery, token endpoint); adds and removes its own rows. Run db:push first. */
process.env.SSO_ALLOW_LOCAL = "1";
import { createHash, createSign, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { createServer } from "node:http";
import { eq, inArray, like } from "drizzle-orm";
import { checklistItems, companies, companySso, db, enrollments, notifications, userScopes, users } from "../lib/db";
import { REASONS, begin, companyForEmail, complete, discover, forgetProvider, openBox, openSecret, privateAddress, safeUrl, sealBox, sealSecret, soleMember, ssoRequired, validDomain } from "../lib/sso";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.name, "% Sso")).all().map((r) => r.id);
  const cs = db.select({ id: companies.id }).from(companies).where(like(companies.slug, "sso-check-%")).all().map((r) => r.id);
  if (cs.length) db.delete(companySso).where(inArray(companySso.companyId, cs)).run();
  if (us.length) { for (const t of [checklistItems, enrollments, notifications, userScopes] as const) db.delete(t).where(inArray((t as unknown as { userId: never }).userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
  if (cs.length) db.delete(companies).where(inArray(companies.id, cs)).run();
};
sweep();

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }), evil = generateKeyPairSync("rsa", { modulusLength: 2048 }), ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = (k: typeof rsa, kid: string, extra: object = {}) => ({ ...(k.publicKey.export({ format: "jwk" }) as object), kid, use: "sig", ...extra });
const b = (o: object | Buffer) => (Buffer.isBuffer(o) ? o : Buffer.from(JSON.stringify(o))).toString("base64url");

let issuer = "", nextToken = "", lastToken: URLSearchParams | null = null, lastAuth = "", tokenStatus = 200; const keys = [jwk(rsa, "k1"), jwk(ec as unknown as typeof rsa, "e1", { alg: "ES256" })];
const server = createServer((req, res) => {
  const send = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.url === "/.well-known/openid-configuration") return send(200, { issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` });
  if (req.url === "/jwks") return send(200, { keys });
  if (req.url === "/token" && req.method === "POST") { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { lastToken = new URLSearchParams(d); lastAuth = String(req.headers.authorization ?? ""); tokenStatus === 200 ? send(200, { id_token: nextToken, token_type: "Bearer" }) : send(tokenStatus, { error: "invalid_grant" }); }); return; }
  send(404, {});
});

async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const A = db.insert(companies).values({ slug: "sso-check-a", name: "Sso A" }).returning().get(), B = db.insert(companies).values({ slug: "sso-check-b", name: "Sso B" }).returning().get();
    const cfg = (over: Partial<typeof companySso.$inferInsert> = {}) => { db.delete(companySso).where(eq(companySso.companyId, A.id)).run(); db.insert(companySso).values({ companyId: A.id, enabled: "yes", issuer, clientId: "client-1", clientSecret: sealSecret("s3cret"), domains: "acme.test,Corp.Test", ...over }).run(); forgetProvider(issuer); };
    const mk = (n: string, over: Partial<typeof users.$inferInsert> = {}, scopes: number[] = []) => { const u = db.insert(users).values({ name: `${n} Sso`, email: `${n}@sso.check`, jobRole: "general", audience: "staff", passwordHash: "x", ...over }).returning().get(); for (const c of scopes) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: c }).run(); return u; };
    const REDIR = "http://app.test/sso/callback";

    // ---- the pieces ----
    check("a client secret is stored encrypted and comes back", (() => { const s = sealSecret("s3cret"); return !s.includes("s3cret") && openSecret(s) === "s3cret" && sealSecret("s3cret") !== s; })());
    check("a damaged or foreign secret is not read", openSecret("v1:a:b:c") === null && openSecret("plain") === null && (() => { const p = sealSecret("x").split(":"); p[2] = "A".repeat(22); return openSecret(p.join(":")) === null; })());
    check("private and special addresses are recognised", ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.0.1", "172.31.255.255", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "224.0.0.1"].every(privateAddress) && !["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700::1111"].some(privateAddress));
    process.env.SSO_ALLOW_LOCAL = "";
    check("fetches are only made to public https addresses", !(await safeUrl("http://example.com/x")) && !(await safeUrl("https://127.0.0.1/x")) && !(await safeUrl("https://localhost/x")) && !(await safeUrl("https://10.0.0.5/x")) && !(await safeUrl("https://169.254.169.254/latest")) && !(await safeUrl("https://user:pw@example.com/")) && !(await safeUrl("https://intranet/x")) && !(await safeUrl("https://printer.local/x")) && !(await safeUrl("javascript:alert(1)")) && !(await safeUrl("not a url")) && !(await safeUrl("https://[::1]/x")));
    process.env.SSO_ALLOW_LOCAL = "1";
    check("domains are checked for shape", ["acme.com", "sub.acme.co.uk"].every(validDomain) && ["acme", "-a.com", "a b.com", "a@b.com", ".com", "x.c"].every((d) => !validDomain(d)));

    // ---- discovery ----
    cfg();
    check("the provider is discovered, and its issuer must match", !!(await discover(issuer)) && (forgetProvider(issuer + "/other"), !(await discover(issuer + "/other"))));

    // ---- starting ----
    const started = await begin(A.id, REDIR, "/dashboard");
    if ("error" in started) { check("begin works", false); return; }
    const u = new URL(started.url), q = u.searchParams, box = openBox(started.box)!;
    check("the sign-in goes to the provider with PKCE, state and nonce", u.origin + u.pathname === `${issuer}/authorize` && q.get("response_type") === "code" && q.get("client_id") === "client-1" && q.get("redirect_uri") === REDIR && q.get("code_challenge_method") === "S256" && q.get("state") === box.s && q.get("nonce") === box.n && q.get("scope") === "openid email profile" && q.get("code_challenge") === createHash("sha256").update(box.v).digest("base64url"));
    check("the box is signed: changed, cut or expired ones are refused", !openBox(`${started.box.startsWith("e") ? "f" : "e"}${started.box.slice(1)}`) && !openBox("junk") && !openBox(undefined) && !openBox(sealBox({ ...box, exp: 1 })) && !!openBox(started.box));
    cfg({ enabled: "no" });
    check("it does not start when single sign-on is off or unset", "error" in (await begin(A.id, REDIR, "/")) && "error" in (await begin(B.id, REDIR, "/")));
    cfg();

    // ---- finishing ----
    const idt = (claims: Record<string, unknown>, o: { alg?: string; kid?: string; key?: typeof rsa; hdr?: object } = {}) => {
      const alg = o.alg ?? "RS256", head = b({ alg, typ: "JWT", kid: o.kid ?? "k1", ...(o.hdr ?? {}) }), body = b({ iss: issuer, aud: "client-1", exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000), sub: "s1", email_verified: true, ...claims });
      if (alg === "none") return `${head}.${body}.`;
      if (alg === "HS256") return `${head}.${body}.${b(Buffer.from("x"))}`;
      const data = `${head}.${body}`;
      const sig = alg === "ES256" ? cryptoSign("sha256", Buffer.from(data), { key: (ec as unknown as typeof rsa).privateKey, dsaEncoding: "ieee-p1363" }) : createSign("RSA-SHA256").update(data).sign((o.key ?? rsa).privateKey);
      return `${data}.${b(sig)}`;
    };
    const run = async (claims: Record<string, unknown>, o: Parameters<typeof idt>[1] = {}, mutate?: (bx: ReturnType<typeof openBox> & object) => object) => {
      const s = await begin(A.id, REDIR, "/dashboard");
      if ("error" in s) return { error: "begin" };
      const bx = openBox(s.box)!;
      nextToken = idt({ nonce: bx.n, ...claims }, o);
      const rawBox = mutate ? sealBox({ ...bx, ...mutate(bx) } as typeof bx) : s.box;
      return complete(rawBox, { code: "code-1", state: mutate ? bx.s : bx.s }, REDIR);
    };
    const learner = mk("ann", {}, [A.id]);
    const ok1 = await run({ email: "Ann@sso.check".replace("sso.check", "acme.test") });
    check("(set-up) an email in a claimed domain finds no account yet", "error" in ok1 && ok1.error === "unknown");
    db.update(users).set({ email: "ann@acme.test" }).where(eq(users.id, learner.id)).run();
    const good = await run({ email: "ann@acme.test", name: "Ann" });
    check("a good sign-in returns the person and where to go", "userId" in good && good.userId === learner.id && good.next === "/dashboard");
    check("the code exchange used the client, the secret, the redirect and the PKCE verifier", lastToken?.get("grant_type") === "authorization_code" && lastToken?.get("code") === "code-1" && lastToken?.get("redirect_uri") === REDIR && lastToken?.get("client_id") === "client-1" && lastAuth === `Basic ${Buffer.from("client-1:s3cret").toString("base64")}` && lastToken?.get("code_verifier")!.length === 43);
    check("the first success proves the setup", !!db.select().from(companySso).where(eq(companySso.companyId, A.id)).get()?.verifiedAt);
    check("an ES256 token works too", "userId" in (await run({ email: "ann@acme.test" }, { alg: "ES256", kid: "e1" })));
    check("the domain match ignores case, and the second claimed domain works", "userId" in (await run({ email: "ANN@ACME.TEST" })) && (db.update(users).set({ email: "ann@corp.test" }).where(eq(users.id, learner.id)).run(), "userId" in (await run({ email: "ann@Corp.test" }))));
    db.update(users).set({ email: "ann@acme.test" }).where(eq(users.id, learner.id)).run();

    const bad = async (name: string, r: Promise<unknown>, code: string) => { const x = (await r) as { error?: string }; check(name, x.error === code); };
    await bad("a token signed with someone else's key is refused", run({ email: "ann@acme.test" }, { key: evil }), "signature");
    await bad("a token with no signature (alg none) is refused", run({ email: "ann@acme.test" }, { alg: "none" }), "algorithm");
    await bad("a token using a shared-secret algorithm is refused", run({ email: "ann@acme.test" }, { alg: "HS256" }), "algorithm");
    await bad("a key the provider does not publish is refused", run({ email: "ann@acme.test" }, { kid: "nope" }), "key");
    await bad("another issuer is refused", run({ email: "ann@acme.test", iss: "https://evil.test" }), "issuer");
    await bad("a token made for another client is refused", run({ email: "ann@acme.test", aud: "someone-else" }), "audience");
    await bad("several audiences need the right authorised party", run({ email: "ann@acme.test", aud: ["client-1", "other"], azp: "other" }), "audience");
    await bad("an expired token is refused", run({ email: "ann@acme.test", exp: Math.floor(Date.now() / 1000) - 3600 }), "expired");
    await bad("a token issued in the future is refused", run({ email: "ann@acme.test", iat: Math.floor(Date.now() / 1000) + 3600 }), "token");
    await bad("a token for a different sign-in (nonce) is refused", run({ email: "ann@acme.test", nonce: "other" }), "nonce");
    await bad("a token with no subject is refused", run({ email: "ann@acme.test", sub: "" }), "token");
    await bad("an unverified email is refused", run({ email: "ann@acme.test", email_verified: false }), "email");
    await bad("so is the string false", run({ email: "ann@acme.test", email_verified: "false" }), "email");
    await bad("no email at all is refused", run({}), "email");
    await bad("an email outside the company's domains is refused", run({ email: "ann@elsewhere.test" }), "domain");
    await bad("a lookalike domain is refused", run({ email: "ann@acme.test.evil.com" }), "domain");
    await bad("a subdomain is not the domain", run({ email: "ann@sub.acme.test" }), "domain");

    const s2 = await begin(A.id, REDIR, "/x");
    if (!("error" in s2)) {
      nextToken = idt({ nonce: openBox(s2.box)!.n, email: "ann@acme.test" });
      check("a wrong state is refused", ((await complete(s2.box, { code: "c", state: "wrong" }, REDIR)) as { error?: string }).error === "state");
      check("a missing code or box is refused", ((await complete(s2.box, { state: openBox(s2.box)!.s }, REDIR)) as { error?: string }).error === "state" && ((await complete(undefined, { code: "c", state: "x" }, REDIR)) as { error?: string }).error === "expired");
      check("a provider's error answer is passed on as a refusal", ((await complete(s2.box, { error: "access_denied", state: openBox(s2.box)!.s }, REDIR)) as { error?: string }).error === "denied");
      tokenStatus = 400;
      check("a refused code exchange is a refusal", ((await complete(s2.box, { code: "c", state: openBox(s2.box)!.s }, REDIR)) as { error?: string }).error === "token");
      tokenStatus = 200;
      cfg({ clientSecret: sealSecret("s3cret").replace(/.$/, "A") });
      check("a client secret that cannot be read is a setup problem, not a way in", ((await complete(s2.box, { code: "c", state: openBox(s2.box)!.s }, REDIR)) as { error?: string }).error === "provider");
      cfg();
    }

    // ---- who gets in ----
    const ctx = (email: string) => run({ email });
    const pre = mk("pre", { email: "pre@acme.test", passwordHash: "attackers-known-password" });
    await bad("an account made through open sign-up with that address is never taken over", ctx("pre@acme.test"), "elsewhere");
    mk("two", { email: "two@acme.test" }, [A.id, B.id]); await bad("an account in two companies is not taken over", ctx("two@acme.test"), "elsewhere");
    mk("bee", { email: "bee@acme.test" }, [B.id]); await bad("an account in another company is not taken over", ctx("bee@acme.test"), "elsewhere");
    mk("root", { email: "root@acme.test", role: "admin" }); await bad("the platform owner (an admin with no company) cannot come in this way", ctx("root@acme.test"), "elsewhere");
    mk("gone", { email: "gone@acme.test", status: "offboarded" }, [A.id]); await bad("someone who has been switched off cannot come in", ctx("gone@acme.test"), "inactive");
    const boss = mk("boss", { email: "boss@acme.test", role: "admin" }, [A.id]);
    check("a company's own admin and manager can", (mk("mgr", { email: "mgr@acme.test", role: "manager" }, [A.id]), "userId" in (await ctx("boss@acme.test")) && "userId" in (await ctx("mgr@acme.test"))));
    await bad("an address with no account is refused when accounts are not created on first sign-in", ctx("new@acme.test"), "unknown");
    check("the password of an account is untouched by signing in", db.select().from(users).where(eq(users.id, pre.id)).get()?.passwordHash === "attackers-known-password");
    cfg({ jit: "yes" });
    const made = await run({ email: "fresh@acme.test", name: "Fresh Sso" });
    const fresh = "userId" in made ? db.select().from(users).where(eq(users.id, made.userId)).get() : undefined;
    check("with that switched on, a new person gets a learner account in this company alone, with no password", !!fresh && fresh.role === "learner" && fresh.name === "Fresh Sso" && fresh.passwordHash === "" && soleMember(fresh.id, A.id) && db.select().from(checklistItems).where(eq(checklistItems.userId, fresh.id)).all().length > 0);
    check("signing in again finds the same account", "userId" in (await run({ email: "fresh@acme.test" })) && db.select().from(users).where(eq(users.email, "fresh@acme.test")).all().length === 1);
    await bad("it still never creates one outside the claimed domains", run({ email: "fresh@evil.test" }), "domain");

    // ---- requiring it ----
    cfg({ enforce: "yes", verifiedAt: null });
    check("it is not required until a first sign-in has worked", ssoRequired("ann@acme.test") === null);
    cfg({ enforce: "yes", verifiedAt: Math.floor(Date.now() / 1000) });
    check("then learners and managers must use it, and are told how", /single sign-on/i.test(ssoRequired("ann@acme.test") ?? "") && /single sign-on/i.test(ssoRequired("mgr@acme.test") ?? ""));
    check("admins are never held to it, so a wrong setting can be undone", ssoRequired("boss@acme.test") === null && boss.role === "admin");
    check("people outside the company, in two companies, or unknown are not held to it", ssoRequired("bee@acme.test") === null && ssoRequired("two@acme.test") === null && ssoRequired("nobody@acme.test") === null && ssoRequired("pre@acme.test") === null);
    cfg({ enforce: "yes", verifiedAt: Math.floor(Date.now() / 1000), enabled: "no" });
    check("switching single sign-on off lifts the requirement", ssoRequired("ann@acme.test") === null);

    // ---- finding the company from an email ----
    cfg();
    check("an email finds its company by domain", companyForEmail("x@ACME.test")?.slug === "sso-check-a" && companyForEmail("x@corp.test")?.slug === "sso-check-a" && companyForEmail("x@other.test") === null && companyForEmail("nope") === null && companyForEmail("x@sub.acme.test") === null);
    cfg({ enabled: "no" });
    check("nothing is found while it is off", companyForEmail("x@acme.test") === null);
    check("every refusal has words to show, and no stray text can be shown", ["expired", "state", "denied", "off", "provider", "token", "algorithm", "key", "signature", "issuer", "audience", "nonce", "email", "domain", "inactive", "elsewhere", "unknown"].every((k) => !!REASONS[k]) && REASONS["<script>"] === undefined);
  } finally {
    server.close(); sweep();
  }
}
main().then(() => {
  check("the test's own rows are gone", db.select().from(users).where(like(users.name, "% Sso")).all().length === 0);
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
});
