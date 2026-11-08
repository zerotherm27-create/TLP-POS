import { requireUser } from "../_auth.js";
import { importModeFrom } from "../_catalog.js";
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

    const rows = await supabaseRequest("tlp_settings?select=key,value");
    const settings = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
    settings.orderImportMode = importModeFrom(settings.orderImportMode, settings.orderImportEnabled);
    delete settings.orderImportEnabled; // the earlier on/off value only feeds the mode above
    sendJson(res, 200, { ok: true, settings });
  } catch (error) {
    sendServerError(res, error, "Failed to load settings.");
  }
}
