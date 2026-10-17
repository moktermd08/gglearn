import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Page not found — gglearn" };

/** Shown for an address that matches no page at all (the learner site and the admin each have their own not-found for the rest). */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center antialiased">
        <div className="mx-auto max-w-md space-y-4 px-4 text-center">
          <h1 className="text-2xl font-extrabold">This page is off the map</h1>
          <p className="text-slate-400">The link may be old, or the page may belong to someone else.</p>
          <Link href="/" className="btn">Back to gglearn</Link>
        </div>
      </body>
    </html>
  );
}
