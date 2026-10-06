import { createRequire } from "module";
import { requireUser } from "../_auth.js";
import { allocatePackagePrice, extraChargeCents, loadExtraRates, loadProducts, resolveWash } from "../_catalog.js";
import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest, toJobOrderRow } from "../_supabase.js";

const require = createRequire(import.meta.url);
const crypto = require("crypto");

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const METHODS = ["cash", "gcash", "manual"];

const nextOrderNumber = async () => {
  const rows = await supabaseRequest("tlp_job_orders?select=order_number&source=eq.tlp_pos&order=created_at.desc&limit=50");
  const max = (rows ?? []).reduce((m, r) => {
    const n = parseInt(String(r.order_number ?? "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `TLP-${String(max + 1).padStart(4, "0")}`;
};

export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res))) return; // staff and admin

    const body = await readJson(req);
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const contactNumber = typeof body.contactNumber === "string" ? body.contactNumber.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const paymentMethod = body.paymentMethod;

    if (!customerName || customerName.length > 80 || contactNumber.length > 30 || notes.length > 300) {
      sendJson(res, 400, { ok: false, message: "A customer name is required (max 80 characters)." });
      return;
    }
    if (!METHODS.includes(paymentMethod)) {
      sendJson(res, 400, { ok: false, message: "Choose a payment method." });
      return;
    }
    const products = await loadProducts();
    // Machine size the order is sold for. Larger (titan) machines have their own package price.
    const tier = body.tier === "titan" ? "titan" : "giant";

    // Everything is sold as a package: its price is what the customer pays (extras are added on top).
    let pkg = null;
    const packageId = typeof body.packageId === "string" ? body.packageId : "";
    if (packageId) {
      if (!ID_RE.test(packageId)) {
        sendJson(res, 400, { ok: false, message: "That package isn't valid." });
        return;
      }
      const pkgRows = await supabaseRequest(`tlp_packages?id=eq.${encodeURIComponent(packageId)}&limit=1`);
      pkg = pkgRows?.[0] ?? null;
      if (!pkg) {
        sendJson(res, 400, { ok: false, message: "That package no longer exists." });
        return;
      }
      const packagePrice = tier === "titan" ? pkg.titan_price_cents : pkg.price_cents;
      if (!(packagePrice > 0)) {
        sendJson(res, 400, {
          ok: false,
          message: tier === "titan"
            ? `"${pkg.name}" has no price for the larger machines yet. Set it in Admin → Packages.`
            : `"${pkg.name}" has no price yet. Set it in Admin → Packages.`,
        });
        return;
      }
      pkg.sale_price_cents = packagePrice;
    }

    const extras = body.extras && typeof body.extras === "object" ? body.extras : {};
    const picked = pkg
      ? (pkg.services ?? []).map((id) => ({ productId: id, quantity: 1, extraMinutes: Number(extras[id] ?? 0) }))
      : Array.isArray(body.services) ? body.services : [];
    if (picked.length === 0 || picked.length > 20) {
      sendJson(res, 400, { ok: false, message: "Pick a package." });
      return;
    }

    const rates = await loadExtraRates();
    const shares = pkg
      ? allocatePackagePrice(pkg.sale_price_cents, picked.map((sel) => products.find((p) => p.id === sel.productId) ?? { priceCents: 0 }))
      : [];
    const services = [];
    const notices = [];
    for (const [index, sel] of picked.entries()) {
      const qty = Number(sel?.quantity ?? 1);
      const extra = Number(sel?.extraMinutes ?? 0);
      const product = products.find((p) => p.id === sel?.productId);
      if (!product || !ID_RE.test(String(sel.productId)) || !Number.isInteger(qty) || qty < 1 || qty > 10) {
        sendJson(res, 400, { ok: false, message: pkg ? "A program in this package no longer exists." : "One of the services isn't valid." });
        return;
      }
      if (![0, 10, 20, 30].includes(extra) || (extra > 0 && product.machineKind !== "washer")) {
        sendJson(res, 400, { ok: false, message: "Extra minutes can only be added to a wash (10, 20 or 30)." });
        return;
      }
      // An extra wash is merged in BEFORE any machine is assigned, so the machine runs the combined program.
      const resolved = resolveWash(products, product.id, extra);
      if (resolved.notice) notices.push(resolved.notice);
      const extraCents = extraChargeCents(rates, "washer", extra, tier);
      for (let i = 0; i < qty; i += 1) {
        resolved.lines.forEach((line, lineIndex) => {
          let priceCents = line.priceCents;
          if (pkg) {
            // First line carries the package share; a merged program also carries the extra charge,
            // a separate extra load is charged the extra rate on its own.
            priceCents = lineIndex === 0 ? shares[index] + (resolved.merged ? extraCents : 0) : extraCents;
          }
          services.push({
            lineId: crypto.randomUUID(),
            productId: line.id,
            quantity: 1,
            priceCents,
            ...(resolved.merged && resolved.note ? { note: resolved.note } : {}),
          });
        });
      }
    }
    if (services.length > 30) {
      sendJson(res, 400, { ok: false, message: "Too many loads in one order." });
      return;
    }

    const now = new Date().toISOString();
    const order = {
      id: `wk-${crypto.randomUUID()}`,
      branchId: "b1",
      source: "tlp_pos",
      orderNumber: await nextOrderNumber(),
      customerName,
      contactNumber: contactNumber || undefined,
      notes: notes || undefined,
      services,
      ...(tier === "titan" ? { tier } : {}),
      ...(pkg ? { packageId: pkg.id, packageName: pkg.name } : {}),
      assignments: [],
      status: "queued",
      paymentStatus: "paid",
      fulfillmentStage: "queued",
      createdAt: now,
      updatedAt: now,
    };

    const rows = await supabaseRequest("tlp_job_orders", {
      method: "POST",
      body: JSON.stringify({ ...toJobOrderRow(order), payment_method: paymentMethod }),
      headers: { Prefer: "return=representation" },
    });

    sendJson(res, 200, { ok: true, jobOrder: rows?.[0] ? fromJobOrderRow(rows[0]) : order, notice: notices.length ? [...new Set(notices)].join(" ") : undefined });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to create order." });
  }
}
