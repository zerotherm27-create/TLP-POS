import { getSupabaseConfig, sendJson } from "./_supabase.js";

/**
 * Verifies the caller's Supabase access token and role.
 * Returns { user, role } on success, or null after sending a 401/403 response.
 * Roles live in the account's app_metadata.role ("admin" | "staff"), which only an
 * admin can set (users cannot edit app_metadata), so self-signups get no access.
 */
export const requireUser = async (req, res, { adminOnly = false } = {}) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    sendJson(res, 401, { ok: false, message: "Sign in required." });
    return null;
  }

  const { url, key } = getSupabaseConfig();
  let user = null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` }
    });
    if (r.ok) user = await r.json();
  } catch {
    user = null;
  }

  if (!user?.id) {
    sendJson(res, 401, { ok: false, message: "Session expired. Sign in again." });
    return null;
  }

  const role = user.app_metadata?.role;
  if (role !== "admin" && role !== "staff") {
    sendJson(res, 403, { ok: false, message: "This account has no access." });
    return null;
  }
  if (adminOnly && role !== "admin") {
    sendJson(res, 403, { ok: false, message: "Admin access required." });
    return null;
  }

  return { user, role };
};
