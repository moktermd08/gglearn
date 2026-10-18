import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { trialQuestions, trialTrack } from "@/lib/trial";
import { topicLabel } from "@/lib/topicName";
import Runner from "./runner";

export const metadata: Metadata = { title: "Try it — gglearn", robots: { index: false, follow: true } };

// the questions are drawn fresh on every visit, so this page is never reused from a cache
export const dynamic = "force-dynamic";

export default async function TryTopic({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug, track = trialTrack(slug);
  if (!track) notFound();
  const me = await currentUser();
  return <Runner slug={slug} topic={topicLabel(track.name)} questions={trialQuestions(track.id)} signedIn={!!me} />;
}
