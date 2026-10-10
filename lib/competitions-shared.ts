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
