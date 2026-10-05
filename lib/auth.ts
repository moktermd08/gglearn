import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";

const COOKIE = "gglearn_session";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export async function startSession(userId: number) {
  const v = String(userId);
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, mac] = raw.split(".");
  if (!id || !mac) return null;
  const expected = sign(id);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const user = db.select().from(users).where(eq(users.id, Number(id))).get();
  // offboarded people lose access immediately
  return user && user.status === "active" ? user : null;
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireManager() {
  const u = await requireUser();
  if (u.role === "learner") redirect("/dashboard");
  return u;
}
