import type { Machine, JobOrder, Product } from "./index.js";

/** Thresholds for workflow alerts. Plain numbers so they are easy to tune in one place. */
export const ALERT_LIMITS = {
  unstartedMinutes: 10, // a load was assigned but its timer was never started
  dryerWaitMinutes: 15, // washed, but no dryer assigned yet
  offlineMinutes: 120, // a machine has been offline this long
  tubDueSoonRatio: 0.8, // "due soon" once this share of the tub-clean limit is used
} as const;

export interface MachineSuggestion {
  machine: Machine;
  suggested: boolean;
  tubDue: boolean;
}

export type AlertKind = "tub_due" | "tub_soon" | "unstarted" | "dryer_wait" | "offline";

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: "warn" | "info";
  title: string;
  detail: string;
  machineId?: string;
  orderId?: string;
}

export const loadsSinceClean = (m: Machine) => (m.cycleCount ?? 0) - (m.lastTubCleanCycle ?? 0);

export const isTubDue = (m: Machine, threshold: number) => m.kind === "washer" && loadsSinceClean(m) >= threshold;

const byCode = (a: Machine, b: Machine) => a.publicCode.localeCompare(b.publicCode, undefined, { numeric: true });

/**
 * Order the free machines of one kind, best first.
 * Washers: tub-clean-due ones go last, then fewest cycles (even out wear).
 * Dryers: fewest run minutes first. Ties go to the lowest machine code.
 */
export function rankMachines(machines: Machine[], kind: "washer" | "dryer", tubThreshold: number): MachineSuggestion[] {
  const free = machines.filter((m) => m.kind === kind && m.status === "online");
  const wear = (m: Machine) => (kind === "washer" ? m.cycleCount ?? 0 : m.totalRunMinutes ?? 0);
  const sorted = [...free].sort((a, b) => {
    const dueA = isTubDue(a, tubThreshold) ? 1 : 0;
    const dueB = isTubDue(b, tubThreshold) ? 1 : 0;
    if (dueA !== dueB) return dueA - dueB;
    if (wear(a) !== wear(b)) return wear(a) - wear(b);
    return byCode(a, b);
  });
  return sorted.map((machine, i) => ({ machine, suggested: i === 0, tubDue: isTubDue(machine, tubThreshold) }));
}

/** "W3" -> "3", "D3" -> "3". Washers and dryers with the same number are a pair (W3 goes with D3). */
export const machineNumber = (m: Machine) => m.publicCode.replace(/\D+/g, "");

export interface WasherPair {
  washer: Machine;
  dryer?: Machine; // the dryer with the same number, if one exists
  dryerFree: boolean; // that dryer is available right now
  suggested: boolean;
  tubDue: boolean;
}

/**
 * Pick the washer and its matching dryer together (W1 with D1, never W1 with D2).
 * Only free washers are listed. Washers whose partner dryer is also free come first,
 * then washers not due for a tub clean, then the least-used washer, then the least-used dryer.
 */
export function rankWasherPairs(machines: Machine[], tubThreshold: number): WasherPair[] {
  const dryers = machines.filter((m) => m.kind === "dryer");
  const rows = machines
    .filter((m) => m.kind === "washer" && m.status === "online")
    .map((washer) => {
      const dryer = dryers.find((d) => machineNumber(d) === machineNumber(washer));
      return { washer, dryer, dryerFree: !!dryer && dryer.status === "online", tubDue: isTubDue(washer, tubThreshold) };
    });
  rows.sort((a, b) => {
    if (a.dryerFree !== b.dryerFree) return a.dryerFree ? -1 : 1;
    if (a.tubDue !== b.tubDue) return a.tubDue ? 1 : -1;
    const wa = a.washer.cycleCount ?? 0, wb = b.washer.cycleCount ?? 0;
    if (wa !== wb) return wa - wb;
    const da = a.dryer?.totalRunMinutes ?? 0, db = b.dryer?.totalRunMinutes ?? 0;
    if (da !== db) return da - db;
    return byCode(a.washer, b.washer);
  });
  return rows.map((r, i) => ({ ...r, suggested: i === 0 }));
}

export interface DryerChoice {
  machine: Machine;
  suggested: boolean; // the dryer that pairs with this order's washer
  pairOf?: string; // which washer it pairs with, e.g. "W3"
}

export interface DryerPlan {
  choices: DryerChoice[];
  pairCodes: string[]; // the matching dryer codes for this order's washers, e.g. ["D3"]
  pairBusy: boolean; // the matching dryer exists but is not free, so nothing is suggested
}

/**
 * Dryer options for an order whose washer(s) are `orderWashers`. Only the dryer with the same
 * number as the washer is suggested; if it is busy nothing is suggested (no crossing to another dryer).
 * With no washer on the order, falls back to the least-used dryer.
 */
