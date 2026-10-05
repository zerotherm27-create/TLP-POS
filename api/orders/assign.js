import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest, toJobOrderRow } from "../_supabase.js";

// Stage is driven by the most recently assigned machine kind.
// Washer assigned → "washing"; dryer assigned (after washer done) → "drying".
const computeStage = (order, products) => {
  if (order.assignments.length === 0) return "queued";
  const last = order.assignments[order.assignments.length - 1];
  const product = products.find((p) => p.id === last.productId);
  return product?.machineKind === "dryer" ? "drying" : "washing";
};

const requireApiToken = (req, res) => {
  const token = process.env.ORDERS_API_TOKEN;
  if (!token) return true; // token not configured — open in dev
  const received = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (received !== token) {
    sendJson(res, 401, { ok: false, message: "Unauthorized." });
    return false;
  }
  return true;
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!requireApiToken(req, res)) return;

    const { orderId, machineId, productId } = await readJson(req);
    if (!orderId || !machineId || !productId) {
      sendJson(res, 400, { ok: false, message: "orderId, machineId, and productId are required." });
      return;
    }

    const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
    if (!ID_RE.test(orderId) || !ID_RE.test(machineId) || !ID_RE.test(productId)) {
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
