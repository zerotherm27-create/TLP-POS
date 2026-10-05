import { buildOrderBundle, persistOrderBundle } from "../_laundrobot.js";
import { ensurePost, readJson, sendJson } from "../_supabase.js";

const requireImportToken = (req) => {
  const expected = process.env.LAUNDROBOT_IMPORT_TOKEN;
  if (!expected) {
    return;
  }

  const received = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (received !== expected) {
    throw new Error("Invalid LaundroBot import token.");
  }
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) {
      return;
    }

    requireImportToken(req);

    const body = await readJson(req);
    if (!body.externalOrderId || !body.customerName || !Array.isArray(body.services) || body.services.length === 0) {
      sendJson(res, 400, {
        ok: false,
        message: "externalOrderId, customerName, and at least one service are required."
      });
      return;
    }

    const bundle = buildOrderBundle(body);
    await persistOrderBundle(bundle);

    sendJson(res, 201, { ok: true, jobOrder: bundle.jobOrder });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown LaundroBot import error."
    });
  }
}
