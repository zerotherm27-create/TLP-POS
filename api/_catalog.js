import { createRequire } from "module";
import { supabaseRequest } from "./_supabase.js";

const require = createRequire(import.meta.url);

/** Product list: the admin-edited one saved in settings, else the built-in defaults. */
export const loadProducts = async () => {
  try {
    const rows = await supabaseRequest("tlp_settings?key=eq.products&select=value&limit=1");
    if (Array.isArray(rows?.[0]?.value)) return rows[0].value;
  } catch {}
  return require("./_products.json");
};
