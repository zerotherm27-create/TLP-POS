import { buildOrderBundle, mapLaundrobotOrder, persistOrderBundle } from "../_laundrobot.js";
import { ensurePost, readJson, sendJson, supabaseRequest } from "../_supabase.js";

const requireImportToken = (req) => {
  const expected = process.env.LAUNDROBOT_IMPORT_TOKEN;
  if (!expected) return;
  const received = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (received !== expected) {
    throw new Error("Invalid LaundroBot import token.");
  }
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;

    requireImportToken(req);

    const body = await readJson(req);
    // LaundroBot sends: { id, customerName, contactNumber?, notes?, services: [{kind, durationMinutes, quantity, priceCents}] }
    if (!body.id || !body.customerName || !Array.isArray(body.services) || body.services.length === 0) {
      sendJson(res, 400, {
        ok: false,
        message: "id, customerName, and at least one service are required.",
      });
      return;
    }

    const rawOrder = { ...body, id: String(body.id) };
    const mapped = mapLaundrobotOrder(rawOrder);
    if (!mapped) {
      // Order has no machine-wash/dry services — nothing to do in TLP POS
      sendJson(res, 200, { ok: true, skipped: true, reason: "no machine services" });
      return;
    }

    // Idempotency: skip if this booking was already imported (Xendit may retry)
    const safeId = encodeURIComponent(mapped.externalOrderId);
    const existing = await supabaseRequest(`tlp_job_orders?external_order_id=eq.${safeId}&select=id&limit=1`);
    if (existing?.length > 0) {
      sendJson(res, 200, { ok: true, skipped: true, reason: "already imported" });
      return;
    }

    const bundle = buildOrderBundle(mapped);
    await persistOrderBundle(bundle);
    sendJson(res, 201, { ok: true, jobOrder: bundle.jobOrder });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown LaundroBot import error.",
    });
  }
}
