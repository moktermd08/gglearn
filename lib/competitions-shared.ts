// Pure constants shared by server and client code (no database access here).

export const CURRENCIES = { USD: "$", EUR: "€", GBP: "£", INR: "₹", BDT: "৳", CAD: "CA$", AUD: "A$" } as const;
export type Currency = keyof typeof CURRENCIES;
export const money = (minor: number, cur: string) => {
  const amount = minor / 100;
  return `${CURRENCIES[cur as Currency] ?? `${cur} `}${Number.isInteger(amount) ? amount.toLocaleString("en-US") : amount.toFixed(2)}`;
};

/** Share of the pool for each place, in basis points. */
export const PRIZE_SPLITS = { winner: [10000], top3: [5000, 3000, 2000] } as const;
export const PRIZE_SPLIT_LABEL = { winner: "Winner takes all", top3: "Top 3 share it: 50% / 30% / 20%" } as const;

/** A time taken, to the second where it matters: "48s", "14m 32s", "2h 05m", "3d 4h". Pure, so the exam clock can use it too. */
export function exact(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(r).padStart(2, "0")}s`;
  return `${r}s`;
}

/** Stopwatch style, "4:07" or "1:02:09". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
