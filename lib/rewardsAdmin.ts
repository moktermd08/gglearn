import { eq } from "drizzle-orm";
import { z } from "zod";
import { brands, db, rewardAwards, rewardRules, tracks } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";
import { CURRENCIES } from "@/lib/competitions-shared";
import { toMinor } from "@/lib/contests";
import { notify } from "@/lib/notifications";
import { MAX_AWARDS, MAX_MONEY_MINOR, MAX_XP, describe } from "@/lib/rewards";
import { reachOf, scopeInReach, trackInReach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";

type Me = { id: number; role: "admin" | "manager" | "learner" };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** May this admin set rewards at this scope? Only for companies, brands and tracks they run. */
function scopeAllowed(me: Me, scope: "company" | "brand" | "track", refId: number): boolean {
  const reach = reachOf(me.id);
  if (scope === "company") return scopeInReach(reach, { kind: "company", id: refId });
  if (scope === "brand") {
    const b = db.select().from(brands).where(eq(brands.id, refId)).get();
    return !!b && b.kind === "company" && scopeInReach(reach, { kind: "brand", id: b.id });
  }
  const t = db.select().from(tracks).where(eq(tracks.id, refId)).get();
  return !!t && trackInReach(reach, t);
}

const RULE = z.object({
  scope: z.enum(["company", "brand", "track"]),
  refId: z.coerce.number().int().positive(),
  level: z.coerce.number().int().min(1).max(MAX_LEVEL),
  kind: z.enum(["certificate", "xp", "voucher", "money"]),
  enabled: z.enum(["on", "off"]),
});

/** Adds or changes the rule for one (scope, level, kind). Money and vouchers must carry a budget cap, so a policy can never promise more than was approved. */
export function saveRule(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can set rewards." };
  const p = RULE.safeParse({ scope: str(fd.get("scope")), refId: fd.get("refId"), level: fd.get("level"), kind: str(fd.get("kind")), enabled: str(fd.get("enabled")) || "on" });
  if (!p.success) return { error: `Pick where it applies, a level from 1 to ${MAX_LEVEL} and what it gives.` };
  const r = p.data;
  if (!scopeAllowed(me, r.scope, r.refId)) return { error: "You can only set rewards for a company, brand or track you run." };

  let amount = 0, currency = "", label = str(fd.get("label")).slice(0, 120), maxAwards = Number(str(fd.get("maxAwards")) || 0);
  if (!Number.isInteger(maxAwards) || maxAwards < 0 || maxAwards > MAX_AWARDS) return { error: `The limit must be a whole number up to ${MAX_AWARDS.toLocaleString("en-GB")}.` };
  if (r.enabled === "off") { label = ""; maxAwards = 0; }
  else if (r.kind === "xp") {
    amount = Number(str(fd.get("amount")));
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_XP) return { error: `Bonus XP must be a whole number from 1 to ${MAX_XP.toLocaleString("en-GB")}.` };
  } else if (r.kind === "money") {
    amount = toMinor(str(fd.get("amount")));
    currency = str(fd.get("currency")).toUpperCase();
    if (!Number.isFinite(amount) || amount < 1 || amount > MAX_MONEY_MINOR) return { error: `The amount must be more than 0 and at most ${(MAX_MONEY_MINOR / 100).toLocaleString("en-GB")}.` };
    if (!(currency in CURRENCIES)) return { error: "Pick a currency." };
    if (maxAwards < 1) return { error: "Set a limit on how many people can earn this, so the total cost is capped." };
  } else if (r.kind === "voucher") {
    if (!label) return { error: "Say what the voucher is for." };
    if (maxAwards < 1) return { error: "Set a limit on how many vouchers can be given." };
  }

  const values = { ...r, amount, currency, label, maxAwards, createdBy: me.id };
  db.insert(rewardRules).values(values).onConflictDoUpdate({
    target: [rewardRules.scope, rewardRules.refId, rewardRules.level, rewardRules.kind],
    set: { enabled: r.enabled, amount, currency, label, maxAwards, createdBy: me.id },
  }).run();
  return { done: r.enabled === "off" ? `Switched off ${r.kind} at level ${r.level} here.` : `Saved: ${r.kind} at level ${r.level}.` };
}

export function removeRule(me: Me, id: number): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can set rewards." };
  const rule = db.select().from(rewardRules).where(eq(rewardRules.id, id)).get();
  if (!rule || !scopeAllowed(me, rule.scope, rule.refId)) return { error: "You can only change rewards for something you run." };
  db.delete(rewardRules).where(eq(rewardRules.id, id)).run(); // awards already given stay in the ledger
  return { done: "Removed. Awards already given are kept." };
}

/** Marks a pending voucher or money award as paid (with how: a code or reference) or void. The company pays outside gglearn. */
export function settleAward(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can settle rewards." };
  const id = Number(fd.get("awardId")), to = str(fd.get("to")), reference = str(fd.get("reference")).slice(0, 200);
  if (to !== "fulfilled" && to !== "void") return { error: "Choose fulfilled or void." };
  const award = Number.isInteger(id) ? db.select().from(rewardAwards).where(eq(rewardAwards.id, id)).get() : undefined;
  const track = award && db.select().from(tracks).where(eq(tracks.id, award.trackId)).get();
  if (!award || !track || !trackInReach(reachOf(me.id), track)) return { error: "You can only settle rewards for content you run." };
  if (award.status !== "pending") return { error: "That reward is already settled." };
  if (to === "fulfilled" && !reference) return { error: "Say how it was sent (a voucher code or a payment reference)." };
  db.update(rewardAwards).set({ status: to, reference, settledBy: me.id, settledAt: Math.floor(Date.now() / 1000) }).where(eq(rewardAwards.id, id)).run();
  if (to === "fulfilled") notify(award.userId, { key: `reward-paid-${award.id}`, kind: "system", title: `Sent: ${describe(award)}`, body: reference, href: "/rewards" });
  return { done: to === "fulfilled" ? "Marked as sent." : "Marked as void." };
}
