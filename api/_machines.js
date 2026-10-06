import { supabaseRequest } from "./_supabase.js";

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

/**
 * A cycle just ended on this machine (row = the machine row BEFORE it was freed).
 * Logs a run for the history/insights (only if the timer really started) and stamps
 * `finishedAt` on the order's assignment so "washed, waiting for a dryer" can be spotted.
 * Never throws: the machine is already free, bookkeeping must not break the request.
 */
export const recordCycleEnd = async (row, { endedAt, minutes }) => {
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
      const rows = await supabaseRequest(`tlp_job_orders?id=eq.${safeId}&select=assignments&limit=1`);
      const assignments = rows?.[0]?.assignments ?? [];
      // Every load of this order that was on this machine ends now (extra-time add-ons share the machine).
      let stamped = false;
      const next = assignments.map((a) => {
        if (a.machineId === row.id && !a.finishedAt) {
          stamped = true;
          return { ...a, finishedAt: endedAt };
        }
        return a;
      });
      if (stamped) {
        await supabaseRequest(`tlp_job_orders?id=eq.${safeId}`, {
          method: "PATCH",
          body: JSON.stringify({ assignments: next }),
          headers: { Prefer: "return=minimal" },
        });
      }
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
