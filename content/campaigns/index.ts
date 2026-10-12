import { ai } from "./ai";
import { careers } from "./careers";
import { general } from "./general";
import type { Row } from "./types";

export type Reward = { cash: number; split: "winner" | "top3"; note: string };
export type Campaign = { id: string; kind: "career" | "general" | "ai"; title: string; track: string; goal: number; days: number; hook: string; reward: Reward };

export const XP = "Every level you pass earns XP (150 XP per level).";
export const CERT = "Certificate for everyone who reaches the goal; Champion certificate for 1st.";

/**
 * Reward ladder, by position in each list. Certificates are the default for every contest; money is rare and capped at $100.
 * Vouchers are recorded in the note only: gglearn never holds or moves money, the organiser pays.
 */
function reward(i: number): Reward {
  if (i % 100 === 10) return { cash: 10000, split: "top3", note: `Flagship. $100 pool paid by the organiser: $50 / $30 / $20 to the top 3. ${CERT} ${XP}` };
  if (i % 20 === 7) return { cash: 3000, split: "top3", note: `$30 pool paid by the organiser: $15 / $9 / $6 to the top 3. ${CERT} ${XP}` };
  if (i % 10 === 3) return { cash: 0, split: "winner", note: `$10 Amazon voucher for 1st place, paid by the organiser. ${CERT} ${XP}` };
  if (i % 10 === 0) return { cash: 0, split: "winner", note: `$5 Amazon voucher for 1st place, paid by the organiser. ${CERT} ${XP}` };
  return { cash: 0, split: "winner", note: `${CERT} ${XP}` };
}

const build = (kind: Campaign["kind"], rows: Row[]): Campaign[] =>
  rows.map(([title, track, goal, days, hook], i) => ({ id: `${kind}-${String(i + 1).padStart(3, "0")}`, kind, title, track, goal, days, hook, reward: reward(i) }));

export const campaigns: Campaign[] = [...build("career", careers), ...build("general", general), ...build("ai", ai)];
