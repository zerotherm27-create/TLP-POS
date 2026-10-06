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
