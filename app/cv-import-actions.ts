"use server";
import { revalidatePath } from "next/cache";
import { actingUser, logViewAsUse } from "@/lib/auth";
import { IMPORT_LIMITS, readFiles, type Parsed } from "@/lib/cv/import";
import { applyImport } from "@/lib/cv/importApply";
import { allowed, hit } from "@/lib/rate-limit";

/**
 * Importing a CV the person already has (lib/cv/import.ts). Two steps, so nothing is saved until they have seen it: READ a file or files into a
 * preview, then APPLY what they ticked. Both work as the person (or a super admin through a view, which is logged under the super admin). An upload
 * is untrusted input: it is size-limited here, read as plain text, and everything in it is cleaned again when applied.
 */
export type ImportState = { error?: string; done?: string; parsed?: Parsed } | null;
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function importer(what: string) {
  const a = await actingUser();
  if (!a) return null;
  const key = `cv-import:${a.me.id}`;
  if (!allowed(key, 30)) return null;
  hit(key, 60 * 60 * 1000);
  await logViewAsUse(a.viewedBy, a.me, what);
  return a.me;
}

/** Step 1: read the file or files into a preview. Saves nothing. */
export async function parseImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const me = await importer("parseImportAction");
  if (!me) return { error: "You cannot do that right now. Please try again in a little while." };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose a file first." };
  if (files.length > IMPORT_LIMITS.files) return { error: `Choose at most ${IMPORT_LIMITS.files} files.` };
  if (files.some((f) => f.size > IMPORT_LIMITS.fileBytes) || files.reduce((n, f) => n + f.size, 0) > IMPORT_LIMITS.totalBytes) return { error: "Those files are too large. A CV file is normally well under 1 MB." };
  const read = readFiles(await Promise.all(files.map(async (f) => ({ name: f.name.slice(0, 120), text: await f.text() }))));
  return "error" in read ? { error: read.error } : { parsed: read };
}

/** Step 2: save what was ticked. */
export async function applyImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const me = await importer("applyImportAction");
  if (!me) return { error: "You cannot do that right now. Please try again in a little while." };
  const raw = text(fd.get("payload"));
  if (!raw || raw.length > 600_000) return { error: "There was nothing to import." };
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return { error: "That could not be read. Please start again." }; }
  const r = applyImport(me.id, payload);
  if ("error" in r) return { error: r.error };
  revalidatePath("/profile/cv");
  const bits = [r.added ? `${r.added} ${r.added === 1 ? "item" : "items"} added` : "", r.profile.length ? "profile details updated" : "", r.skipped ? `${r.skipped} skipped (already there, or over the limit)` : ""].filter(Boolean);
  return { done: `Done: ${bits.join(", ")}.` };
}
