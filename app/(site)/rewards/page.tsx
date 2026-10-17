import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Gift } from "lucide-react";
import { db, rewardAwards, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { describe } from "@/lib/rewards";

export const metadata = { title: "My rewards — gglearn" };
export const dynamic = "force-dynamic";

const STATUS = { granted: ["Added", "text-emerald-300"], pending: ["Your company will send it", "text-amber-300"], fulfilled: ["Sent", "text-emerald-300"], void: ["Cancelled", "text-slate-400"] } as const;

/** What you have earned from passing levels. Certificates are on your profile; this lists bonus XP, vouchers and money. */
export default async function MyRewards() {
  const me = await requireUser();
  const rows = db.select({ a: rewardAwards, track: tracks.name }).from(rewardAwards).innerJoin(tracks, eq(tracks.id, rewardAwards.trackId))
    .where(eq(rewardAwards.userId, me.id)).orderBy(desc(rewardAwards.createdAt)).all().filter((r) => r.a.kind !== "certificate");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Gift} title="My rewards" sub="What you have earned by passing levels. Vouchers and money are sent by the company that runs the course." />
      {rows.length === 0 ? (
        <p className="card p-5 text-sm text-slate-400">Nothing yet. When a course you take offers a reward, it shows up here. <Link href="/dashboard" className="underline">Back to your quest</Link></p>
      ) : (
        <div className="card divide-y divide-black/5">
          {rows.map(({ a, track }) => {
            const [label, tone] = STATUS[a.status];
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <b className="min-w-48 capitalize">{describe(a)}</b>
                <span className="text-slate-400">{track} · level {a.level} · {new Date(a.createdAt * 1000).toISOString().slice(0, 10)}</span>
                <span className={`ml-auto ${tone}`}>{label}{a.status === "fulfilled" && a.reference ? ` · ${a.reference}` : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
