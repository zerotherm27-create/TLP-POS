import { requireGateway } from "../../_gateway.js";
import { readJson, sendJson, sendServerError, supabaseRequest } from "../../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, message: "Method not allowed." });
      return;
    }

    const auth = requireGateway(req, res);
    if (!auth) return;

    const body = await readJson(req);
    const commandId = String(body.commandId ?? "");
    if (!ID_RE.test(commandId) || typeof body.ok !== "boolean") {
      sendJson(res, 400, { ok: false, message: "commandId and ok are required." });
      return;
    }

    const completedAt = new Date().toISOString();
    const response = String(body.response ?? "").slice(0, 1000);
    const updated = await supabaseRequest(
      `tlp_machine_commands?id=eq.${encodeURIComponent(commandId)}&gateway_id=eq.${encodeURIComponent(auth.gatewayId)}&status=in.(queued,sent)`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: body.ok ? "succeeded" : "failed",
          completed_at: completedAt,
          result: { ok: body.ok, response, completedAt },
          error: body.ok ? null : response
        }),
        headers: { Prefer: "return=representation" }
      }
    );

    if (!updated?.length) {
      sendJson(res, 404, { ok: false, message: "Command not found or already completed." });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendServerError(res, error, "Failed to complete gateway command.");
  }
}
