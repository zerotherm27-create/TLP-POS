import { requireUser } from "../_auth.js";
import { freeMachinePatch } from "../_machines.js";
import { changeOrder, ensurePost, readJson, sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_RE = /^[0-9a-f-]{36}$/;

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    const auth = await requireUser(req, res); // staff and admin (the reason is logged with their email)
    if (!auth) return;

    const { orderId, lineId, machineId, reason, mode } = await readJson(req);
    if (!ID_RE.test(String(orderId ?? "")) || !ID_RE.test(String(machineId ?? "")) || !UUID_RE.test(String(lineId ?? ""))) {
      sendJson(res, 400, { ok: false, message: "orderId, lineId and machineId are required." });
      return;
    }

    const safeOrderId = encodeURIComponent(orderId);
    const now = new Date().toISOString();
    const saved = await changeOrder(safeOrderId, (order) => {
      const remaining = order.assignments.filter((a) => !(a.lineId === lineId && a.machineId === machineId));
      order.assignments = remaining;
      order.status = remaining.length === 0 ? "queued" : "in_progress";
      if (remaining.length === 0) order.fulfillmentStage = "queued";
    });
    if (saved.status === "missing") {
      sendJson(res, 404, { ok: false, message: "Order not found." });
      return;
    }
    if (saved.status !== "saved") {
      sendJson(res, 409, { ok: false, message: "This order was just changed by someone else. Please try again." });
      return;
    }
    const order = saved.order;

    // Free the machine only if it is still running this order.
    await supabaseRequest(
      `tlp_machines?id=eq.${encodeURIComponent(machineId)}&active_job_order_id=eq.${safeOrderId}`,
      { method: "PATCH", body: JSON.stringify(freeMachinePatch()), headers: { Prefer: "return=minimal" } }
    );

    if (reason) console.log(`[${now}] ${String(mode ?? "unassign").toUpperCase()} — order ${orderId}, machine ${machineId}, by ${auth.user.email}. Reason: ${String(reason).slice(0, 200)}`);

    sendJson(res, 200, { ok: true, jobOrder: order });
  } catch (error) {
    sendServerError(res, error, "Failed to release machine.");
  }
}
