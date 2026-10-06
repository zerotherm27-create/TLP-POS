import type { Product } from "./index.js";

/** Flat price of each extra 10 minutes. Set in Admin; 0 means "not set yet". */
export interface ExtraRates {
  washCentsPer10: number;
  dryCentsPer10: number;
  /** Larger (titan) machines. Optional: when 0 or missing, the regular rate is used. */
  titanWashCentsPer10?: number;
  titanDryCentsPer10?: number;
}

export const NO_EXTRA_RATES: ExtraRates = { washCentsPer10: 0, dryCentsPer10: 0 };

/** Price of extra minutes on a washer or dryer. */
export const extraRateCents = (rates: ExtraRates, kind: "washer" | "dryer", tier: "giant" | "titan" = "giant"): number => {
  const regular = kind === "washer" ? rates.washCentsPer10 : rates.dryCentsPer10;
  const large = kind === "washer" ? rates.titanWashCentsPer10 : rates.titanDryCentsPer10;
  return tier === "titan" && large ? large : regular;
};

export const extraChargeCents = (rates: ExtraRates, kind: "washer" | "dryer", minutes: number, tier: "giant" | "titan" = "giant"): number =>
  Math.round((extraRateCents(rates, kind, tier) * Math.max(0, minutes)) / 10);

/** Package price for a machine size, or 0 when that size isn't offered for the package. */
export const packagePriceFor = (pkg: { priceCents?: number; titanPriceCents?: number }, tier: "giant" | "titan" = "giant"): number =>
  (tier === "titan" ? pkg.titanPriceCents : pkg.priceCents) ?? 0;

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
