import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, userAvatars } from "@/lib/db";
import { currentUser } from "@/lib/auth";

/** Looks a person can give themselves or their rival. "default" is the hand-drawn fighter (you) or robot (rival). */
export const LOOKS = [
  "default", "cat", "dog", "rabbit", "bird", "fish", "turtle", "bot", "ghost", "rocket", "flame", "zap",
  "crown", "gem", "skull", "sparkles", "swords", "shield", "mountain", "sun",
] as const;
export type Look = (typeof LOOKS)[number] | "photo";

export const isLook = (v: unknown): v is (typeof LOOKS)[number] => typeof v === "string" && (LOOKS as readonly string[]).includes(v);

export type Looks = { me: Look; rival: Look; photoUrl: string | null; signedIn: boolean };

/** Who the viewer picked to be, and who they picked to race. Signed-in people keep it on their account; guests keep it in a cookie. */
export async function avatarLooks(): Promise<Looks> {
  const user = await currentUser();
  if (user) {
    const photo = db.select({ v: userAvatars.updatedAt }).from(userAvatars).where(eq(userAvatars.userId, user.id)).get();
    const photoUrl = photo ? `/api/avatar/${user.id}?v=${photo.v}` : null;
    const me = user.avatarMe === "photo" && photoUrl ? "photo" : isLook(user.avatarMe) ? user.avatarMe : "default";
    return { me, rival: isLook(user.avatarRival) ? user.avatarRival : "default", photoUrl, signedIn: true };
  }
  const jar = await cookies();
  const pick = (k: string) => { const v = jar.get(k)?.value; return isLook(v) ? v : "default"; };
  return { me: pick("gg_av_me"), rival: pick("gg_av_rival"), photoUrl: null, signedIn: false };
}
