"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { templateBySlug } from "@/content/build/projects";
import { GithubError, parseRepo, parseSite } from "@/lib/build/github";
import { createProject, deleteProject, projectFor, projectsFor, setLinks, tickSelf, untickSelf, verify } from "@/lib/build/progress";

export type BuildState = { error?: string; message?: string } | null;

const MAX_PROJECTS = 10;
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

const startSchema = z.object({
  template: z.string().refine((s) => !!templateBySlug(s), "Choose a project to start from."),
  name: z.string().min(2, "Give your product a name of at least 2 characters.").max(60, "Keep the name under 60 characters."),
  pitch: z.string().max(200, "Keep the one-line description under 200 characters."),
  customer: z.string().max(120, "Keep \"who it is for\" under 120 characters."),
});

/** Starts a project from one of the starting points, or from the person's own idea. */
export async function startProject(fd: FormData) {
  const me = await requireUser();
  const p = startSchema.safeParse({ template: str(fd.get("template")), name: str(fd.get("name")), pitch: str(fd.get("pitch")), customer: str(fd.get("customer")) });
  if (!p.success) redirect(`/build?error=${encodeURIComponent(p.error.issues[0].message)}`);
  if (p.data.template === "custom" && p.data.pitch.length < 10) redirect(`/build?error=${encodeURIComponent("For your own idea, say in a sentence what it does and who for.")}`);
  if (projectsFor(me.id).length >= MAX_PROJECTS) redirect(`/build?error=${encodeURIComponent(`You can have ${MAX_PROJECTS} projects at once. Finish or delete one first.`)}`);
  if (!allowed(`build-new:${me.id}`, 10)) redirect(`/build?error=${encodeURIComponent("You have started a lot of projects just now. Try again later.")}`);
  hit(`build-new:${me.id}`, 60 * MINUTE);
  const t = templateBySlug(p.data.template)!;
  const made = createProject(me.id, { templateSlug: t.slug, name: p.data.name, pitch: p.data.pitch || t.pitch, customer: p.data.customer || t.customer });
  revalidatePath("/build");
  redirect(`/build/${made.id}`);
}

/** Saves the GitHub repository and the live address. Either may be left empty and added later. */
export async function saveLinks(projectId: number, _: BuildState, fd: FormData): Promise<BuildState> {
  const me = await requireUser();
  const p = projectFor(me.id, projectId);
  if (!p) return { error: "That project was not found." };
  const repoText = str(fd.get("repo"));
  const siteText = str(fd.get("site"));
  const repo = repoText ? parseRepo(repoText) : null;
  if (repoText && !repo) return { error: "That does not look like a GitHub repository. Use the form owner/name, or paste the address from your browser (https://github.com/owner/name)." };
  const site = siteText ? parseSite(siteText) : null;
  if (siteText && !site) return { error: "The live address must start with https:// and be a real website address (not localhost)." };
  setLinks(p, repo, site ? site.toString() : null);
  revalidatePath(`/build/${p.id}`);
  return { message: "Saved." };
}

/** Reads the repository on GitHub and ticks every step it can prove. Limited per person, because every check is several requests to GitHub. */
export async function checkRepo(projectId: number): Promise<BuildState> {
  const me = await requireUser();
  const p = projectFor(me.id, projectId);
  if (!p) return { error: "That project was not found." };
  if (!allowed(`build-check:${me.id}`, 20)) return { error: "You have checked a lot in the last few minutes. Make some progress on the next step, then try again." };
  hit(`build-check:${me.id}`, 10 * MINUTE);
  try {
    const { ticked, total } = await verify(p);
    revalidatePath(`/build/${p.id}`);
    return { message: `Checked your repository: ${ticked} of ${total} steps that GitHub can see are done.` };
  } catch (e) {
    if (e instanceof GithubError) return { error: e.message };
    throw e;
  }
}

/** The person says a step that is not on GitHub is done (a conversation, a first customer) and writes what happened. */
export async function markSelf(projectId: number, stepKey: string, _: BuildState, fd: FormData): Promise<BuildState> {
  const me = await requireUser();
  const p = projectFor(me.id, projectId);
  if (!p) return { error: "That project was not found." };
  const problem = tickSelf(p, stepKey, str(fd.get("note")));
  if (problem) return { error: problem };
  revalidatePath(`/build/${p.id}`);
  return { message: "Saved." };
}

export async function undoSelf(projectId: number, stepKey: string) {
  const me = await requireUser();
  const p = projectFor(me.id, projectId);
  if (!p) return;
  untickSelf(p, stepKey);
  revalidatePath(`/build/${p.id}`);
}

export async function removeProject(projectId: number) {
  const me = await requireUser();
  const p = projectFor(me.id, projectId);
  if (p) deleteProject(p);
  revalidatePath("/build");
  redirect("/build");
}
