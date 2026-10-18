import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { BellOff, CircleCheck } from "lucide-react";
import { db, users } from "@/lib/db";
import { userOfUnsubToken } from "@/lib/nudges";
import { unsubscribe } from "../actions";

export const metadata: Metadata = { title: "Unsubscribe — gglearn", robots: { index: false, follow: false } };

/** Asks before changing anything (a mail scanner that opens links must not unsubscribe people); the email's own one-click button uses the POST address instead. */
export default async function Unsubscribe({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const token = (await params).token, id = userOfUnsubToken(token), done = (await searchParams).done === "1";
  const on = id ? db.select({ s: users.emailNudges }).from(users).where(eq(users.id, id)).get()?.s === "on" : false;
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="card space-y-4 p-6">
        {!id ? (<><h1 className="text-xl font-extrabold">This link does not work</h1><p className="text-sm text-slate-400">Check you copied all of it. You can also switch emails off on your profile page.</p></>)
          : on ? (
            <form action={unsubscribe.bind(null, token)} className="space-y-4">
              <BellOff size={28} className="mx-auto text-slate-400" />
              <h1 className="text-xl font-extrabold">Stop the reminder and recap emails?</h1>
              <p className="text-sm text-slate-400">You will not get streak reminders or the weekly recap. Nothing else changes.</p>
              <button className="btn">Yes, unsubscribe me</button>
            </form>
          ) : (<><CircleCheck size={28} className="mx-auto text-emerald-500" /><h1 className="text-xl font-extrabold">{done ? "You are unsubscribed" : "You are not subscribed"}</h1><p className="text-sm text-slate-400">No more reminder or recap emails. You can switch them back on from your profile whenever you like.</p></>)}
        <Link href="/" className="btn btn-ghost">Back to gglearn</Link>
      </div>
    </div>
  );
}
