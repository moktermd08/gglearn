import { db, roleChanges, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { rolesWithLadders } from "@/lib/careers";
import { scopesOf } from "@/lib/paths";
import { roleKey } from "@/lib/roles";

/**
 * Saying what you do now, for someone who signed up on their own. A person in a company has their role set by whoever runs their team (lib/roleChange.ts:
 * nobody changes their own role there), because it decides what they must learn and which tools they may use. Someone who signed themselves up belongs to no
 * company, has nothing required of them and has nobody to ask, so without this their career journey is a dead end.
 */
type Person = typeof users.$inferSelect;

export const mayChooseOwnRole = (u: Person): boolean => u.guest === "yes" && u.role === "learner" && u.audience === "staff" && u.status === "active" && scopesOf(u.id).length === 0;

export function chooseOwnRole(u: Person, wanted: string): { error: string } | { ok: string } {
  if (!mayChooseOwnRole(u)) return { error: "Your role is set by whoever runs your team." };
  const to = roleKey(wanted);
  if (!rolesWithLadders().includes(to)) return { error: "Choose a role from the list." };
  if (to === u.jobRole) return { ok: to };
  db.transaction((tx) => {
    tx.update(users).set({ jobRole: to }).where(eq(users.id, u.id)).run();
    // nothing is made required: only an account with no company gets here, and nothing is required of those (lib/paths.ts requirementsFor)
    tx.insert(roleChanges).values({ userId: u.id, fromRole: u.jobRole, toRole: to, kind: "role_change", note: "Chosen by the person: an account they signed up for themselves.", actions: "", decidedBy: u.id }).run();
  });
  return { ok: to };
}
