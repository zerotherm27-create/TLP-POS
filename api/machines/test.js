import { requireUser } from "../_auth.js";
import { fromMachineRow } from "../_machines.js";
import { ensurePost, readJson, sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TEST_PRODUCT = "__test"; // marks a connection test in tlp_machine_commands so it never counts as an activation
const GIVE_UP_MS = 30_000;

/**
 * Connection test for one machine's controller. The app runs in the cloud and cannot reach the machines itself,
 * so the test goes through the Z83 gateway, which only reads the controller's status page (it sends no credit).
 *   { machineId }  -> starts a test, returns { commandId }
 *   { commandId }  -> returns { status: "waiting" | "done", connected, message }
 */
export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    const auth = await requireUser(req, res); // staff and admin: a test only reads from the controller
    if (!auth) return;

    const body = await readJson(req);

    if (body.commandId !== undefined) {
      if (!ID_RE.test(String(body.commandId))) {
        sendJson(res, 400, { ok: false, message: "A valid commandId is required." });
        return;
      }
      const id = encodeURIComponent(String(body.commandId));
      const rows = await supabaseRequest(`tlp_machine_commands?id=eq.${id}&product_id=eq.${TEST_PRODUCT}&select=status,result,requested_at&limit=1`);
      const row = rows?.[0];
      if (!row) {
        sendJson(res, 404, { ok: false, message: "Test not found." });
        return;
      }
      if ((row.status === "queued" || row.status === "sent") && Date.now() - Date.parse(row.requested_at) > GIVE_UP_MS) {
        const message = "The Z83 gateway didn't answer. Check that it is running.";
        await supabaseRequest(`tlp_machine_commands?id=eq.${id}&status=in.(queued,sent)`, {
          method: "PATCH",
          body: JSON.stringify({ status: "failed", completed_at: new Date().toISOString(), error: message, result: { ok: false, response: message } }),
          headers: { Prefer: "return=minimal" },
        });
        sendJson(res, 200, { ok: true, status: "done", connected: false, message });
        return;
      }
      if (row.status === "queued" || row.status === "sent") {
        sendJson(res, 200, { ok: true, status: "waiting" });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        status: "done",
        connected: row.status === "succeeded",
        message: String(row.result?.response ?? (row.status === "succeeded" ? "Connected." : "Not connected.")).slice(0, 300),
      });
      return;
    }

    if (!ID_RE.test(String(body.machineId ?? ""))) {
      sendJson(res, 400, { ok: false, message: "A valid machineId is required." });
      return;
    }
    const machineId = String(body.machineId);
    const rows = await supabaseRequest(`tlp_machines?id=eq.${encodeURIComponent(machineId)}&limit=1`);
    if (!rows?.length) {
      sendJson(res, 404, { ok: false, message: "Machine not found." });
      return;
    }
    const machine = fromMachineRow(rows[0]);
    if (!String(machine.espIp ?? "").trim()) {
      sendJson(res, 400, { ok: false, message: `${machine.name} has no controller address yet. Set it first.` });
      return;
    }

    // Pressing the button twice shouldn't pile up tests: reuse one that is still being run.
    const open = await supabaseRequest(
      `tlp_machine_commands?machine_id=eq.${encodeURIComponent(machineId)}&product_id=eq.${TEST_PRODUCT}&status=in.(queued,sent)&order=requested_at.desc&limit=1`
    );
    if (open?.length && Date.now() - Date.parse(open[0].requested_at) < GIVE_UP_MS) {
      sendJson(res, 200, { ok: true, commandId: open[0].id });
      return;
    }

    const commandId = crypto.randomUUID();
    await supabaseRequest("tlp_machine_commands", {
      method: "POST",
      body: JSON.stringify({
        id: commandId,
        branch_id: machine.branchId,
        machine_id: machine.id,
        product_id: TEST_PRODUCT,
        gateway_id: process.env.GATEWAY_ID || "z83-local",
        status: "queued",
        requested_by: auth.user.id,
        request: { commandId, type: "test", machine: { id: machine.id, name: machine.name, espIp: machine.espIp, kind: machine.kind }, mode: "real" },
      }),
      headers: { Prefer: "return=minimal" },
    });

    sendJson(res, 200, { ok: true, commandId });
  } catch (error) {
    sendServerError(res, error, "Couldn't test the machine connection.");
  }
}
