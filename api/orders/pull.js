import {
  buildOrderBundle,
  fetchLaundrobotOrders,
  mapLaundrobotOrder,
  persistOrderBundle
} from "../_laundrobot.js";
import { requireUser } from "../_auth.js";
import { sendJson, supabaseRequest } from "../_supabase.js";

const existingLaundrobotOrderIds = async () => {
  const rows = await supabaseRequest("tlp_job_orders?select=external_order_id&source=eq.laundrobot");
  return new Set(rows.map((row) => row.external_order_id).filter(Boolean));
};

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method !== "POST" && req.method !== "GET") {
      sendJson(res, 405, { ok: false, message: "Method not allowed." });
      return;
    }

    // Scheduled/backup callers authenticate with the sync token; people need an admin login.
    const syncToken = process.env.LAUNDROBOT_SYNC_TOKEN;
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!(syncToken && bearer === syncToken)) {
      if (!(await requireUser(req, res, { adminOnly: true }))) return;
    }

    const rawOrders = await fetchLaundrobotOrders();
    const existingIds = await existingLaundrobotOrderIds();
    const imported = [];
    const skipped = [];

    for (const rawOrder of rawOrders) {
      const mapped = mapLaundrobotOrder(rawOrder);
      if (!mapped) {
        // Order has no machine-wash/dry services (handwash, dryclean, etc.) — skip
        skipped.push(String(rawOrder.id));
        continue;
      }
      if (existingIds.has(mapped.externalOrderId)) {
        skipped.push(mapped.externalOrderId);
        continue;
      }

      const bundle = buildOrderBundle(mapped);
      await persistOrderBundle(bundle);
      imported.push(bundle.jobOrder);
      existingIds.add(mapped.externalOrderId);
    }

    sendJson(res, 200, {
      ok: true,
      pulled: rawOrders.length,
      imported: imported.length,
      skipped: skipped.length,
      orders: imported
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown LaundroBot pull error."
    });
  }
}
