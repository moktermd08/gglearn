import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CvView } from "@/components/cv/CvView";
import { db, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { buildCv } from "@/lib/cv/build";
import { gateName, gateOpen, openLink, recordView, viewOf } from "@/lib/cv/links";
import { siteUrl } from "@/lib/share";
import { UnlockForm } from "./unlock";

export const dynamic = "force-dynamic";

const nameOf = (id: number) => db.select({ n: users.name }).from(users).where(eq(users.id, id)).get()?.n ?? "";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const link = openLink((await params).token);
  if (!link) return { title: "Not found", robots: { index: false, follow: false } };
  const locked = link.kind === "passcode";
  const open = link.kind === "public" && link.indexable; // only a public link its owner chose to let search engines list
  return { title: locked ? "CV (passcode needed)" : `${nameOf(link.userId)}: CV`, robots: open ? { index: true, follow: true } : { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * Someone reads a CV through a share link. A link that is unknown, tampered with, revoked, expired, or whose owner has left is a plain 404, the
 * same as a page that never existed. A passcode link asks for its code first. The owner looking at their own link is not counted.
 */
export default async function ReadCv({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const link = openLink(token);
  if (!link) notFound();
  if (link.kind === "passcode" && !gateOpen(link.id, (await cookies()).get(gateName(link.id))?.value)) return <UnlockForm token={token} name={nameOf(link.userId)} />;
  const doc = buildCv(link.userId, viewOf(link), await siteUrl());
  if (!doc) notFound();
  if ((await currentUser())?.id !== link.userId) recordView(link.id);
  return <CvView doc={doc} pdfHref={link.allowPdf ? `/cv/${token}/pdf` : undefined} />;
}
