import { loadProducts } from "./_catalog.js";
import { changeOrder, fromJobOrderRow, supabaseRequest } from "./_supabase.js";

export const fromMachineRow = (r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  tier: r.tier ?? undefined,
  branchId: r.branch_id,
  espIp: r.esp_ip,
  publicCode: r.public_code,
  status: r.status,
  activeJobOrderId: r.active_job_order_id ?? undefined,
  customerName: r.customer_name ?? undefined,
  remainingMinutes: r.remaining_minutes ?? undefined,
  startedAt: r.started_at ?? undefined,
  lastSeenAt: r.last_seen_at,
  cycleCount: r.cycle_count,
  totalRunMinutes: r.total_run_minutes,
  lastTubCleanCycle: r.last_tub_clean_cycle,
});

const FREE = {
  status: "online",
  active_job_order_id: null,
  customer_name: null,
  remaining_minutes: null,
  started_at: null,
};

export const freeMachinePatch = () => ({ ...FREE, last_seen_at: new Date().toISOString() });

export const selectMachines = () =>
  supabaseRequest("tlp_machines?branch_id=eq.b1&order=public_code.asc");

const kindOf = (products, productId) => products.find((p) => p.id === productId)?.machineKind;

/** Washers and dryers pair by number: W1 with D1, W2 with D2 (the number at the end of the machine's code). Accepts a database row or a mapped machine. */
export const pairNumber = (machine) => {
  const m = /(\d+)\s*$/.exec(String(machine?.public_code ?? machine?.publicCode ?? ""));
  return m ? Number(m[1]) : null;
};

/**
 * The order's stage: "washing" until every washer load has ended, then "drying" once a dryer is on the order.
 * (A dryer can be queued while the washer is still running, so the last machine assigned no longer decides it.)
 */
export const computeStage = (order, products) => {
  if (order.assignments.length === 0) return "queued";
  const washerRunning = order.assignments.some((a) => kindOf(products, a.productId) === "washer" && !a.finishedAt);
  if (washerRunning) return "washing";
  return order.assignments.some((a) => kindOf(products, a.productId) === "dryer") ? "drying" : "washing";
};

/**
 * Is this dryer's load still waiting on a washer of the same order? Returns { waitingFor: "Washer 1" } or null when it can start.
 * 1. A washer on the same number (D2 with W2) decides on its own: wait until that wash has ended.
 * 2. Otherwise wait until every wash load of the order has a machine and has ended.
 * 3. An order with no wash loads (dry only) never waits.
 * `machines` are the machine rows (or mapped machines) so each washer's number and name can be found.
 */
export const dryerBlockedByWasher = (order, dryerMachine, machines, products) => {
  const washLines = order.services.filter((l) => kindOf(products, l.productId) === "washer");
  if (washLines.length === 0) return null;
  const washerOf = (a) => machines.find((m) => m.id === a.machineId);
  const nameOf = (a) => washerOf(a)?.name ?? "the washer";
  const assigned = order.assignments.filter((a) => kindOf(products, a.productId) === "washer");

  const number = pairNumber(dryerMachine);
  const paired = number == null ? undefined : assigned.find((a) => pairNumber(washerOf(a)) === number);
  if (paired) return paired.finishedAt ? null : { waitingFor: nameOf(paired) };

  const unassigned = washLines.some((l) => !order.assignments.some((a) => a.lineId === l.lineId));
  const unfinished = assigned.filter((a) => !a.finishedAt);
  if (!unassigned && unfinished.length === 0) return null;
  return { waitingFor: unfinished.length === 1 ? nameOf(unfinished[0]) : unfinished.length > 1 ? "the washers" : "the washer" };
};

