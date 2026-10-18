import type { Level } from "@/lib/accessLevel";

export type AccessChoice = { key: Level; label: string; blurb: string };

/**
 * Access level for a new person (invite or create): learner, plus whatever the viewer may hand out. Renders nothing when there is nothing to
 * choose, so a manager who cannot grant access sees the form as before. Takes its choices as props because this runs in client forms,
 * which may not import lib/accessLevel (it reads the database).
 */
export function AccessSelect({ choices, defaultValue = "learner", className }: { choices: AccessChoice[]; defaultValue?: Level; className?: string }) {
  if (!choices.length) return null;
  const all = [{ key: "learner" as Level, label: "Learner", blurb: "Learns. No admin screens." }, ...choices];
  return (
    <select name="access" className={className} defaultValue={defaultValue} aria-label="Access level" title={all.map((c) => `${c.label}: ${c.blurb}`).join("\n")}>
      {all.map((c) => <option key={c.key} value={c.key}>Access: {c.label}</option>)}
    </select>
  );
}
