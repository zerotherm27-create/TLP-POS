import { createRequire } from "module";
import { requireUser } from "../_auth.js";
import { loadProducts } from "../_catalog.js";
import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest, toJobOrderRow } from "../_supabase.js";

const require = createRequire(import.meta.url);
const crypto = require("crypto");

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const METHODS = ["cash", "gcash", "manual"];

const nextOrderNumber = async () => {
  const rows = await supabaseRequest("tlp_job_orders?select=order_number&source=eq.tlp_pos&order=created_at.desc&limit=50");
  const max = (rows ?? []).reduce((m, r) => {
    const n = parseInt(String(r.order_number ?? "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `TLP-${String(max + 1).padStart(4, "0")}`;
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res))) return; // staff and admin

    const body = await readJson(req);
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const contactNumber = typeof body.contactNumber === "string" ? body.contactNumber.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const paymentMethod = body.paymentMethod;

    if (!customerName || customerName.length > 80 || contactNumber.length > 30 || notes.length > 300) {
      sendJson(res, 400, { ok: false, message: "A customer name is required (max 80 characters)." });
      return;
    }
    if (!METHODS.includes(paymentMethod)) {
      sendJson(res, 400, { ok: false, message: "Choose a payment method." });
      return;
    }
    const picked = Array.isArray(body.services) ? body.services : [];
    if (picked.length === 0 || picked.length > 20) {
      sendJson(res, 400, { ok: false, message: "Pick at least one service." });
      return;
    }

    const products = await loadProducts();
    const services = [];
    for (const sel of picked) {
      const qty = Number(sel?.quantity ?? 1);
      const product = products.find((p) => p.id === sel?.productId);
      if (!product || !ID_RE.test(String(sel.productId)) || !Number.isInteger(qty) || qty < 1 || qty > 10) {
        sendJson(res, 400, { ok: false, message: "One of the services isn't valid." });
        return;
      }
      for (let i = 0; i < qty; i += 1) {
        services.push({ lineId: crypto.randomUUID(), productId: product.id, quantity: 1, priceCents: product.priceCents });
      }
    }
    if (services.length > 30) {
      sendJson(res, 400, { ok: false, message: "Too many loads in one order." });
      return;
    }

    const now = new Date().toISOString();
    const order = {
      id: `wk-${crypto.randomUUID()}`,
      branchId: "b1",
      source: "tlp_pos",
      orderNumber: await nextOrderNumber(),
      customerName,
      contactNumber: contactNumber || undefined,
      notes: notes || undefined,
      services,
      assignments: [],
      status: "queued",
      paymentStatus: "paid",
      fulfillmentStage: "queued",
      createdAt: now,
      updatedAt: now,
    };

    const rows = await supabaseRequest("tlp_job_orders", {
      method: "POST",
      body: JSON.stringify({ ...toJobOrderRow(order), payment_method: paymentMethod }),
      headers: { Prefer: "return=representation" },
    });

    sendJson(res, 200, { ok: true, jobOrder: rows?.[0] ? fromJobOrderRow(rows[0]) : order });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to create order." });
  }
}
