import { fromJobOrderRow, sendJson, supabaseRequest } from "../_supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, message: "Method not allowed." });
      return;
    }

    const branchId = new URL(req.url, "http://localhost").searchParams.get("branchId") ?? "b1";

    const rows = await supabaseRequest(
      `tlp_job_orders?branch_id=eq.${branchId}&order=created_at.desc&limit=100`
    );

    const orders = (rows ?? []).map(fromJobOrderRow);
    sendJson(res, 200, { ok: true, orders });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to list orders.",
    });
  }
}
