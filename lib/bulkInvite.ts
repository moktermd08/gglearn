/**
 * Reads a pasted or uploaded list of people to invite. One person per line: `email` or `email, role` (a comma, semicolon or tab between the
 * two; a header line is skipped; a name or other columns are ignored so a spreadsheet export works as it is). A line that cannot be used is
 * reported with its number and why, and never stops the rest. Pure, so the rules can be tested.
 */
export const MAX_BULK = 300;

export type BulkRow = { email: string; jobRole: string };
export type BulkResult = { rows: BulkRow[]; rejected: string[]; tooMany: boolean };

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

export function parseBulk(text: string, defaultRole: string): BulkResult {
  const rows: BulkRow[] = [], rejected: string[] = [], seen = new Set<string>();
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, "").trim());
    // an export keeps the address in one column among others: take the first cell that is an address, and the role from the cell after it
    const at = cells.findIndex((c) => EMAIL.test(c));
    if (at < 0) { if (i === 0 && /email|e-mail/i.test(line)) return; rejected.push(`Line ${i + 1}: no email address found`); return; }
    const email = cells[at].toLowerCase();
    if (email.length > 120) { rejected.push(`Line ${i + 1}: ${email.slice(0, 30)}… is too long`); return; }
    if (seen.has(email)) { rejected.push(`Line ${i + 1}: ${email} is listed twice`); return; }
    const next = (cells[at + 1] ?? "").toLowerCase();
    const jobRole = next && !EMAIL.test(next) && /^[a-z][a-z0-9 &/-]{0,39}$/.test(next) ? next : defaultRole;
    seen.add(email);
    rows.push({ email, jobRole });
  });
  return { rows: rows.slice(0, MAX_BULK), rejected, tooMany: rows.length > MAX_BULK };
}
