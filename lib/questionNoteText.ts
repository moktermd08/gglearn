/** The limits and words for notes on exam questions. No database here, so forms in the browser can use them too (lib/questionNotes.ts has the rules). */
export const NOTE_MAX = 500, REPLY_MAX = 300, NOTE_MIN = 3;
export const NOTE_KINDS = ["suggestion", "praise", "question"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const KIND_LABEL: Record<NoteKind, string> = { suggestion: "Suggestion", praise: "Well done", question: "Question" };
export const MAX_PER_ANSWER = 10, MAX_BY_ONE_PER_ANSWER = 3, MAX_PER_DAY = 60;
