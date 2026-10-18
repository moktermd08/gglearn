import { type CatalogTrack, catalog, inScope, openTo, scopesOf } from "@/lib/paths";
import { isGlobal, reachOf } from "@/lib/tenancy";

/**
 * The topics a person may pick when starting a race or a journey. What the catalogue already leaves out (superseded and placeholder tracks) stays out;
 * on top of that: nothing without questions (a topic that cannot be taken is a dead end), nothing closed to their account type, and no other company's
 * staff-only material. Customer-facing topics and shared academy topics are open to everyone they suit. A manager or admin with no scopes runs the whole academy and sees all.
 */
export function pickableTopics(me: { id: number; role: "admin" | "manager" | "learner"; audience: "staff" | "customer" }): CatalogTrack[] {
  const owner = me.role !== "learner" && isGlobal(reachOf(me.id));
  const scopes = owner ? [] : scopesOf(me.id);
  return catalog().filter((t) =>
    t.questions > 0 && openTo(me.audience, t.audience) &&
    (owner || t.audience !== "staff" || t.brand.kind === "shared" || inScope(t, me.audience, scopes)));
}
