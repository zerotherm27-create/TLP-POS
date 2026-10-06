import { requireUser } from "../_auth.js";
import { ensurePost, readJson, sendJson, sendServerError, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res, { adminOnly: true }))) return;

    const { ids } = await readJson(req);
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every((i) => ID_RE.test(String(i))) || new Set(ids).size !== ids.length) {
      sendJson(res, 400, { ok: false, message: "A list of package ids is required." });
      return;
    }

    await Promise.all(
      ids.map((id, index) =>
        supabaseRequest(`tlp_packages?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ position: index + 1 }),
          headers: { Prefer: "return=minimal" },
        })
      )
    );

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendServerError(res, error, "Failed to reorder packages.");
  }
}
