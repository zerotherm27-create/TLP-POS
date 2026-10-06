import { createRequire } from "module";
import { requireUser } from "../_auth.js";
import { extraChargeCents, extraRateCents, loadExtraRates, loadProducts } from "../_catalog.js";
import { changeOrder, ensurePost, readJson, sendJson, sendServerError } from "../_supabase.js";

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

    const rates = await loadExtraRates();
    const safeId = encodeURIComponent(orderId);
    const saved = await changeOrder(safeId, (order) => {
      if (order.status === "completed" || order.status === "voided") return "This order is closed.";
      if (order.services.length >= 30) return "Too many loads in one order.";

      // A dryer added to an order whose washers are the larger titan ones needs the larger dryer too.
      const washerLines = order.services.filter((l) => products.find((p) => p.id === l.productId)?.machineKind === "washer");
      const inheritLarge = product.machineKind === "dryer" && washerLines.length > 0 && washerLines.every((l) => l.tier === "titan");

      // Same price the screen shows: the admin's extra-time rate per 10 minutes for this machine size,
      // or the program's own price when no rate is set.
      const size = washerLines.length > 0 && washerLines.every((l) => l.tier === "titan") ? "titan" : "giant";
      const priceCents = extraRateCents(rates, product.machineKind, size) > 0
        ? extraChargeCents(rates, product.machineKind, product.durationMinutes, size)
        : product.priceCents;

      order.services = [
        ...order.services,
        { lineId: crypto.randomUUID(), productId: product.id, quantity: 1, priceCents, ...(inheritLarge ? { tier: "titan" } : {}) },
      ];
    });
    if (saved.status === "missing") {
      sendJson(res, 404, { ok: false, message: "Order not found." });
      return;
    }
    if (saved.status === "refused") {
      sendJson(res, 400, { ok: false, message: saved.message });
      return;
    }
    if (saved.status !== "saved") {
      sendJson(res, 409, { ok: false, message: "This order was just changed by someone else. Please try again." });
      return;
    }

    sendJson(res, 200, { ok: true, jobOrder: saved.order });
  } catch (error) {
    sendServerError(res, error, "Failed to add the load.");
  }
}
