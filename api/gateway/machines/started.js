import { requireGateway } from "../../_gateway.js";
import { readJson, sendJson, sendServerError, supabaseRequest } from "../../_supabase.js";

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** The gateway calls this when a machine's controller reports that the physical Start button was pressed. */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, message: "Method not allowed." });
      return;
    }
    if (!requireGateway(req, res)) return;

    const body = await readJson(req);
    const espIp = String(body.espIp ?? "");
    if (!IPV4_RE.test(espIp)) {
      sendJson(res, 400, { ok: false, message: "A valid espIp is required." });
      return;
    }

    // Only a machine that has a load waiting for its Start can be started this way.
    const started = await supabaseRequest(
      `tlp_machines?esp_ip=eq.${encodeURIComponent(espIp)}&status=eq.running&started_at=is.null`,
      {
        method: "PATCH",
        body: JSON.stringify({ started_at: new Date().toISOString() }),
        headers: { Prefer: "return=representation" },
      }
    );

    sendJson(res, 200, { ok: true, started: started?.length ?? 0 });
  } catch (error) {
    sendServerError(res, error, "Failed to record the machine start.");
  }
}
