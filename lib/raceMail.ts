import { eq } from "drizzle-orm";
import { competitions, db, tracks } from "@/lib/db";
import { mailConfigured, sendContestInvites } from "@/lib/mail";
import { siteUrl } from "@/lib/share";

/**
 * Emails the people with an account who were just invited to a race, when email is set up. Only existing accounts: an address nobody has
 * registered is never mailed from here, and the organiser is not told who got one (the screen reads the same either way). Failures are ignored:
 * the in-app invitation is already saved and is what the person acts on.
 */
export async function emailRaceInvites(slug: string, me: { id: number; name: string; email: string }, fresh: { id: number; email: string }[]) {
  if (!fresh.length || !mailConfigured()) return;
  const c = db.select({ id: competitions.id, title: competitions.title, trackId: competitions.trackId }).from(competitions).where(eq(competitions.slug, slug)).get();
  const topic = c ? db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, c.trackId)).get()?.n : null;
  if (!c || !topic) return;
  const base = await siteUrl();
  await sendContestInvites(me.id, fresh.map((u) => ({ to: u.email, link: `${base}/competitions/${slug}`, from: me.name, title: c.title, topic, replyTo: me.email, key: `race-invite-${c.id}-${u.id}` })));
}
