import { cookies } from "next/headers";

/**
 * A message for the page a person is sent to after something did not work. It travels in a short-lived cookie scoped to that page, not in the address, so
 * addresses stay clean and nobody can make the page show their own words by sending a link.
 */
const NAME = "gg_flash";
const SECONDS = 20;

/** Call from a server action, just before redirecting to `path`. */
export async function setFlash(path: string, message: string) {
  (await cookies()).set(NAME, message.slice(0, 300), { path, maxAge: SECONDS, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

export async function readFlash(): Promise<string | null> {
  return (await cookies()).get(NAME)?.value ?? null;
}
