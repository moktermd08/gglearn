/** What a CV is made of, and what a reader may be shown. No database here, so forms in the browser can use it (docs/cv/design.md). */

export const SECTION_KEYS = ["summary", "experience", "projects", "education", "certificates", "assessed", "skills", "highlights", "endorsements", "quotes", "volunteer", "awards", "languages", "goal"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_TITLE: Record<SectionKey, string> = {
  summary: "Profile", experience: "Experience", projects: "Projects", education: "Education", certificates: "Verified certificates", assessed: "Assessed skills",
  skills: "Other skills", highlights: "Learning record", endorsements: "References", quotes: "What reviewers say", volunteer: "Volunteering", awards: "Awards", languages: "Languages", goal: "Career goal",
};
/** One line for the person, saying what each part is. */
export const SECTION_HELP: Record<SectionKey, string> = {
  summary: "Your headline and a short summary.",
  experience: "Jobs you add by hand.", projects: "Projects you add by hand.", education: "Study you add by hand.",
  certificates: "Certificates you have earned here. Each links to a public page that proves it is real.",
  assessed: "Topics you have passed timed exams in, with the level reached.",
  skills: "Skills you list yourself.", highlights: "Levels passed, certificates held, how active you have been.",
  endorsements: "References written for you by a manager or mentor that you have approved.",
  quotes: "Praise from mentors and managers who let you feature it.", volunteer: "Volunteering you add by hand.", awards: "Awards you add by hand.",
  languages: "Languages you add by hand.", goal: "The role you are aiming for, and by when.",
};

export type EntryKind = "experience" | "education" | "project" | "volunteer" | "award" | "language" | "skill";
export const ENTRY_LABEL: Record<EntryKind, { one: string; many: string; section: SectionKey }> = {
  experience: { one: "job", many: "Experience", section: "experience" },
  project: { one: "project", many: "Projects", section: "projects" },
  education: { one: "course or qualification", many: "Education", section: "education" },
  volunteer: { one: "volunteering role", many: "Volunteering", section: "volunteer" },
  award: { one: "award", many: "Awards", section: "awards" },
  language: { one: "language", many: "Languages", section: "languages" },
  skill: { one: "skill", many: "Other skills", section: "skills" },
};
export const ENTRY_KIND_LIST: EntryKind[] = ["experience", "project", "education", "volunteer", "award", "language", "skill"];

/**
 * How many of each kind a CV may hold. Each kind has its own room, so a long career does not run out of space because of its skills, and
 * LIMITS.entries is only the most in all, to stop abuse.
 */
export const ENTRY_CAPS: Record<EntryKind, number> = { experience: 40, project: 30, education: 20, volunteer: 20, award: 30, language: 20, skill: 80 };
const PLURAL: Record<EntryKind, string> = { experience: "jobs", project: "projects", education: "courses or qualifications", volunteer: "volunteering roles", award: "awards", language: "languages", skill: "skills" };

/** Why one more entry of this kind cannot be added (what the person has, by kind), or null when there is room. */
export function whyNoRoom(have: Partial<Record<EntryKind, number>>, kind: EntryKind): string | null {
  const n = have[kind] ?? 0;
  if (n >= ENTRY_CAPS[kind]) return `You already have ${n} ${PLURAL[kind]}, the most a CV can hold. Remove one first.`;
  if (Object.values(have).reduce((a, b) => a + (b ?? 0), 0) >= LIMITS.entries) return `Your CV already has ${LIMITS.entries} entries, the most it can hold. Remove some first.`;
  return null;
}

export type ContactView = { email: boolean; phone: boolean; location: boolean; links: boolean };
export type View = { sections: Record<SectionKey, boolean>; contact: ContactView };

const all = (on: boolean, off: SectionKey[] = []): Record<SectionKey, boolean> => Object.fromEntries(SECTION_KEYS.map((k) => [k, on && !off.includes(k)])) as Record<SectionKey, boolean>;

/** Starting views. A link starts from one of these and the owner can change any switch. */
export const PRESETS: Record<"public" | "recruiter" | "full", { label: string; help: string; view: View }> = {
  public: { label: "Public profile", help: "Name, work, skills and certificates. No email or phone.", view: { sections: all(true, ["goal"]), contact: { email: false, phone: false, location: true, links: true } } },
  recruiter: { label: "For a recruiter", help: "Everything about your work, with your email, phone and location.", view: { sections: all(true, ["goal"]), contact: { email: true, phone: true, location: true, links: true } } },
  full: { label: "Everything", help: "Every section and every contact detail, including your career goal.", view: { sections: all(true), contact: { email: true, phone: true, location: true, links: true } } },
};
export type PresetKey = keyof typeof PRESETS;

export const LIMITS = { headline: 120, summary: 1200, location: 80, phone: 30, email: 120, title: 120, org: 120, body: 1500, label: 80, linkLabel: 40, url: 300, links: 6, entries: 200, activeLinks: 20, passcodeMin: 6, passcodeMax: 64 } as const;
export const LINK_KINDS = ["public", "private", "passcode"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export const TEMPLATES = [{ key: "classic", label: "Classic", help: "Plain and traditional. The safest for recruiting software." }, { key: "modern", label: "Modern", help: "A coloured header and accent headings." }, { key: "compact", label: "Compact", help: "Tighter, to fit more on a page." }] as const;
export type TemplateKey = (typeof TEMPLATES)[number]["key"];

/** What an endorsement may say. */
export const ENDORSE = { min: 60, max: 800, context: 120, shown: 5, perDay: 20, reaskDays: 30 } as const;
export const RELATIONSHIP_LABEL = { manager: "Manager", mentor: "Mentor" } as const;

/** What a reviewer's comment on a CV may say, and how many they may leave. */
export const CV_COMMENT = { min: 3, max: 600, reply: 300, perItem: 5, perDay: 40 } as const;
export const CV_REVIEW_VIEW: View = { sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, true])) as View["sections"], contact: { email: false, phone: false, location: false, links: false } };

/**
 * A career break is a line in Experience with dates and, if the person wants, a plain reason: so a gap is shown as a gap, not left for a reader to
 * wonder about and not dressed up as a job. The first has no reason at all; saying why is always the person's choice.
 */
export const BREAK_REASONS = [
  "Career break", "Career break: caring responsibilities", "Career break: family", "Career break: health and recovery",
  "Career break: study or training", "Career break: travel", "Career break: relocation", "Career break: redundancy and looking for work",
] as const;
export const isCareerBreak = (title: string) => title === "Career break" || title.startsWith("Career break: ");
