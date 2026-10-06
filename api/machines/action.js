import { requireUser } from "../_auth.js";
import { freeMachinePatch, fromMachineRow, recordCycleEnd } from "../_machines.js";
import { ensurePost, readJson, sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    const auth = await requireUser(req, res); // staff and admin
    if (!auth) return;

    const { machineId, action } = await readJson(req);
    if (!ID_RE.test(String(machineId ?? "")) || !["start", "clean", "finish", "online", "offline"].includes(action)) {
      sendJson(res, 400, { ok: false, message: "A valid machineId and action (start | clean | finish | online | offline) are required." });
      return;
    }
    if ((action === "online" || action === "offline") && auth.role !== "admin") {
      sendJson(res, 403, { ok: false, message: "Only an admin can change a machine's availability." });
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
    let guard = "";
    if (action === "offline" || action === "online") {
      const wantOffline = action === "offline";
      if (wantOffline && machine.status === "running") {
        sendJson(res, 400, { ok: false, message: "This machine is running a load. Finish or release it first." });
        return;
      }
      if (machine.status === (wantOffline ? "offline" : "online")) {
        sendJson(res, 200, { ok: true, machine: fromMachineRow(machine) }); // already there
        return;
      }
      patch = { status: wantOffline ? "offline" : "online", last_seen_at: new Date().toISOString() };
      guard = wantOffline ? "&status=eq.online" : "&status=eq.offline";
    } else if (action === "finish") {
      // End the cycle early (e.g. the washer is done): free the machine so the dryer can be assigned.
      if (machine.status !== "running") {
        sendJson(res, 400, { ok: false, message: "This machine isn't running." });
        return;
      }
      patch = freeMachinePatch();
      if (machine.started_at) {
        // A cycle that really ran counts toward the machine's totals.
        const elapsed = Math.round((Date.now() - Date.parse(machine.started_at)) / 60000);
        const ranMinutes = Math.max(0, Math.min(machine.remaining_minutes ?? 0, elapsed));
        patch = { ...patch, cycle_count: machine.cycle_count + 1, total_run_minutes: machine.total_run_minutes + ranMinutes };
      }
      guard = "&status=eq.running"; // only applies if nobody else already finished it
    } else if (action === "start") {
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

    const updated = await supabaseRequest(`tlp_machines?id=eq.${id}${guard}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      headers: { Prefer: "return=representation" },
    });

    if (action === "finish" && updated?.length) {
      const endedAt = new Date().toISOString();
      const elapsed = machine.started_at ? Math.round((Date.now() - Date.parse(machine.started_at)) / 60000) : 0;
      await recordCycleEnd(machine, { endedAt, minutes: Math.max(0, Math.min(machine.remaining_minutes ?? 0, elapsed)) });
    }

    sendJson(res, 200, { ok: true, machine: updated?.[0] ? fromMachineRow(updated[0]) : undefined });
  } catch (error) {
    sendServerError(res, error, "Action failed.");
  }
}
