/**
 * Who is a super admin. Not a flag in the database: a list of email addresses in the server's environment (SUPER_ADMIN_EMAILS, comma
 * separated), so it can only be changed by someone who can change the server's configuration. Nothing inside the app, no database row
 * and no form can grant it.
 *
 * Being on the list is not enough on its own: the account must exist, be an active admin, and be signed in with a valid session. So an
 * address on the list that nobody has registered yet gives nothing to whoever registers it first (they would be a learner).
 *
 * A super admin runs the whole academy (lib/tenancy.ts), may edit any account's details, and may view the app as another person
 * (lib/impersonation.ts). Two super admins cannot view as each other.
 */
export const superAdminEmails = (): Set<string> =>
  new Set((process.env.SUPER_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

export type Identity = { email: string; role: string; status: string };

export function isSuperAdmin(u: Identity | null | undefined, list: Set<string> = superAdminEmails()): boolean {
  return !!u && u.role === "admin" && u.status === "active" && list.has(u.email.toLowerCase());
}
