import { requireUser } from "../_auth.js";
import { finalizeExpired, fromMachineRow, selectMachines } from "../_machines.js";
import { sendJson } from "../_supabase.js";

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

    sendJson(res, 200, { ok: true, machines: rows.map(fromMachineRow) });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to load machines." });
  }
}
