"use server";

import { redirect } from "next/navigation";
import { unsubscribeRoute } from "@/lib/routeReminders";

/** Stops the weekly route email for the plan the link belongs to. No sign-in needed: the signed link is the proof, as in the email's footer. */
export async function unsubscribeRouteEmail(token: string) {
  unsubscribeRoute(token);
  redirect(`/unsubscribe/route/${token}?done=1`);
}
