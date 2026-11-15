import { eq } from "drizzle-orm";
import { cvComments, cvEndorsements, cvEntries, cvLinks, cvProfiles, cvQuotes, cvReviewers, db } from "@/lib/db";

/**
 * Removes a person's CV: what they typed, their share links (so every link stops working at once), the reviewers they invited and those reviewers'
 * comments, the references others wrote for them, and the praise they featured. It does not touch what the person wrote for other people (a
 * reference they gave belongs to the person it is about), the platform's own record of their exams and certificates, or anyone else's CV.
 */
export function eraseCv(userId: number) {
  return db.transaction((tx) => {
    const n = (r: { length: number }) => r.length;
    const comments = n(tx.delete(cvComments).where(eq(cvComments.userId, userId)).returning({ id: cvComments.id }).all());
    tx.delete(cvReviewers).where(eq(cvReviewers.userId, userId)).run();
    const references = n(tx.delete(cvEndorsements).where(eq(cvEndorsements.userId, userId)).returning({ id: cvEndorsements.id }).all());
    tx.delete(cvQuotes).where(eq(cvQuotes.userId, userId)).run();
    const links = n(tx.delete(cvLinks).where(eq(cvLinks.userId, userId)).returning({ id: cvLinks.id }).all());
    const entries = n(tx.delete(cvEntries).where(eq(cvEntries.userId, userId)).returning({ id: cvEntries.id }).all());
    tx.delete(cvProfiles).where(eq(cvProfiles.userId, userId)).run();
    return { entries, links, references, comments };
  });
}
