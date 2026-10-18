import { Users } from "lucide-react";
import { ShareBar } from "@/components/ShareBar";
import { referralCode, referralsOf } from "@/lib/referrals";
import { siteUrl } from "@/lib/share";

/** A person's own invite link, with how many friends came through it. The badge counts a friend once they pass a level by exam. */
export async function InviteFriendsCard({ userId }: { userId: number }) {
  const url = `${await siteUrl()}/signup?ref=${referralCode(userId)}`, r = referralsOf(userId);
  return (
    <section className="card space-y-3 p-5" aria-label="Invite friends">
      <h2 className="flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-400"><Users size={17} /></span>Bring a friend</h2>
      <p className="text-sm text-slate-300">Learning is better with someone to beat. Send your link: when a friend signs up and passes a level, you earn the Recruiter badge, and more as they come.</p>
      <label className="block text-sm text-slate-400">Your link<input readOnly value={url} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
      <ShareBar url={url} text="Join me on gglearn: pick a topic, race a rival and climb from Novice to Titan." />
      <p className="text-sm text-slate-400"><b className="text-slate-700">{r.joined}</b> {r.joined === 1 ? "friend has" : "friends have"} joined through you, and <b className="text-slate-700">{r.passed}</b> {r.passed === 1 ? "has" : "have"} passed a level.</p>
    </section>
  );
}