export function planDryers(machines: Machine[], orderWashers: Machine[], tubThreshold: number): DryerPlan {
  const free = machines.filter((m) => m.kind === "dryer" && m.status === "online");
  if (orderWashers.length === 0) {
    return { choices: rankMachines(machines, "dryer", tubThreshold).map((r) => ({ machine: r.machine, suggested: r.suggested })), pairCodes: [], pairBusy: false };
  }
  const numbers = new Map(orderWashers.map((w) => [machineNumber(w), w.publicCode]));
  const pairCodes = machines.filter((m) => m.kind === "dryer" && numbers.has(machineNumber(m))).map((m) => m.publicCode);
  const matching = free.filter((d) => numbers.has(machineNumber(d))).sort(byCode);
  const rest = free.filter((d) => !numbers.has(machineNumber(d))).sort(byCode);
  const choices: DryerChoice[] = [
    ...matching.map((machine, i) => ({ machine, suggested: i === 0, pairOf: numbers.get(machineNumber(machine)) })),
    ...rest.map((machine) => ({ machine, suggested: false })),
  ];
  return { choices, pairCodes, pairBusy: matching.length === 0 && pairCodes.length > 0 };
}

const minutesBetween = (fromIso: string, now: number) => Math.floor((now - Date.parse(fromIso)) / 60000);

/** Everything that needs attention right now, most urgent first. */
export function computeAlerts(
  machines: Machine[],
  orders: JobOrder[],
  products: Product[],
  tubThreshold: number,
  now: number = Date.now()
): Alert[] {
  const alerts: Alert[] = [];
  const kindOf = (productId: string) => products.find((p) => p.id === productId)?.machineKind;

  for (const m of machines) {
    if (m.kind === "washer") {
      const since = loadsSinceClean(m);
      if (since >= tubThreshold) {
        alerts.push({
          id: `tub_due:${m.id}`, kind: "tub_due", severity: "warn", machineId: m.id,
          title: `${m.publicCode} needs a tub clean`,
          detail: `${since} loads since the last clean (limit ${tubThreshold}).`,
        });
      } else if (tubThreshold > 0 && since >= Math.ceil(tubThreshold * ALERT_LIMITS.tubDueSoonRatio)) {
        alerts.push({
          id: `tub_soon:${m.id}`, kind: "tub_soon", severity: "info", machineId: m.id,
          title: `${m.publicCode} tub clean due soon`,
          detail: `${since} of ${tubThreshold} loads since the last clean.`,
        });
      }
    }

    if (m.status === "offline" && m.lastSeenAt) {
      const mins = minutesBetween(m.lastSeenAt, now);
      if (mins >= ALERT_LIMITS.offlineMinutes) {
        const h = Math.floor(mins / 60);
        alerts.push({
          id: `offline:${m.id}`, kind: "offline", severity: "info", machineId: m.id,
          title: `${m.publicCode} has been offline`,
          detail: h >= 1 ? `Offline for about ${h} hour${h === 1 ? "" : "s"}.` : `Offline for ${mins} minutes.`,
        });
      }
    }

    if (m.status === "running" && !m.startedAt && m.activeJobOrderId) {
      const order = orders.find((o) => o.id === m.activeJobOrderId);
      const assignment = order?.assignments.find((a) => a.machineId === m.id);
      if (order && assignment) {
        const mins = minutesBetween(assignment.assignedAt, now);
        if (mins >= ALERT_LIMITS.unstartedMinutes) {
          alerts.push({
            id: `unstarted:${m.id}`, kind: "unstarted", severity: "warn", machineId: m.id, orderId: order.id,
            title: `${m.publicCode} hasn't been started`,
            detail: `${order.customerName}'s load has been waiting ${mins} min — tap Start timer when it begins.`,
          });
        }
      }
    }
  }

  for (const order of orders) {
    if (order.status === "completed" || order.status === "voided") continue;
    const assigned = new Set(order.assignments.map((a) => a.lineId));
    const hasOpenDryer = order.services.some((l) => !assigned.has(l.lineId) && kindOf(l.productId) === "dryer");
    if (!hasOpenDryer) continue;
    const washes = order.assignments.filter((a) => kindOf(a.productId) === "washer");
    if (washes.length === 0 || !washes.every((a) => a.finishedAt)) continue; // still washing, or nothing washed yet
    const lastDone = Math.max(...washes.map((a) => Date.parse(a.finishedAt as string)));
    const mins = Math.floor((now - lastDone) / 60000);
    if (mins >= ALERT_LIMITS.dryerWaitMinutes) {
      alerts.push({
        id: `dryer_wait:${order.id}`, kind: "dryer_wait", severity: "warn", orderId: order.id,
        title: `${order.customerName} is waiting for a dryer`,
        detail: `Washed ${mins} min ago and no dryer assigned yet.`,
      });
    }
  }

  const rank = { warn: 0, info: 1 } as const;
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
}
