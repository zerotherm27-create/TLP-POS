import { requireUser } from "../_auth.js";
import { loadProducts } from "../_catalog.js";
import { rangeBounds, summarize } from "../_insights.js";
import { selectMachines } from "../_machines.js";
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
    if (!(await requireUser(req, res, { adminOnly: true }))) return;

    const range = new URL(req.url, "http://localhost").searchParams.get("range") === "7d" ? "7d" : "today";
    const now = Date.now();
    const { start, end } = rangeBounds(range, now);
    const from = encodeURIComponent(new Date(start).toISOString());
    const to = encodeURIComponent(new Date(end).toISOString());

    const [orderRows, runs, machines, products] = await Promise.all([
      supabaseRequest(`tlp_job_orders?branch_id=eq.b1&created_at=gte.${from}&created_at=lt.${to}&limit=2000`),
      supabaseRequest(`tlp_machine_runs?ended_at=gte.${from}&ended_at=lt.${to}&limit=5000`),
      selectMachines(),
      loadProducts(),
    ]);

    const summary = summarize({
      orders: (orderRows ?? []).map(fromJobOrderRow),
      runs: runs ?? [],
      machines: (machines ?? []).map((m) => ({ id: m.id, publicCode: m.public_code, name: m.name, kind: m.kind })),
      products,
      range,
      now,
    });

    sendJson(res, 200, { ok: true, summary });
  } catch (error) {
    sendServerError(res, error, "Failed to build the summary.");
  }
}
