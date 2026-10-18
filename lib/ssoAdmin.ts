import { and, eq, ne } from "drizzle-orm";
import { companies, companySso, db } from "@/lib/db";
import { reachOf, scopeInReach } from "@/lib/tenancy";
import { discover, domainsOf, forgetProvider, normDomain, sealSecret, validDomain, WEBMAIL } from "@/lib/sso";
import { makeToken, revokeToken } from "@/lib/scim";
import type { SetupState } from "@/lib/setup";

type Me = { id: number; role: "admin" | "manager" | "learner" };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** The company, only if this person is an admin who runs it. */
function mine(me: Me, fd: FormData) {
  if (me.role !== "admin") return null;
  const id = Number(fd.get("companyId")), c = Number.isInteger(id) ? db.select().from(companies).where(eq(companies.id, id)).get() : undefined;
  return c && scopeInReach(reachOf(me.id), { kind: "company", id: c.id }) ? c : null;
}

/** Saves a company's single sign-on settings. A blank client secret keeps the one already stored. Changing the provider starts the proof again. */
export async function saveSso(me: Me, fd: FormData): Promise<SetupState> {
  const c = mine(me, fd);
  if (!c) return { error: "You can only change single sign-on for a company you run as an admin." };
  const have = db.select().from(companySso).where(eq(companySso.companyId, c.id)).get();
  const enabled = fd.get("enabled") === "yes", jit = fd.get("jit") === "yes", wantEnforce = fd.get("enforce") === "yes";
  const issuer = str(fd.get("issuer")).replace(/\/+$/, ""), clientId = str(fd.get("clientId")).slice(0, 200), secretIn = str(fd.get("clientSecret")).slice(0, 500);
  const domains = [...new Set(str(fd.get("domains")).split(/[\s,;]+/).map(normDomain).filter(Boolean))];
  if (issuer.length > 300 || (issuer && !/^https?:\/\/[^\s]+$/.test(issuer))) return { error: "The issuer must be the web address your provider gave you, like https://login.example.com." };
  for (const d of domains) {
    if (!validDomain(d)) return { error: `"${d}" is not a domain like example.com.` };
    if (WEBMAIL.has(d)) return { error: `${d} is a public email service, so it cannot belong to one company.` };
  }
  if (domains.length > 10) return { error: "Ten domains at most." };
  for (const o of db.select().from(companySso).where(ne(companySso.companyId, c.id)).all()) {
    const clash = domainsOf(o).find((d) => domains.includes(d));
    if (clash) return { error: `${clash} is already used by another company's sign-in.` }; // no hint which
  }
  if (enabled && (!issuer || !clientId || !domains.length)) return { error: "To switch it on, fill in the issuer, the client ID and at least one email domain." };
  const secret = secretIn ? sealSecret(secretIn) : have?.clientSecret ?? "";
  if (enabled && !secret) return { error: "Enter the client secret." };
  const changed = !have || have.issuer !== issuer || have.clientId !== clientId || !!secretIn || domainsOf(have).join() !== domains.join();
  if (enabled && changed) { // a provider that cannot be reached is found out now, not by the first person who tries
    forgetProvider(issuer);
    if (!(await discover(issuer))) return { error: "We could not read the provider's settings from that issuer (it must serve /.well-known/openid-configuration over https). Check the address." };
  }
  const verifiedAt = changed ? null : have?.verifiedAt ?? null;
  if (wantEnforce && !(enabled && verifiedAt)) return { error: "Require single sign-on can only be switched on after someone has signed in through it successfully. Save, sign in once with the company sign-in, then come back." };
  const row = { enabled: enabled ? ("yes" as const) : ("no" as const), issuer, clientId, clientSecret: secret, domains: domains.join(","), jit: jit ? ("yes" as const) : ("no" as const), enforce: wantEnforce ? ("yes" as const) : ("no" as const), verifiedAt, updatedAt: Math.floor(Date.now() / 1000) };
  if (have) db.update(companySso).set(row).where(eq(companySso.companyId, c.id)).run(); else db.insert(companySso).values({ companyId: c.id, ...row }).run();
  const note = changed && enabled ? " Sign in once through the company sign-in to prove it works; then you can require it." : "";
  return { done: `Saved single sign-on for ${c.name}.${note}${have?.enforce === "yes" && !wantEnforce ? " People can use passwords again." : ""}` };
}

/** Makes a directory-sync token. It is shown once, in the answer. */
export function newDirectoryToken(me: Me, fd: FormData): SetupState {
  const c = mine(me, fd);
  if (!c) return { error: "You can only manage directory sync for a company you run as an admin." };
  const r = makeToken(c.id, str(fd.get("label")));
  return "error" in r ? { error: r.error } : { done: `Your token (copy it now, it is not shown again): ${r.token}` };
}

export function dropDirectoryToken(me: Me, companyId: number, tokenId: number): SetupState {
  const fd = new FormData(); fd.set("companyId", String(companyId));
  const c = mine(me, fd);
  if (!c) return { error: "You can only manage directory sync for a company you run as an admin." };
  revokeToken(c.id, tokenId);
  return { done: "Token revoked. Anything using it stops working now." };
}
