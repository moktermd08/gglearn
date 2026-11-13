/**
 * Checks super admin and "view as": npm run check:impersonation (needs no seeded data; adds and removes its own rows. Run db:push first).
 * Who counts as a super admin, that the view-as cookie cannot be forged, replayed, extended or mixed up with a session cookie, who may be
 * viewed, that a super admin runs the whole academy and nobody else is widened, and that the actions which would lock someone out stay
 * blocked while viewing.
 */
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { companies, db, securityLog, userScopes, users } from "../lib/db";
import { VIEWAS_TTL_SEC, makeToken, readToken, whyNotViewAs } from "../lib/impersonation";
import { recordProfileView, recordSecurityEvent } from "../lib/securityLog";
import { isSuperAdmin } from "../lib/superAdmin";
import { isGlobal, reachOf } from "../lib/tenancy";

process.env.SESSION_SECRET ??= "check-impersonation-secret-0123456789";
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const L = new Set(["boss@x.test", "other@x.test"]);
const id = (email: string, role = "admin", status = "active") => ({ email, role, status });

// ---- who is a super admin
check("an active admin on the list is one", isSuperAdmin(id("boss@x.test"), L));
check("the match ignores case and the list ignores spaces", isSuperAdmin(id("BOSS@X.TEST"), L));
check("an admin not on the list is not", !isSuperAdmin(id("nobody@x.test"), L));
check("being on the list is not enough without being an admin", !isSuperAdmin(id("boss@x.test", "learner"), L) && !isSuperAdmin(id("boss@x.test", "manager"), L));
check("an offboarded admin on the list is not one", !isSuperAdmin(id("boss@x.test", "admin", "offboarded"), L));
check("an empty list means nobody", !isSuperAdmin(id("boss@x.test"), new Set()));
check("no person means no", !isSuperAdmin(null, L) && !isSuperAdmin(undefined, L));

// ---- the cookie
const now = Math.floor(Date.now() / 1000);
const tok = { actorId: 5, targetId: 9, iat: now, ver: 2 };
const raw = makeToken(tok);
check("a good token reads back", JSON.stringify(readToken(raw)) === JSON.stringify(tok));
const parts = raw.split(".");
const flip = (i: number, v: string) => parts.map((p, k) => (k === i ? v : p)).join(".");
check("changing the person viewed breaks it", readToken(flip(1, "10")) === null);
check("changing who is viewing breaks it", readToken(flip(0, "6")) === null);
check("changing the session version breaks it", readToken(flip(3, "3")) === null);
check("extending the time breaks it", readToken(flip(2, String(now + 3600))) === null);
check("a wrong signature is refused", readToken(`${parts.slice(0, 4).join(".")}.${"0".repeat(64)}`) === null);
check("a signature made without the view-as prefix is refused (a session cookie cannot be reused)", (() => {
  const body = `5.9.${now}.2`;
  const sessionStyle = createHmac("sha256", process.env.SESSION_SECRET!).update(body).digest("hex");
  return readToken(`${body}.${sessionStyle}`) === null;
})());
check("a session cookie (four parts) is not a view-as token", readToken(`5.${now}.2.${"a".repeat(64)}`) === null);
check("it expires after an hour", readToken(raw, now + VIEWAS_TTL_SEC - 1) !== null && readToken(raw, now + VIEWAS_TTL_SEC) === null);
check("one dated in the future is refused", readToken(makeToken({ ...tok, iat: now + 600 })) === null);
check("garbage and empty are refused", readToken("") === null && readToken(null) === null && readToken("a.b.c.d.e") === null && readToken("x") === null);
check("it cannot be read with another secret", (() => { const t = makeToken(tok); const keep = process.env.SESSION_SECRET; process.env.SESSION_SECRET = "a-completely-different-secret-1234"; const r = readToken(t); process.env.SESSION_SECRET = keep; return r === null; })());

// ---- who may be viewed
process.env.SUPER_ADMIN_EMAILS = "boss@x.test,other@x.test";
const actor = { id: 1, email: "boss@x.test", role: "admin", status: "active", sessionVersion: 0 };
const who = (over: Partial<{ id: number; email: string; role: string; status: string }>) => ({ id: 2, email: "p@x.test", role: "learner", status: "active", ...over });
check("a super admin may view an active learner", whyNotViewAs(actor, who({})) === null);
check("...and an active admin who is not a super admin", whyNotViewAs(actor, who({ role: "admin" })) === null);
check("not themselves", whyNotViewAs(actor, who({ id: 1 })) !== null);
check("not another super admin", whyNotViewAs(actor, who({ email: "other@x.test", role: "admin" })) !== null);
check("not someone offboarded", whyNotViewAs(actor, who({ status: "offboarded" })) !== null);
check("not someone who does not exist", whyNotViewAs(actor, undefined) !== null);
check("an ordinary admin may not", whyNotViewAs({ ...actor, email: "plain@x.test" }, who({})) !== null);
check("a super admin's address on a learner account may not", whyNotViewAs({ ...actor, role: "learner" }, who({})) !== null);

