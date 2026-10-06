import { requireUser } from "../_auth.js";
import { sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

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

    const rows = await supabaseRequest("tlp_packages?branch_id=eq.b1&order=position.asc,created_at.asc&limit=200");
    const packages = (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      priceCents: r.price_cents ?? 0,
      titanPriceCents: r.titan_price_cents ?? 0,
      services: r.services ?? [],
      createdAt: r.created_at,
    }));
    sendJson(res, 200, { ok: true, packages });
  } catch (error) {
    sendServerError(res, error, "Failed to list packages.");
  }
}
