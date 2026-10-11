import { eq } from "drizzle-orm";
import { db, enrollments, tracks, userAvatars } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Competitor } from "@/components/Competitor";
import { Flame, Mail, Mountain, Shield, Sparkles, Trash2, UserRound, Swords } from "lucide-react";
import { activityFor, trackStats } from "@/lib/stats";
import { AreaChart, Heatmap, PageHero, PALETTE, StatTile } from "@/components/charts";
import { removePhoto } from "./actions";
import PhotoForm from "./photo-form";

export const metadata = { title: "Your profile — gglearn" };

export default async function Profile() {
  const me = await requireUser();
  const photo = db.select({ v: userAvatars.updatedAt }).from(userAvatars).where(eq(userAvatars.userId, me.id)).get();
  const mine = db.select({ e: enrollments, t: tracks }).from(enrollments).innerJoin(tracks, eq(tracks.id, enrollments.trackId)).where(eq(enrollments.userId, me.id)).all()
    .map(({ e, t }) => ({ t, s: trackStats(me.id, t, e.startedAt) }));
  const stats = [
    { Icon: Sparkles, label: "Total XP", value: mine.reduce((a, m) => a + m.s.xp, 0), cls: "text-sky-300" },
    { Icon: Flame, label: "Best streak", value: Math.max(0, ...mine.map((m) => m.s.streak)), cls: "text-orange-400" },
    { Icon: Mountain, label: "Levels passed", value: mine.reduce((a, m) => a + m.s.passed, 0), cls: "text-violet-300" },
    { Icon: Swords, label: "Topics", value: mine.length, cls: "text-pink-300" },
  ];
  const activity = activityFor(me.id, 24);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHero Icon={UserRound} title="Your profile" sub="Your photo, your numbers, and how steadily you have been learning." />
      <section className="card pop flex flex-wrap items-center gap-6 p-6">
        <Competitor isBot={false} seed={`u${me.id}`} name={me.name} size={112} photoUrl={photo ? `/api/avatar/${me.id}?v=${photo.v}` : null} />
        <div className="min-w-0 flex-1 space-y-3">
          <div><div className="text-lg font-bold">{me.name}</div><div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400"><Mail size={13} />{me.email}</div></div>
          <p className="flex gap-2 text-sm text-slate-300">
            <Shield size={16} className="mt-0.5 shrink-0 text-emerald-300" /><span>A photo is optional. Without one you get a generated face. In contests, colleagues see your photo; strangers see it only if you play in a <b>public</b> contest.
            JPEG, PNG or WebP, up to 300 KB.</span>
          </p>
          <PhotoForm />
          {photo && <form action={removePhoto}><button className="inline-flex items-center gap-1 text-sm text-slate-400 underline"><Trash2 size={13} />Remove my photo</button></form>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ Icon, label, value }, i) => <StatTile key={label} i={i} Icon={Icon} label={label} value={value} color={[PALETTE.sky, "#ea580c", PALETTE.violet, PALETTE.pink][i]} />)}
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Learning rhythm</h2>
        <AreaChart data={activity.slice(-30).map((d) => ({ label: d.day.slice(5), value: d.value }))} color={PALETTE.emerald} />
        <Heatmap days={activity} />
      </section>
    </div>
  );
}
