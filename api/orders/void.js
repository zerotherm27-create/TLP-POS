import { requireUser } from "../_auth.js";
import { freeMachinePatch } from "../_machines.js";
import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res, { adminOnly: true }))) return;

    const { orderId } = await readJson(req);
    if (!ID_RE.test(String(orderId ?? ""))) {
      sendJson(res, 400, { ok: false, message: "A valid orderId is required." });
      return;
    }

    const safeId = encodeURIComponent(orderId);
    const rows = await supabaseRequest(`tlp_job_orders?id=eq.${safeId}&limit=1`);
    if (!rows?.length) {
      sendJson(res, 404, { ok: false, message: "Order not found." });
      return;
    }
    const current = fromJobOrderRow(rows[0]);
    if (current.status === "voided") {
      sendJson(res, 200, { ok: true, jobOrder: current });
      return;
    }

    const updated = await supabaseRequest(`tlp_job_orders?id=eq.${safeId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "voided",
        fulfillment_stage: "voided",
        payment_status: current.paymentStatus === "paid" ? "refunded" : "voided",
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=representation" },
    });

    // Give back any machines still running this order.
    await supabaseRequest(`tlp_machines?active_job_order_id=eq.${safeId}`, {
      method: "PATCH",
      body: JSON.stringify(freeMachinePatch()),
      headers: { Prefer: "return=minimal" },
    });

    sendJson(res, 200, { ok: true, jobOrder: fromJobOrderRow(updated[0]) });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to void order." });
  }
}