/** For a machine list: which waiting dryers are queued behind their washer. Never throws; on a problem nothing is marked queued. */
export const loadQueuedDryers = async (rows) => {
  try {
    const waiting = rows.filter((r) => r.kind === "dryer" && r.status === "running" && !r.started_at && r.active_job_order_id);
    if (!waiting.length) return {};
    const ids = [...new Set(waiting.map((r) => encodeURIComponent(r.active_job_order_id)))];
    const [orderRows, products] = await Promise.all([supabaseRequest(`tlp_job_orders?id=in.(${ids.join(",")})`), loadProducts()]);
    const orders = new Map((orderRows ?? []).map((o) => [o.id, fromJobOrderRow(o)]));
    const out = {};
    for (const r of waiting) {
      const order = orders.get(r.active_job_order_id);
      const blocked = order ? dryerBlockedByWasher(order, r, rows, products) : null;
      if (blocked) out[r.id] = blocked;
    }
    return out;
  } catch (error) {
    console.error("loadQueuedDryers failed:", error instanceof Error ? error.message : error);
    return {};
  }
};

/** For Activate on one dryer: the washer it is still waiting for, or null. */
export const dryerWaitingFor = async (machineRow) => {
  if (machineRow.kind !== "dryer" || !machineRow.active_job_order_id) return null;
  const queued = await loadQueuedDryers([machineRow, ...((await selectMachines()) ?? []).filter((m) => m.id !== machineRow.id)]);
  return queued[machineRow.id] ?? null;
};

/**
 * A cycle just ended on this machine (row = the machine row BEFORE it was freed).
 * Logs a run for the history/insights (only if the timer really started) and stamps
 * `finishedAt` on the order's assignment so "washed, waiting for a dryer" can be spotted.
 * Never throws: the machine is already free, bookkeeping must not break the request.
 */
export const recordCycleEnd = async (row, { endedAt, minutes, reason }) => {
  try {
    if (row.started_at) {
      await supabaseRequest("tlp_machine_runs", {
        method: "POST",
        body: JSON.stringify({
          machine_id: row.id,
          order_id: row.active_job_order_id ?? null,
          started_at: row.started_at,
          ended_at: endedAt,
          minutes,
        }),
        headers: { Prefer: "return=minimal" },
      });
    }
    if (row.active_job_order_id) {
      const safeId = encodeURIComponent(row.active_job_order_id);
      const products = await loadProducts();
      // Every load of this order that was on this machine ends now (extra-time add-ons share the machine).
      // Saved against the freshest copy of the order, so it can't undo an assignment made at the same moment.
      await changeOrder(safeId, (order) => {
        let stamped = false;
        order.assignments = order.assignments.map((a) => {
          if (a.machineId === row.id && !a.finishedAt) {
            stamped = true;
            // An early end keeps the reason staff gave on the load.
            return reason ? { ...a, finishedAt: endedAt, endReason: reason } : { ...a, finishedAt: endedAt };
          }
          return a;
        });
        // A queued dryer is waiting on this wash: once the last washer ends, the order moves on to drying.
        if (stamped && order.status !== "voided" && order.status !== "completed") order.fulfillmentStage = computeStage(order, products);
        return stamped ? undefined : "nothing to stamp";
      });
    }
  } catch (error) {
    console.error("recordCycleEnd failed:", error instanceof Error ? error.message : error);
  }
};

/**
 * Finished cycles: a running machine whose timer has run out becomes available again and its
 * cycle count goes up by one. The PATCH only applies if the row is still in the same run, so
 * concurrent polls can't count a cycle twice.
 */
export const finalizeExpired = async (rows) => {
  const now = Date.now();
  let changed = false;
  for (const r of rows) {
    if (r.status !== "running" || !r.started_at || !r.remaining_minutes) continue;
    if (now < Date.parse(r.started_at) + r.remaining_minutes * 60000) continue;
    const done = await supabaseRequest(
      `tlp_machines?id=eq.${encodeURIComponent(r.id)}&status=eq.running&started_at=eq.${encodeURIComponent(r.started_at)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...freeMachinePatch(),
          cycle_count: r.cycle_count + 1,
          total_run_minutes: r.total_run_minutes + r.remaining_minutes,
        }),
        headers: { Prefer: "return=representation" },
      }
    );
    if (done?.length) {
      changed = true;
      await recordCycleEnd(r, {
        endedAt: new Date(Date.parse(r.started_at) + r.remaining_minutes * 60000).toISOString(),
        minutes: r.remaining_minutes,
      });
    }
  }
  return changed;
};
