"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { SCOPE_COOKIE, resolveScope } from "@/lib/adminScope";

/** Switches what the admin is looking at, then comes back to the same page. A value the person may not use is ignored. */
export async function setAdminScope(fd: FormData) {
  const me = await requireManager();
  const wanted = fd.get("scope"), next = fd.get("next");
  const scope = resolveScope(me, typeof wanted === "string" ? wanted : "all");
  if (scope) (await cookies()).set(SCOPE_COOKIE, scope.value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  // only ever back into the admin, never to an address the form supplied
  redirect(typeof next === "string" && /^\/admin(\/[\w\-./[\]]*)?(\?[\w=&%.\-]*)?$/.test(next) ? next : "/admin");
}
