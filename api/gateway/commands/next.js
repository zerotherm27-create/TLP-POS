import { requireGateway } from "../../_gateway.js";
import { sendJson, sendServerError, supabaseRequest } from "../../_supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { ok: false, message: "Method not allowed." });
      return;
    }

    const auth = requireGateway(req, res);
    if (!auth) return;

    const rows = await supabaseRequest(
      `tlp_machine_commands?gateway_id=eq.${encodeURIComponent(auth.gatewayId)}&status=eq.queued&order=requested_at.asc&limit=1`
    );

    const command = rows?.[0];
    if (!command) {
      sendJson(res, 200, { ok: true, command: null });
      return;
    }

    const updated = await supabaseRequest(
      `tlp_machine_commands?id=eq.${encodeURIComponent(command.id)}&status=eq.queued`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString() }),
        headers: { Prefer: "return=representation" }
      }
    );

    if (!updated?.length) {
      sendJson(res, 409, { ok: false, message: "Command was already claimed." });
      return;
    }

    sendJson(res, 200, { ok: true, command: updated[0].request });
  } catch (error) {
    sendServerError(res, error, "Failed to fetch gateway command.");
  }
}
