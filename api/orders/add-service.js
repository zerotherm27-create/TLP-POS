import { createRequire } from "module";
import { requireUser } from "../_auth.js";
import { loadProducts } from "../_catalog.js";
import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest, toJobOrderRow } from "../_supabase.js";

const require = createRequire(import.meta.url);
const crypto = require("crypto");
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Adds one more load (e.g. a dryer after the washer) to an order that is still open. */
export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res))) return; // staff and admin

    const { orderId, productId } = await readJson(req);
    if (!ID_RE.test(String(orderId ?? "")) || !ID_RE.test(String(productId ?? ""))) {
      sendJson(res, 400, { ok: false, message: "orderId and productId are required." });
      return;
    }

    const products = await loadProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) {
      sendJson(res, 400, { ok: false, message: "That service doesn't exist." });
      return;
    }

    const safeId = encodeURIComponent(orderId);
    const rows = await supabaseRequest(`tlp_job_orders?id=eq.${safeId}&limit=1`);
    if (!rows?.length) {
      sendJson(res, 404, { ok: false, message: "Order not found." });
      return;
    }

    const order = fromJobOrderRow(rows[0]);
    if (order.status === "completed" || order.status === "voided") {
      sendJson(res, 400, { ok: false, message: "This order is closed." });
      return;
    }
    if (order.services.length >= 30) {
      sendJson(res, 400, { ok: false, message: "Too many loads in one order." });
      return;
    }

    order.services = [
      ...order.services,
      { lineId: crypto.randomUUID(), productId: product.id, quantity: 1, priceCents: product.priceCents },
    ];
    order.updatedAt = new Date().toISOString();

    await supabaseRequest(`tlp_job_orders?id=eq.${safeId}`, {
      method: "PATCH",
      body: JSON.stringify(toJobOrderRow(order)),
      headers: { Prefer: "return=minimal" },
    });

    sendJson(res, 200, { ok: true, jobOrder: order });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to add the load." });
  }
}
