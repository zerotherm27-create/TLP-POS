import { createRequire } from "module";
import { supabaseRequest } from "./_supabase.js";

const require = createRequire(import.meta.url);

/** Product list: the admin-edited one saved in settings, else the built-in defaults. */
export const loadProducts = async () => {
  try {
    const rows = await supabaseRequest("tlp_settings?key=eq.products&select=value&limit=1");
    if (Array.isArray(rows?.[0]?.value)) return rows[0].value;
  } catch {}
  return require("./_products.json");
};

/** Same rule as packages/shared/src/extraWash.ts (the browser uses that copy; keep both in step). */
export const resolveWash = (products, baseId, extraMinutes) => {
  const base = products.find((p) => p.id === baseId);
  if (!base) return { lines: [], merged: false };
  if (!extraMinutes || extraMinutes <= 0) return { lines: [base], merged: false };

  const total = base.durationMinutes + extraMinutes;
  const merged = products.find((p) => p.machineKind === "washer" && !p.isExtraTime && p.durationMinutes === total && p.id !== base.id);
  if (merged) return { lines: [merged], merged: true, note: `${base.name} + ${extraMinutes} min extra` };

  const extra = products.find((p) => p.machineKind === "washer" && p.durationMinutes === extraMinutes && p.id !== base.id);
  if (extra) {
    return {
      lines: [base, extra],
      merged: false,
      notice: `There's no ${total}-min wash program, so the extra ${extraMinutes} min was added as a separate wash load.`,
    };
  }
  return {
    lines: [base],
    merged: false,
    notice: `There's no ${total}-min wash program and no ${extraMinutes}-min one, so the extra wash was left out. Add it in Admin → Products.`,
  };
};

/** Same rules as packages/shared/src/pricing.ts (the browser uses that copy; keep both in step). */
export const extraRateCents = (rates, kind, tier = "giant") => {
  const regular = (kind === "washer" ? rates?.washCentsPer10 : rates?.dryCentsPer10) ?? 0;
  const large = kind === "washer" ? rates?.titanWashCentsPer10 : rates?.titanDryCentsPer10;
  return tier === "titan" && large ? large : regular;
};

export const extraChargeCents = (rates, kind, minutes, tier = "giant") =>
  Math.round((extraRateCents(rates, kind, tier) * Math.max(0, minutes)) / 10);

export const allocatePackagePrice = (priceCents, programs) => {
  if (programs.length === 0) return [];
  const weights = programs.map((p) => Math.max(0, p.priceCents ?? 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = sum > 0 ? weights.map((w) => Math.floor((priceCents * w) / sum)) : programs.map(() => Math.floor(priceCents / programs.length));
  shares[0] += priceCents - shares.reduce((a, b) => a + b, 0);
  return shares;
};

/** Admin-set price of each extra 10 minutes ({ washCentsPer10, dryCentsPer10 }); zeros until set. */
export const loadExtraRates = async () => {
  try {
    const rows = await supabaseRequest("tlp_settings?key=eq.extraRates&select=value&limit=1");
    const v = rows?.[0]?.value;
    if (v && Number.isInteger(v.washCentsPer10) && Number.isInteger(v.dryCentsPer10)) return v;
  } catch {}
  return { washCentsPer10: 0, dryCentsPer10: 0 };
};

/** Backup rule: loads at or above this many kg go to the larger machines (W5 / D5). Admin-editable; 10 until set. */
export const loadLargeLoadKg = async () => {
  try {
    const rows = await supabaseRequest("tlp_settings?key=eq.largeLoadKg&select=value&limit=1");
    const v = rows?.[0]?.value;
    if (typeof v === "number" && v > 0) return v;
  } catch {}
  return 10;
};
