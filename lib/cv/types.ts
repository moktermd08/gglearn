/** What a CV is made of, and what a reader may be shown. No database here, so forms in the browser can use it (docs/cv/design.md). */

export const SECTION_KEYS = ["summary", "experience", "projects", "education", "certificates", "assessed", "skills", "highlights", "quotes", "volunteer", "awards", "languages", "goal"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_TITLE: Record<SectionKey, string> = {
  summary: "Profile", experience: "Experience", projects: "Projects", education: "Education", certificates: "Verified certificates", assessed: "Assessed skills",
  skills: "Other skills", highlights: "Learning record", quotes: "What reviewers say", volunteer: "Volunteering", awards: "Awards", languages: "Languages", goal: "Career goal",
};
/** One line for the person, saying what each part is. */
export const SECTION_HELP: Record<SectionKey, string> = {
  summary: "Your headline and a short summary.",
  experience: "Jobs you add by hand.", projects: "Projects you add by hand.", education: "Study you add by hand.",
  certificates: "Certificates you have earned here. Each links to a public page that proves it is real.",
  assessed: "Topics you have passed timed exams in, with the level reached.",
  skills: "Skills you list yourself.", highlights: "Levels passed, certificates held, how active you have been.",
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

export const LIMITS = { headline: 120, summary: 1200, location: 80, phone: 30, email: 120, title: 120, org: 120, body: 1500, label: 80, linkLabel: 40, url: 300, links: 6, entries: 60, activeLinks: 20, passcodeMin: 6, passcodeMax: 64 } as const;
export const LINK_KINDS = ["public", "private", "passcode"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export const TEMPLATES = [{ key: "classic", label: "Classic", help: "Plain and traditional. The safest for recruiting software." }, { key: "modern", label: "Modern", help: "A coloured header and accent headings." }, { key: "compact", label: "Compact", help: "Tighter, to fit more on a page." }] as const;
export type TemplateKey = (typeof TEMPLATES)[number]["key"];
