import { requireUser } from "../_auth.js";
import { loadProducts } from "../_catalog.js";
import { freeMachinePatch, fromMachineRow } from "../_machines.js";
import { changeOrder, ensurePost, fromJobOrderRow, readJson, sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

// Stage is driven by the most recently assigned machine kind.
// Washer assigned → "washing"; dryer assigned (after washer done) → "drying".
const computeStage = (order, products) => {
  if (order.assignments.length === 0) return "queued";
  const last = order.assignments[order.assignments.length - 1];
  const product = products.find((p) => p.id === last.productId);
  return product?.machineKind === "dryer" ? "drying" : "washing";
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res))) return;

    const { orderId, machineId, productId, lineId } = await readJson(req);
    if (!orderId || !machineId || !productId || !lineId) {
      sendJson(res, 400, { ok: false, message: "orderId, machineId, productId, and lineId are required." });
      return;
    }

    const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
    const UUID_RE = /^[0-9a-f-]{36}$/;
    if (!ID_RE.test(orderId) || !ID_RE.test(machineId) || !ID_RE.test(productId) || !UUID_RE.test(lineId)) {
      sendJson(res, 400, { ok: false, message: "Invalid id format." });
      return;
    }

    const safeOrderId = encodeURIComponent(orderId);
    const rows = await supabaseRequest(`tlp_job_orders?id=eq.${safeOrderId}&limit=1`);
    if (!rows || rows.length === 0) {
      sendJson(res, 404, { ok: false, message: "Order not found." });
      return;
    }

    const order = fromJobOrderRow(rows[0]);

    if (order.status === "voided" || order.status === "completed") {
      sendJson(res, 400, { ok: false, message: "Cannot assign machine to a closed order." });
      return;
    }

    // The load must belong to this order, and its cycle length comes from the program on that load, never from the request.
    const products = await loadProducts();
    const line = order.services.find((l) => l.lineId === lineId);
    if (!line || line.productId !== productId) {
      sendJson(res, 400, { ok: false, message: "That load isn't part of this order." });
      return;
    }
    const product = products.find((p) => p.id === line.productId);
    const minutes = Number(product?.durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) {
      sendJson(res, 400, { ok: false, message: "This load's program has no valid cycle length." });
      return;
    }

    const alreadyLine = order.assignments.find((a) => a.lineId === lineId);
    if (alreadyLine) {
      sendJson(res, 400, { ok: false, message: "This load is already assigned to a machine." });
      return;
    }
    // A machine that already finished its load for this order can take the next one (e.g. two large bags, one large washer).
    const alreadyMachine = order.assignments.find((a) => a.machineId === machineId && !a.finishedAt);
    if (alreadyMachine) {
      sendJson(res, 400, { ok: false, message: "Machine already assigned to this order." });
      return;
    }

    const now = new Date().toISOString();
    const newAssignment = { lineId, machineId, productId, assignedAt: now };
    order.assignments = [...order.assignments, newAssignment];
    order.status = "in_progress";
    order.updatedAt = now;

    order.fulfillmentStage = computeStage(order, products);

    // Claim the machine first, and only if it is still free (guards against two people assigning at once).
    const claimed = await supabaseRequest(
      `tlp_machines?id=eq.${encodeURIComponent(machineId)}&status=eq.online&kind=eq.${product.machineKind}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "running",
          active_job_order_id: orderId,
          customer_name: order.customerName,
          remaining_minutes: Math.round(minutes),
          started_at: null,
          last_seen_at: now,
        }),
        headers: { Prefer: "return=representation" },
      }
    );
    if (!claimed?.length) {
      const known = await supabaseRequest(`tlp_machines?id=eq.${encodeURIComponent(machineId)}&select=id&limit=1`);
      sendJson(res, known?.length ? 409 : 404, {
        ok: false,
        message: known?.length ? "That machine isn't available for this load right now." : "Machine not found.",
      });
      return;
    }

    // Save against the freshest copy of the order, so two people assigning loads of the same order at once keep both.
    const giveMachineBack = () =>
      supabaseRequest(`tlp_machines?id=eq.${encodeURIComponent(machineId)}`, {
        method: "PATCH",
        body: JSON.stringify(freeMachinePatch()),
        headers: { Prefer: "return=minimal" },
      });
    let saved;
    try {
      saved = await changeOrder(safeOrderId, (fresh) => {
        if (fresh.status === "voided" || fresh.status === "completed") return "Cannot assign machine to a closed order.";
        if (fresh.assignments.some((a) => a.lineId === lineId)) return "This load is already assigned to a machine.";
        if (fresh.assignments.some((a) => a.machineId === machineId && !a.finishedAt)) return "Machine already assigned to this order.";
        fresh.assignments = [...fresh.assignments, newAssignment];
        fresh.status = "in_progress";
        fresh.fulfillmentStage = computeStage(fresh, products);
      });
    } catch (e) {
      // Couldn't save the order — give the machine back so it isn't stuck.
      await giveMachineBack();
      throw e;
    }
    if (saved.status !== "saved") {
      await giveMachineBack();
      const busy = saved.status === "busy";
      sendJson(res, saved.status === "missing" ? 404 : busy ? 409 : 400, {
        ok: false,
        message: saved.status === "missing" ? "Order not found." : busy ? "This order was just changed by someone else. Please try again." : saved.message,
      });
      return;
    }

    sendJson(res, 200, { ok: true, jobOrder: saved.order, machine: fromMachineRow(claimed[0]) });
  } catch (error) {
    sendServerError(res, error, "Failed to assign machine.");
  }
}
