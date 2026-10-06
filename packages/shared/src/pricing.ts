import type { Product } from "./index.js";

/** Flat price of each extra 10 minutes. Set in Admin; 0 means "not set yet". */
export interface ExtraRates {
  washCentsPer10: number;
  dryCentsPer10: number;
}

export const NO_EXTRA_RATES: ExtraRates = { washCentsPer10: 0, dryCentsPer10: 0 };

/** Price of extra minutes on a washer or dryer. */
export const extraChargeCents = (rates: ExtraRates, kind: "washer" | "dryer", minutes: number): number =>
  Math.round(((kind === "washer" ? rates.washCentsPer10 : rates.dryCentsPer10) * Math.max(0, minutes)) / 10);

/**
 * Split a package price across its programs so the loads add up to exactly the package price.
 * Shares follow each program's own price; if none have prices, the split is equal.
 * Any leftover cent goes to the first load.
 */
export function allocatePackagePrice(priceCents: number, programs: Pick<Product, "priceCents">[]): number[] {
  if (programs.length === 0) return [];
  const weights = programs.map((p) => Math.max(0, p.priceCents));
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = sum > 0 ? weights.map((w) => Math.floor((priceCents * w) / sum)) : programs.map(() => Math.floor(priceCents / programs.length));
  shares[0] += priceCents - shares.reduce((a, b) => a + b, 0);
  return shares;
}
