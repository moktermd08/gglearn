/** Checks team links: npm run check:joinlinks (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Needs SESSION_SECRET. Run db:push first. */
import { eq, like } from "drizzle-orm";
import { db, joinLinks, users } from "../lib/db";
import { claimPlace, findOpenLink, linkOf, linkPath, linkToken, stateOfLink } from "../lib/joinLinks";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => { db.delete(joinLinks).where(like(joinLinks.label, "t-%")).run(); db.delete(users).where(like(users.email, "%@link.check")).run(); };
sweep();
const t = Math.floor(Date.now() / 1000);
try {
  const boss = db.insert(users).values({ name: "boss", email: "boss@link.check", jobRole: "general", audience: "staff", passwordHash: "x" }).returning().get();
  const mk = (over: Partial<typeof joinLinks.$inferInsert> = {}) => db.insert(joinLinks).values({ label: "t-link", jobRole: "developer", scopes: "company:1", createdBy: boss.id, maxUses: 2, expiresAt: t + 3600, ...over }).returning().get();
  const l = mk();

  check("a link's token leads back to its row", linkOf(linkToken(l.id))?.id === l.id);
  check("the path carries the token", linkPath(l.id) === `/join/l/${linkToken(l.id)}`);
  check("a changed signature is refused", linkOf(`${l.id}.${"A".repeat(24)}`) === null);
  check("someone else's id with this signature is refused", linkOf(`${l.id + 1}.${linkToken(l.id).split(".")[1]}`) === null);
  check("junk is refused", ["", "1", "1.", ".x", "../x", "abc.def", `${l.id}.${"A".repeat(23)}`, "9".repeat(12) + "." + "A".repeat(24)].every((x) => linkOf(x) === null));
  check("a fresh link is open", stateOfLink(l) === "open" && findOpenLink(linkToken(l.id))?.id === l.id);

  check("the first place is taken", claimPlace(db, l.id));
  check("the second place is taken", claimPlace(db, l.id));
  check("the third is refused: the link is full", !claimPlace(db, l.id));
  const full = db.select().from(joinLinks).where(eq(joinLinks.id, l.id)).get()!;
  check("a full link says so and no longer opens", full.uses === 2 && stateOfLink(full) === "full" && findOpenLink(linkToken(l.id)) === null);

  const old = mk({ expiresAt: t - 10 });
  check("an expired link is refused", stateOfLink(old) === "expired" && !claimPlace(db, old.id) && findOpenLink(linkToken(old.id)) === null);
  const off = mk({ revokedAt: t - 1 });
  check("a switched-off link is refused", stateOfLink(off) === "revoked" && !claimPlace(db, off.id) && findOpenLink(linkToken(off.id)) === null);
  const one = mk({ maxUses: 1 });
  const results = [claimPlace(db, one.id), claimPlace(db, one.id), claimPlace(db, one.id)];
  check("a one-seat link goes to exactly one person", results.filter(Boolean).length === 1);
  check("the count never goes past the limit", db.select().from(joinLinks).where(eq(joinLinks.id, one.id)).get()!.uses === 1);
  check("switching a link off after it was shared stops it at once", (() => { const x = mk(); db.update(joinLinks).set({ revokedAt: t }).where(eq(joinLinks.id, x.id)).run(); return findOpenLink(linkToken(x.id)) === null; })());
} finally {
  sweep();
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
