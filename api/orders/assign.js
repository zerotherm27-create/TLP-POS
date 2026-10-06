import { requireUser } from "../_auth.js";
import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest, toJobOrderRow } from "../_supabase.js";

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

    const alreadyLine = order.assignments.find((a) => a.lineId === lineId);
    if (alreadyLine) {
      sendJson(res, 400, { ok: false, message: "This load is already assigned to a machine." });
      return;
    }
    const alreadyMachine = order.assignments.find((a) => a.machineId === machineId);
    if (alreadyMachine) {
      sendJson(res, 400, { ok: false, message: "Machine already assigned to this order." });
      return;
    }

    const now = new Date().toISOString();
    const newAssignment = { lineId, machineId, productId, assignedAt: now };
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

    await supabaseRequest(`tlp_job_orders?id=eq.${safeOrderId}`, {
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
