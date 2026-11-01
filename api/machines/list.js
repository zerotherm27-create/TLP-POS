import { requireUser } from "../_auth.js";
import { loadActivations } from "../_gateway.js";
import { finalizeExpired, fromMachineRow, selectMachines } from "../_machines.js";
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

    const activations = await loadActivations(rows);
    sendJson(res, 200, { ok: true, machines: rows.map((r) => ({ ...fromMachineRow(r), activation: activations[r.id] })) });
  } catch (error) {
    sendServerError(res, error, "Failed to load machines.");
  }
}
