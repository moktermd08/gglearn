import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { brands, db, rewardAwards, rewardRules, tracks } from "@/lib/db";
import { CERT_LEVELS, MAX_LEVEL } from "@/lib/levels";
import { notify } from "@/lib/notifications";
import { issueCertificate } from "@/lib/certs";

export type Kind = "certificate" | "xp" | "voucher" | "money";
export const KINDS: Kind[] = ["certificate", "xp", "voucher", "money"];
export type Rule = typeof rewardRules.$inferSelect;
export type Award = typeof rewardAwards.$inferSelect;

export const MAX_XP = 10_000, MAX_MONEY_MINOR = 1_000_000, MAX_AWARDS = 10_000;

/**
 * What a first pass of `level` on a track earns. For each kind the most specific rule wins: the track's own, then its brand's,
 * then its company's. A rule switched "off" ends the search with nothing. With no certificate rule anywhere, the academy default
 * stands: a certificate at levels 5, 10, 15 and 20. The reward follows whoever owns the content, not the learner's own company.
 */
export function rulesFor(trackId: number, level: number): Rule[] {
  const track = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track) return [];
  const brand = db.select().from(brands).where(eq(brands.id, track.brandId)).get();
  const chain: { scope: Rule["scope"]; refId: number }[] = [{ scope: "track", refId: track.id }, { scope: "brand", refId: track.brandId }];
  if (brand?.companyId != null) chain.push({ scope: "company", refId: brand.companyId });
  const all = db.select().from(rewardRules).where(eq(rewardRules.level, level)).all();
  const out: Rule[] = [];
  for (const kind of KINDS) {
    for (const link of chain) {
      const r = all.find((x) => x.kind === kind && x.scope === link.scope && x.refId === link.refId);
      if (r) { if (r.enabled === "on") out.push(r); break; }
    }
  }
  return out;
}

/** Does the academy default (a certificate at 5, 10, 15, 20) apply at this level? Not if any rule in the chain speaks about certificates. */
export function defaultCertificate(trackId: number, level: number): boolean {
  if (!(CERT_LEVELS as readonly number[]).includes(level)) return false;
  const track = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track) return false;
  const brand = db.select().from(brands).where(eq(brands.id, track.brandId)).get();
  return !db.select().from(rewardRules).where(and(eq(rewardRules.level, level), eq(rewardRules.kind, "certificate"))).all()
    .some((r) => (r.scope === "track" && r.refId === track.id) || (r.scope === "brand" && r.refId === track.brandId) || (r.scope === "company" && brand?.companyId === r.refId));
}

const code = () => randomBytes(5).toString("hex").toUpperCase();

/**
 * Called once a level has been passed. Safe to call again: a person earns each rule's reward for a track and level once.
 * Returns the awards newly given.
 */
export function awardForPass(userId: number, trackId: number, level: number, score: number): Award[] {
  const rules = rulesFor(trackId, level);
  const given: Award[] = [];
  db.transaction((tx) => {
    if (defaultCertificate(trackId, level)) issueCertificate(tx, userId, trackId, level, score, code());
    for (const r of rules) {
      if (r.kind === "certificate") issueCertificate(tx, userId, trackId, level, score, code());
      if (r.maxAwards > 0) {
        const used = tx.select({ n: sql<number>`count(*)` }).from(rewardAwards).where(and(eq(rewardAwards.ruleId, r.id), sql`${rewardAwards.status} != 'void'`)).get()?.n ?? 0;
        if (used >= r.maxAwards) continue; // the budget for this rule is spent
      }
      const row = tx.insert(rewardAwards).values({
        userId, ruleId: r.id, trackId, level, kind: r.kind, amount: r.amount, currency: r.currency, label: r.label,
        status: r.kind === "voucher" || r.kind === "money" ? "pending" : "granted",
      }).onConflictDoNothing().returning().get();
      if (row) given.push(row);
    }
  });
  const name = db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, trackId)).get()?.n ?? "a track";
  for (const a of given) {
    if (a.kind === "certificate") continue; // the certificate already announces itself
    notify(userId, { key: `reward-${a.id}`, kind: "system", title: `You earned ${describe(a)}`, body: `${name}, level ${level}.${a.status === "pending" ? " Your company will send it to you." : ""}`, href: "/rewards" });
  }
  return given;
}

const major = (minor: number, cur: string) => `${(minor / 100).toFixed(2)} ${cur}`;
export function describe(a: Pick<Award, "kind" | "amount" | "currency" | "label">): string {
  switch (a.kind) {
    case "certificate": return "a certificate";
    case "xp": return `${a.amount} bonus XP`;
    case "voucher": return a.label ? `a voucher: ${a.label}` : "a voucher";
    case "money": return major(a.amount, a.currency);
  }
}

/** Bonus XP the person has been given, for the player level. */
export function bonusXp(userId: number): number {
  return db.select({ v: sql<number>`coalesce(sum(${rewardAwards.amount}), 0)` }).from(rewardAwards)
    .where(and(eq(rewardAwards.userId, userId), eq(rewardAwards.kind, "xp"), eq(rewardAwards.status, "granted"))).get()?.v ?? 0;
}

export const LEVEL_RANGE = { min: 1, max: MAX_LEVEL };
