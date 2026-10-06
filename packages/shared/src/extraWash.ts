import type { Product } from "./index.js";

export const EXTRA_WASH_STEPS = [10, 20, 30] as const;

export interface ResolvedWash {
  lines: Product[]; // the program(s) that will actually be run
  merged: boolean; // base + extra became ONE existing program (e.g. 35 + 10 -> the 45-min program)
  note?: string; // shown on the load, e.g. "35 min + 10 min extra"
  notice?: string; // something the staff should know (no matching program)
}

/**
 * A wash with extra minutes is decided BEFORE a machine is assigned, so the machine is started with
 * the combined program. 35 min + 10 extra runs the 45-min program (with that program's own pulses).
 * If no program has that total, the extra stays a separate wash load and `notice` explains it.
 */
export function resolveWash(products: Product[], baseId: string, extraMinutes: number): ResolvedWash {
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
}
