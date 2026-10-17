"use client";
import { useState } from "react";
import { Button } from "@gg/ui";

type Column = { key: string; label: string };
type Row = Record<string, string>;

/**
 * A list of rows with named columns (KPIs, competitors, roles). The rows are kept as JSON in one hidden field, so the enclosing form
 * submits them like any other answer; the server cleans them (lib/profile.ts cleanValue), so empty rows are dropped there.
 */
export function TableInput({ name, columns, initial, disabled }: { name: string; columns: Column[]; initial: Row[]; disabled?: boolean }) {
  const blank = (): Row => Object.fromEntries(columns.map((c) => [c.key, ""]));
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [blank()]);
  const set = (i: number, key: string, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4 }}>
          <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{c.label}</th>)}<th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => <td key={c.key}><input value={r[c.key] ?? ""} onChange={(e) => set(i, c.key, e.target.value)} maxLength={500} disabled={disabled} aria-label={c.label} style={{ width: "100%", minWidth: 110 }} /></td>)}
                <td>{!disabled && <button type="button" title="Remove this row" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }}>×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && <div><Button type="button" size="sm" variant="ghost" onClick={() => setRows((rs) => [...rs, blank()])}>Add a row</Button></div>}
    </div>
  );
}
