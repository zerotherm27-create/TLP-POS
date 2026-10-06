import { requireUser } from "../_auth.js";
import { ensurePost, readJson, sendJson, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res, { adminOnly: true }))) return;

    const { id, name, description, services } = await readJson(req);
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanDesc = typeof description === "string" ? description.trim().slice(0, 80) : "";

    if (!ID_RE.test(String(id ?? "")) || !cleanName || cleanName.length > 80) {
      sendJson(res, 400, { ok: false, message: "A valid id and name are required." });
      return;
    }
    if (!Array.isArray(services) || services.length === 0 || !services.every((s) => ID_RE.test(String(s)))) {
      sendJson(res, 400, { ok: false, message: "Pick at least one valid service." });
      return;
    }

    await supabaseRequest("tlp_packages?on_conflict=id", {
      method: "POST",
      body: JSON.stringify({
        id,
        branch_id: "b1",
        name: cleanName,
        description: cleanDesc || null,
        services,
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to save package." });
  }
}
