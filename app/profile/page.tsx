import { eq } from "drizzle-orm";
import { db, userAvatars } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Competitor } from "@/components/Competitor";
import { removePhoto } from "./actions";
import PhotoForm from "./photo-form";

export const metadata = { title: "Your profile — gglearn" };

export default async function Profile() {
  const me = await requireUser();
  const photo = db.select({ v: userAvatars.updatedAt }).from(userAvatars).where(eq(userAvatars.userId, me.id)).get();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-extrabold">Your profile</h1>
      <section className="card flex flex-wrap items-center gap-6 p-6">
        <Competitor isBot={false} seed={`u${me.id}`} name={me.name} size={112} photoUrl={photo ? `/api/avatar/${me.id}?v=${photo.v}` : null} />
        <div className="min-w-0 flex-1 space-y-3">
          <div><div className="text-lg font-bold">{me.name}</div><div className="text-sm text-slate-400">{me.email}</div></div>
          <p className="text-sm text-slate-300">
            A photo is optional. Without one you get a generated face. In contests, colleagues see your photo; strangers see it only if you play in a <b>public</b> contest.
            JPEG, PNG or WebP, up to 300 KB.
          </p>
          <PhotoForm />
          {photo && <form action={removePhoto}><button className="text-sm text-slate-400 underline">Remove my photo</button></form>}
        </div>
      </section>
    </div>
  );
}
