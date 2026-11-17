import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InlineAction } from "@/components/cv/CvForms";
import { Crumbs } from "@/components/profile/Crumbs";
import { StoryForm } from "@/components/star/StoryForm";
import { deleteStoryAction } from "@/app/star-actions";
import { requireUser } from "@/lib/auth";
import { storyOf } from "@/lib/star/data";
import { BEHAVIOURS, isBehaviour } from "@/lib/star/framework";

export const metadata: Metadata = { title: "Behaviour story — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> }) {
  const me = await requireUser();
  const { id } = await params, { b } = await searchParams;
  const story = id === "new" ? null : Number.isInteger(Number(id)) ? storyOf(me.id, Number(id)) : null;
  if (id !== "new" && !story) notFound();
  const suggested = isBehaviour(b) ? b : undefined;
  const hint = suggested ? BEHAVIOURS.find((x) => x.key === suggested) : undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Crumbs trail={[{ label: "Profile", href: "/profile" }, { label: "Behaviour stories", href: "/profile/behaviours" }, { label: story ? story.title : "New story" }]} />
      <h1 className="text-2xl font-extrabold">{story ? "Edit story" : "New story"}</h1>
      {hint && <div className="card p-4 text-sm"><p className="font-semibold">Ideas for {hint.title}</p><ul className="ml-5 list-disc text-slate-600">{hint.prompts.map((p) => <li key={p}>{p}</li>)}</ul></div>}
      <div className="card p-5">
        <StoryForm suggested={suggested} init={story ?? { title: "", context: "", situation: "", task: "", action: "", result: "", behaviours: [], ready: false }} />
      </div>
      {story && <div className="text-right"><InlineAction action={deleteStoryAction} fields={{ id: story.id }} label="Delete story" tone="danger" confirm="Delete this story? Applications that used it keep their wording." /></div>}
    </div>
  );
}
