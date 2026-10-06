import { requireUser } from "../_auth.js";
import { ensurePost, readJson, sendJson, supabaseRequest } from "../_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const isNum = (n, min, max) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

const validators = {
  largeLoadKg: (v) => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 100,
  extraRates: (v) =>
    !!v && Number.isInteger(v.washCentsPer10) && Number.isInteger(v.dryCentsPer10) &&
    v.washCentsPer10 >= 0 && v.washCentsPer10 <= 1_000_000 && v.dryCentsPer10 >= 0 && v.dryCentsPer10 <= 1_000_000 &&
    [v.titanWashCentsPer10, v.titanDryCentsPer10].every((n) => n === undefined || (Number.isInteger(n) && n >= 0 && n <= 1_000_000)),
  tubCleanThreshold: (v) => Number.isInteger(v) && v >= 1 && v <= 1000,
  products: (v) =>
    Array.isArray(v) &&
    v.length <= 100 &&
    v.every(
      (p) =>
        p &&
        ID_RE.test(String(p.id ?? "")) &&
        (p.machineKind === "washer" || p.machineKind === "dryer") &&
        typeof p.name === "string" && p.name.trim().length > 0 && p.name.length <= 80 &&
        (p.description === undefined || (typeof p.description === "string" && p.description.length <= 200)) &&
        isNum(p.durationMinutes, 0, 600) &&
        isNum(p.priceCents, 0, 10_000_000) &&
        isNum(p.pulse, 0, 100) &&
        isNum(p.pushDelayMs, 0, 600_000) &&
        (p.isExtraTime === undefined || typeof p.isExtraTime === "boolean")
    ),
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res, { adminOnly: true }))) return;

    const { key, value } = await readJson(req);
    const validate = validators[key];
    if (!validate || !validate(value)) {
      sendJson(res, 400, { ok: false, message: "Invalid setting." });
      return;
    }

    await supabaseRequest("tlp_settings?on_conflict=key", {
      method: "POST",
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to save setting." });
  }
}
