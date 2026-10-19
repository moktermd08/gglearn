import { type ProfileScope } from "@/lib/profile";
import { canEditProfile } from "@/lib/profileAdmin";
import { publishStates } from "@/lib/profilePublish";
import { type Chat, factsOf, fillLevel, storedAt } from "@/lib/questionGen";
import type { SetupState } from "@/lib/setup";

/**
 * Writes the questions for the tracks published from a profile, so an admin does not need the command line. A track is passed at its
 * `requiredLevel`, so levels 1 to that level get a batch of PER_LEVEL questions each; pressing the button again adds to any level still short.
 * Everything arrives as "review": nothing is live (and nobody is held to the track) until an admin approves it at /admin/review/<track>.
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };
export const PER_LEVEL = 10;
const PARALLEL = 4;
const running = new Set<string>(); // one run per company or brand at a time: a second click while one is going does nothing

export type Writer = Chat | null;

/** The client from the environment, or null when the server has no key. Kept out of the module top so importing this costs nothing. */
async function defaultClient(): Promise<Writer> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic() as unknown as Chat;
}

export async function writeProfileQuestions(me: Me, scope: ProfileScope, refId: number, client?: Writer): Promise<SetupState> {
  if (me.role !== "admin") return { error: "Only an admin can write questions." };
  if (!canEditProfile(me, scope, refId)) return { error: "You do not run this company or brand." };
  const writer = client === undefined ? await defaultClient() : client;
  if (!writer) return { error: "Writing questions needs ANTHROPIC_API_KEY set on the server. Ask whoever runs gglearn to add it, or write questions by hand." };
  const key = `${scope}:${refId}`;
  if (running.has(key)) return { error: "Questions are already being written for this one. Wait for it to finish." };

  const { tracks } = publishStates(scope, refId);
  const jobs = tracks.flatMap((t) => {
    const facts = factsOf(t.id);
    if (!facts) return [];
    return Array.from({ length: t.requiredLevel }, (_, i) => i + 1).filter((level) => storedAt(t.id, level) < PER_LEVEL).map((level) => ({ t, facts, level }));
  });
  if (!tracks.length) return { error: "Publish the profile to learning first: there is nothing to write questions from yet." };
  if (!jobs.length) return { done: `Every track already has ${PER_LEVEL} or more questions at each level it needs.` };

  running.add(key);
  let added = 0, failed = 0, rejected = false;
  try {
    const queue = [...jobs];
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      for (let job = queue.shift(); job && !rejected; job = queue.shift()) {
        try { added += await fillLevel(writer, job.t, job.facts, job.level, "review"); } catch (e) {
          failed++;
          const status = (e as { status?: number }).status; // a rejected key fails every later batch too, so stop
          if (status === 401 || status === 403) rejected = true;
        }
      }
    }));
  } finally { running.delete(key); }

  if (rejected) return { error: `The question writer's key was rejected${added ? `, after ${added} question${added === 1 ? "" : "s"} were saved for review` : ""}. Ask whoever runs gglearn to check ANTHROPIC_API_KEY.` };
  if (!added) return { error: failed ? "The question writer did not answer. Try again in a minute." : "Nothing new came back (the questions it wrote were repeats or were not clear enough). Try again." };
  return { done: `Wrote ${added} question${added === 1 ? "" : "s"} for review across ${new Set(jobs.map((j) => j.t.id)).size} track${new Set(jobs.map((j) => j.t.id)).size === 1 ? "" : "s"}${failed ? ` (${failed} batch${failed === 1 ? "" : "es"} failed; press again to fill the gaps)` : ""}. Approve them to make the tracks count.` };
}
