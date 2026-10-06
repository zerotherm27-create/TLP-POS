import { requireUser } from "../_auth.js";
import { sendJson, supabaseRequest } from "../_supabase.js";

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

    const rows = await supabaseRequest("tlp_settings?select=key,value");
    const settings = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
    sendJson(res, 200, { ok: true, settings });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to load settings." });
  }
}