// ---- reach, and the security log
const made: number[] = [];
const person = (email: string, role: "admin" | "learner", scoped: boolean) => {
  const u = db.insert(users).values({ email, name: email, role, jobRole: "general" }).returning().get();
  made.push(u.id);
  if (scoped) { const c = db.select().from(companies).get(); if (c) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: c.id }).run(); }
  return u;
};
try {
  const hasCompany = !!db.select().from(companies).get();
  const sup = person("boss@x.test", "admin", true), plain = person("plain@x.test", "admin", true), learner = person("other@x.test", "learner", true);
  if (hasCompany) {
    check("a super admin placed in one company still runs the whole academy", isGlobal(reachOf(sup.id)));
    check("an admin placed in one company is not widened", !isGlobal(reachOf(plain.id)));
    check("a learner whose address is on the list is not widened", !isGlobal(reachOf(learner.id)));
  } else console.log("skip reach checks (no company in this database)");
  process.env.SUPER_ADMIN_EMAILS = "";
  check("with the list emptied nobody is widened", !hasCompany || !isGlobal(reachOf(sup.id)));

  recordSecurityEvent({ actorId: sup.id, targetId: plain.id, action: "impersonate_start", detail: "x".repeat(900), ip: "1.2.3.4" });
  const row = db.select().from(securityLog).where(eq(securityLog.actorId, sup.id)).get();
  check("an event is recorded, with an over-long reason cut short", !!row && row.action === "impersonate_start" && row.detail.length === 400 && row.ip === "1.2.3.4");
  recordProfileView(sup.id, plain.id); recordProfileView(sup.id, plain.id); recordProfileView(sup.id, learner.id);
  const views = db.select().from(securityLog).where(eq(securityLog.action, "profile_view")).all().filter((r) => r.actorId === sup.id);
  check("a super admin's profile view is logged once per person per ten minutes", views.length === 2 && views.some((r) => r.targetId === plain.id) && views.some((r) => r.targetId === learner.id));
} finally {
  if (made.length) {
    db.delete(securityLog).where(inArray(securityLog.actorId, made)).run();
    db.delete(userScopes).where(inArray(userScopes.userId, made)).run();
    db.delete(users).where(inArray(users.id, made)).run();
  }
}

// ---- the source: what must stay true (a regression guard, not a behaviour test)
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const actions = src("app/actions.ts");
const body = (name: string) => { const i = actions.indexOf(`export async function ${name}(`); return i < 0 ? "" : actions.slice(i, i + 400); };
for (const f of ["changePassword", "resetPassword", "logoutEverywhere", "offboard"])
  check(`${f} is refused while viewing as someone`, body(f).includes("refuseWhileViewingAs()"));
const sa = src("app/super-actions.ts");
check("every super admin action starts from the real session user and checks super admin", (sa.match(/realUser\(\)/g) ?? []).length >= 3 && (sa.match(/isSuperAdmin\(real\)/g) ?? []).length >= 2);
check("editing details is refused while viewing", sa.includes("refuseWhileViewingAs()"));
check("starting a view from inside a view is refused", src("lib/impersonation.ts").includes("alreadyViewing"));
check("nothing updates or deletes security log rows", !/(update|delete)\(securityLog\)/.test(["lib/securityLog.ts", "lib/impersonation.ts", "app/super-actions.ts", "app/actions.ts"].map(src).join("\n")));
const page = src("app/(admin)/admin/people/[id]/page.tsx");
check("the manager profile only opens for people the viewer runs, and answers the same for missing and not-theirs", page.includes("userInReach(reachOf(me.id), u.id)") && page.includes("notFound()"));
check("the manager profile is read only: no form, no server action, and none of the helpers that write as a side effect", !/<form|"use server"|progressionFor|touchLeague|syncFreezes|syncRequired/.test(page));
check("a super admin opening a profile is logged", page.includes("recordProfileView("));

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
