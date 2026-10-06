import { requireUser } from "../_auth.js";
import { fromMachineRow } from "../_machines.js";
import { ensurePost, readJson, sendJson, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res))) return; // staff and admin

    const { machineId, action } = await readJson(req);
    if (!ID_RE.test(String(machineId ?? "")) || (action !== "start" && action !== "clean")) {
      sendJson(res, 400, { ok: false, message: "A valid machineId and action (start | clean) are required." });
      return;
    }
    const id = encodeURIComponent(machineId);

    const rows = await supabaseRequest(`tlp_machines?id=eq.${id}&limit=1`);
    const machine = rows?.[0];
    if (!machine) {
      sendJson(res, 404, { ok: false, message: "Machine not found." });
      return;
    }

    let patch;
    if (action === "start") {
      if (machine.status !== "running" || machine.started_at) {
        sendJson(res, 400, { ok: false, message: "This machine has no waiting load to start." });
        return;
      }
      patch = { started_at: new Date().toISOString() };
    } else {
      if (machine.kind !== "washer") {
        sendJson(res, 400, { ok: false, message: "Only washers have a tub clean." });
        return;
      }
      patch = { last_tub_clean_cycle: machine.cycle_count };
    }

    const updated = await supabaseRequest(`tlp_machines?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      headers: { Prefer: "return=representation" },
    });

    sendJson(res, 200, { ok: true, machine: updated?.[0] ? fromMachineRow(updated[0]) : undefined });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Action failed." });
  }
}
