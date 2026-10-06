import { createRequire } from "module";
import { buildOrderBundle, mapLaundrobotOrder, persistOrderBundle } from "../_laundrobot.js";
import { loadLargeLoadKg, loadPackages } from "../_catalog.js";
import { ensurePost, readJson, sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

const _require = createRequire(import.meta.url);
const crypto = _require("crypto");

const requireImportToken = (req, res) => {
  const expected = process.env.LAUNDROBOT_IMPORT_TOKEN;
  if (!expected) {
    sendJson(res, 500, { ok: false, message: "LAUNDROBOT_IMPORT_TOKEN is not configured." });
    return false;
  }
  const received = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  let valid = false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }
  if (!valid) {
    sendJson(res, 401, { ok: false, message: "Unauthorized." });
    return false;
  }
  return true;
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!requireImportToken(req, res)) return;

    const body = await readJson(req);
    // LaundroBot sends: { id, customerName, contactNumber?, notes?, services: [{kind, durationMinutes, quantity, priceCents}] }
    if (!body.id || !body.customerName || !Array.isArray(body.services) || body.services.length === 0) {
      sendJson(res, 400, {
        ok: false,
        message: "id, customerName, and at least one service are required.",
      });
      return;
    }

    if (
      body.services.length > 20 ||
      String(body.id).length > 64 ||
      typeof body.customerName !== "string" || body.customerName.length > 120
    ) {
      sendJson(res, 400, { ok: false, message: "Order is too large or has invalid fields." });
      return;
    }

    const rawOrder = { ...body, id: String(body.id), customerName: body.customerName.trim().slice(0, 80) };
    const mapped = mapLaundrobotOrder(rawOrder, { largeKg: await loadLargeLoadKg(), packages: await loadPackages() });
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
    sendServerError(res, error, "Unknown LaundroBot import error.");
  }
}
