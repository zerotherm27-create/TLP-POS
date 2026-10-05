import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest, toJobOrderRow } from "../_supabase.js";

const computeStage = (order, products) => {
  if (order.assignments.length === 0) return "queued";

  const assignedProductIds = new Set(order.assignments.map((a) => a.productId));
  const allAssigned = order.services.every((s) => assignedProductIds.has(s.productId));

  if (!allAssigned) return "washing";

  const hasWasher = order.assignments.some((a) => {
    const p = products.find((p) => p.id === a.productId);
    return p?.machineKind === "washer";
  });
  const hasDryer = order.assignments.some((a) => {
    const p = products.find((p) => p.id === a.productId);
    return p?.machineKind === "dryer";
  });

  if (hasWasher && !hasDryer) return "washing";
  if (hasDryer && !hasWasher) return "drying";
  return "washing";
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;

    const { orderId, machineId, productId } = await readJson(req);
    if (!orderId || !machineId || !productId) {
      sendJson(res, 400, { ok: false, message: "orderId, machineId, and productId are required." });
      return;
    }

    const rows = await supabaseRequest(`tlp_job_orders?id=eq.${orderId}&limit=1`);
    if (!rows || rows.length === 0) {
      sendJson(res, 404, { ok: false, message: "Order not found." });
      return;
    }

    const order = fromJobOrderRow(rows[0]);

    if (order.status === "voided" || order.status === "completed") {
      sendJson(res, 400, { ok: false, message: "Cannot assign machine to a closed order." });
      return;
    }

    const already = order.assignments.find((a) => a.machineId === machineId);
    if (already) {
      sendJson(res, 400, { ok: false, message: "Machine already assigned to this order." });
      return;
    }

    const now = new Date().toISOString();
    const newAssignment = { machineId, productId, assignedAt: now };
    order.assignments = [...order.assignments, newAssignment];
    order.status = "in_progress";
    order.updatedAt = now;

    let products = [];
    try {
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      products = require("../_products.json");
    } catch {}

    order.fulfillmentStage = computeStage(order, products);

    await supabaseRequest(`tlp_job_orders?id=eq.${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(toJobOrderRow(order)),
      headers: { Prefer: "return=minimal" },
    });

    sendJson(res, 200, { ok: true, jobOrder: order });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to assign machine.",
    });
  }
}
