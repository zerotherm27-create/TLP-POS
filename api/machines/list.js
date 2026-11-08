import { requireUser } from "../_auth.js";
import { loadActivations } from "../_gateway.js";
import { finalizeExpired, fromMachineRow, loadQueuedDryers, selectMachines } from "../_machines.js";
import { sendJson, sendServerError } from "../_supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, message: "Method not allowed." });
      return;
    }
    if (!(await requireUser(req, res))) return;

    let rows = (await selectMachines()) ?? [];
    if (await finalizeExpired(rows)) rows = (await selectMachines()) ?? [];

    const [activations, queued] = await Promise.all([loadActivations(rows), loadQueuedDryers(rows)]);
    sendJson(res, 200, {
      ok: true,
      machines: rows.map((r) => ({
        ...fromMachineRow(r),
        activation: activations[r.id],
        // A dryer assigned ahead of time, still waiting for its washer to finish.
        ...(queued[r.id] ? { queued: true, waitingOn: queued[r.id].waitingFor } : {}),
      })),
    });
  } catch (error) {
    sendServerError(res, error, "Failed to load machines.");
  }
}
