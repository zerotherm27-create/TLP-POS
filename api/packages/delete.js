import { requireUser } from "../_auth.js";
import { ensurePost, readJson, sendJson, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res, { adminOnly: true }))) return;

    const { id } = await readJson(req);
    if (!ID_RE.test(String(id ?? ""))) {
      sendJson(res, 400, { ok: false, message: "A valid id is required." });
      return;
    }

    await supabaseRequest(`tlp_packages?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to delete package." });
  }
}
