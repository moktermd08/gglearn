import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { BellOff, CircleCheck } from "lucide-react";
import { db, routeAssessments } from "@/lib/db";
import { assessmentOfUnsubToken } from "@/lib/routeReminders";
import { unsubscribeRouteEmail } from "../actions";

export const metadata: Metadata = { title: "Stop route emails — gglearn", robots: { index: false, follow: false } };

/** Asks before changing anything (a mail scanner that opens links must not unsubscribe people); the email's own one-click button uses the POST address instead. */
export default async function UnsubscribeRoute({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const token = (await params).token, id = assessmentOfUnsubToken(token), done = (await searchParams).done === "1";
  const on = id !== null && db.select({ r: routeAssessments.reminders }).from(routeAssessments).where(eq(routeAssessments.id, id)).get()?.r === "on";
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="card space-y-4 p-6">
        {id === null ? (<><h1 className="text-xl font-extrabold">This link does not work</h1><p className="text-sm text-slate-400">Check you copied all of it. You can also switch the emails off on your plan page.</p></>)
          : on ? (
            <form action={unsubscribeRouteEmail.bind(null, token)} className="space-y-4">
              <BellOff size={28} className="mx-auto text-slate-400" />
              <h1 className="text-xl font-extrabold">Stop the weekly route emails?</h1>
              <p className="text-sm text-slate-400">You will not get the weekly email about your route plan. Your plan, your progress and any other emails stay as they are.</p>
              <button className="btn">Yes, stop them</button>
            </form>
          ) : (<><CircleCheck size={28} className="mx-auto text-emerald-500" /><h1 className="text-xl font-extrabold">{done ? "The emails have stopped" : "These emails are already off"}</h1><p className="text-sm text-slate-400">No more weekly route emails. You can turn them back on from your plan page whenever you like.</p></>)}
        <Link href="/route" className="btn btn-ghost">Back to my route</Link>
      </div>
    </div>
  );
}
