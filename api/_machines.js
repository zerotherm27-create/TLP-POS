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
    if (done?.length) changed = true;
  }
  return changed;
};
