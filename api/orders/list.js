import { requireUser } from "../_auth.js";
import { fromJobOrderRow, sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

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

    if (!(await requireUser(req, res))) return;

    const rawBranchId = new URL(req.url, "http://localhost").searchParams.get("branchId") ?? "b1";
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(rawBranchId)) {
      sendJson(res, 400, { ok: false, message: "Invalid branchId." });
      return;
    }
    const branchId = encodeURIComponent(rawBranchId);

    const rows = await supabaseRequest(
      `tlp_job_orders?branch_id=eq.${branchId}&order=created_at.desc&limit=100`
    );

    const orders = (rows ?? []).map(fromJobOrderRow);
    sendJson(res, 200, { ok: true, orders });
  } catch (error) {
    sendServerError(res, error, "Failed to list orders.");
  }
}
