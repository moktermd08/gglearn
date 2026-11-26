"use client";
import { useEffect } from "react";

export const savedAnswersKey = (examId: number) => `gg-term-check-${examId}`;

/** Shown with a result: the answers kept in this browser while sitting the check are no longer needed. Not before, so a send that fails loses nothing. */
export function ForgetSavedAnswers({ examId }: { examId: number }) {
  useEffect(() => { try { window.localStorage.removeItem(savedAnswersKey(examId)); } catch { /* nothing was kept */ } }, [examId]);
  return null;
}
