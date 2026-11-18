import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { db, users } from "@/lib/db";
import { realUser, requireManager } from "@/lib/auth";
import { EmptyState, PageHero } from "@/components/charts";
import { DoctorReading, hasReading } from "@/components/DoctorReading";
import { diagnose } from "@/lib/careerDoctor";
import { momentumFor } from "@/lib/careerMomentum";
import { othersFor } from "@/lib/careerOthers";
import { recordProfileView } from "@/lib/securityLog";
import { isSuperAdmin } from "@/lib/superAdmin";
import { clientIp } from "@/lib/rate-limit";
import { reachOf, userInReach } from "@/lib/tenancy";

export const metadata = { title: "Career doctor reading — gglearn admin" };

/**
 * A person's Career doctor reading as a reference for the manager who runs them: their fit and how consistently they keep at each field, and
 * nothing to press. It reads only (nothing here takes a test, sets a goal or changes a record). What other people said is shown as counts only (how many
 * people praised them, promotions, approved references), never their words, because exam notes and CV comments are private between the writer and the
 * person. Only for people this viewer runs; a super admin's visit is logged, as on the person page.
 */
export default async function PersonDoctor({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireManager();
  const id = Number((await params).id);
  const u = Number.isInteger(id) ? db.select().from(users).where(eq(users.id, id)).get() : undefined;
  if (!u || !userInReach(reachOf(me.id), u.id)) notFound(); // the same answer for "no such person" and "not yours", so ids cannot be probed
  const real = await realUser();
  if (real && isSuperAdmin(real)) recordProfileView(real.id, u.id, await clientIp());

  const d = diagnose(u), first = u.name.split(" ")[0];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/admin/people/${u.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"><ArrowLeft size={14} />Back to {u.name}</Link>
      <PageHero Icon={Stethoscope} tone="violet" title={`Career doctor: ${u.name}`} sub="A reference reading of what their results show and how consistently they keep at each field. It is read-only, and it is not a judgement of the value they add at work." />
      {hasReading(d)
        ? <DoctorReading d={d} mom={momentumFor(u, d)} jobRole={u.jobRole} reader={{ kind: "manager", first, others: othersFor(u, d) }} />
        : <EmptyState Icon={Stethoscope} title="No results to read yet" tone="violet"><p className="text-sm text-slate-600">{first} has not taken a placement check or passed an exam in an area that careers ask for.</p></EmptyState>}
    </div>
  );
}
