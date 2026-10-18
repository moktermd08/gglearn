import { eq, like, or, sql } from "drizzle-orm";
import { checklistItems, db, enrollments, tracks, users } from "@/lib/db";
import { claimPendingInvites } from "@/lib/contests";
import { offboardingLines, onboardingLines } from "@/lib/access";
import { STARTER_SIZE, starterPlan } from "@/lib/starter";
import { hiddenTrackIds } from "@/lib/tracks";
import { type Audience, openTo, scopesOf, setScopes, syncRequired, validScopes, type Scope } from "@/lib/paths";

/** Setting people up and letting them go. Shared by the admin screens, invite and link sign-ups, and directory sync (lib/scim.ts), so every way in and out follows the same rules. */
const ONBOARDING = [
  "Read the brand story and values",
  "Meet your manager and agree your 30-60-90 goals",
  "Get access to the tools for your role",
  "Pass level 3 in your first recommended track",
  "Shadow a teammate on a real task",
];
const CUSTOMER_ONBOARDING = [
  "Read the welcome guide for your product",
  "Complete your getting-started path",
  "Tell us what you want to achieve in your first 30 days",
];
const OFFBOARDING = [
  "Write handover notes for each area you own",
  "Transfer ownership of accounts, files and customers",
  "Record answers to the 10 questions only you know",
  "Return equipment and revoke tool access",
];

type Tx = Pick<typeof db, "insert" | "select" | "update" | "delete">;

/**
 * New-joiner setup: where they belong (companies, brands, projects), an onboarding checklist, and enrolment in everything
 * they are required to pass. Staff with nothing required yet fall back to the tracks recommended for their job role.
 */
export function provision(tx: Tx, userId: number, email: string, jobRole: string, audience: Audience, scopes: Scope[]) {
  claimPendingInvites(tx, userId, email); // contests this address was invited to before it had an account
  setScopes(tx, userId, validScopes(tx, scopes));
  const steps = audience === "customer" ? CUSTOMER_ONBOARDING : ONBOARDING;
  const access = audience === "staff" ? onboardingLines(userId, jobRole) : []; // the tools this role starts with (lib/access.ts)
  tx.insert(checklistItems).values([...steps, ...access].map((label) => ({ userId, kind: "onboarding" as const, label }))).run();
  const required = syncRequired({ id: userId, jobRole, audience }, tx);
  if (audience === "staff") {
    // a role-shaped starter plan (question mix + role pillars) on top of what is required; the old open pick only if it finds nothing
    const have = new Set(tx.select({ id: enrollments.trackId }).from(enrollments).where(eq(enrollments.userId, userId)).all().map((e) => e.id));
    let rec: { id: number }[] = starterPlan({ jobRole, audience }, scopesOf(userId, tx), have, STARTER_SIZE - have.size);
    if (!rec.length && !required && !have.size) {
      const hidden = hiddenTrackIds();
      rec = tx.select().from(tracks).where(or(eq(tracks.roles, ""), like(tracks.roles, `%${jobRole}%`))).all()
        .filter((t) => !hidden.has(t.id) && openTo(audience, t.audience)).slice(0, 6);
    }
    if (rec.length) {
      tx.insert(enrollments).values(rec.map((t) => ({ userId, trackId: t.id, goal: `Onboarding path for ${jobRole}` }))).onConflictDoNothing().run();
    }
  }
}


/** Ends someone's access now: they are signed out everywhere and given the offboarding checklist (one line per tool they still hold, then the general ones). Safe to repeat. */
export function offboardUser(userId: number) {
  const u = db.select({ s: users.status }).from(users).where(eq(users.id, userId)).get();
  if (!u || u.s === "offboarded") return false;
  db.update(users).set({ status: "offboarded", sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId)).run();
  db.insert(checklistItems).values([...offboardingLines(userId), ...OFFBOARDING].map((label) => ({ userId, kind: "offboarding" as const, label }))).run();
  return true;
}

/** Brings an offboarded person back (a returning employee, or a directory that re-enabled them). Their progress was never deleted. */
export function reinstateUser(userId: number) {
  const u = db.select({ s: users.status }).from(users).where(eq(users.id, userId)).get();
  if (!u || u.s === "active") return false;
  db.update(users).set({ status: "active", sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId)).run();
  return true;
}
