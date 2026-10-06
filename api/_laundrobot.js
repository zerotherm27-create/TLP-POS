import { createRequire } from "module";
import { allocatePackagePrice, resolveExtra } from "./_catalog.js";
import { supabaseRequest, toJobOrderRow } from "./_supabase.js";

const require = createRequire(import.meta.url);
const products = require("./_products.json");

/**
 * LaundroBot order types that are sold as one of your packages. Matched on the service name or any chosen option
 * (case-insensitive). Each bag/load becomes the package's programs (e.g. a wash + a dry).
 * Add a line here for another LaundroBot service that should become a package.
 */
export const PACKAGE_RULES = [
  { test: /full service|machine wash/i, packageName: "FULL - CARE EXPRESS" },
];

export const requireSyncToken = (req) => {
  const expected = process.env.LAUNDROBOT_SYNC_TOKEN;
  if (!expected) return;
  const received = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (received !== expected) {
    throw new Error("Invalid LaundroBot sync token.");
  }
};

export const fetchLaundrobotOrders = async () => {
  const baseUrl = process.env.LAUNDROBOT_API_URL;
  const apiKey = process.env.LAUNDROBOT_API_KEY;

  if (!baseUrl) {
    throw new Error("LAUNDROBOT_API_URL is not configured.");
  }

  const res = await fetch(`${baseUrl}/api/orders?status=pending`, {
    headers: {
      "x-api-key": apiKey ?? "",
      "content-type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`LaundroBot API responded with ${res.status}.`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data.orders ?? []);
};

// LaundroBot raw order format:
// {
//   id: string,
//   customerName: string,
//   contactNumber?: string,
//   notes?: string,
//   orderUrl?: string,
//   services: [{ kind: string, durationMinutes?: number, quantity?: number, priceCents?: number, serviceName?: string, size?: string, options?: string[], extras?: [{ kind, minutes }], weightKg?: number }]
// }
// Returns null when the order contains no machine-wash/dry services (e.g. handwash, dryclean).
export const mapLaundrobotOrder = (rawOrder, { largeKg = 10, packages = [] } = {}) => {
  // Only import services that map to a TLP machine product (washer/dryer).
  // Other kinds (handwash, dryclean, fold, etc.) are silently skipped.
  let matchedPackage = null;
  const services = (rawOrder.services ?? []).flatMap((s) => {
    const count = Math.max(1, Math.round(Number(s.quantity ?? 1)) || 1);

    // What the customer picked, in the words LaundroBot uses (e.g. "CLOTHES FULL SERVICE GIANT (max 8kg / load)").
    const serviceName = typeof s.serviceName === "string" ? s.serviceName.trim() : "";
    const size = typeof s.size === "string" ? s.size.trim() : "";
    const options = Array.isArray(s.options) ? s.options.filter((o) => typeof o === "string").map((o) => o.trim()).filter(Boolean) : [];
    const label = size || options.find((o) => /kg/i.test(o)) || options[0] || serviceName;
    const text = [serviceName, size, ...options].join(" ");

    // A "Large bag" (about 10-12 kg) belongs in the larger machines (W5 / D5). "Large" or "Titan" in any option decides;
    // "Giant" is the regular size. The stated maximum (max 12kg) or a recorded weight at or above the threshold counts as a backup.
    const statedMax = Number(/(\d+(?:\.\d+)?)\s*kg/i.exec(label)?.[1]);
    const totalKg = Number(s.weightKg);
    const perBagKg = Number.isFinite(totalKg) && totalKg > 0 ? Math.round((totalKg / count) * 10) / 10 : NaN;
    const hasWeight = Number.isFinite(perBagKg);
    const large =
      /\b(large|titan)\b/i.test(text) ||
      (Number.isFinite(statedMax) && statedMax >= largeKg) ||
      (hasWeight && perBagKg >= largeKg);
    const weightKg = perBagKg;
    const extras = {
      ...(hasWeight ? { weightKg } : {}),
      ...(label ? { note: label } : {}),
      ...(large ? { tier: "titan" } : {}),
    };

    // 1) A service that is sold as one of your packages: every bag becomes the package's programs.
    const rule = PACKAGE_RULES.find((r) => r.test.test(text));
    const pkg = rule
      ? packages.find((p) => String(p.name).trim().toLowerCase() === rule.packageName.toLowerCase() && Array.isArray(p.services) && p.services.length > 0)
      : null;
    if (pkg) {
      const programs = pkg.services.map((id) => products.find((p) => p.id === id)).filter(Boolean);
      if (programs.length > 0) {
        matchedPackage = matchedPackage ?? pkg;
        const perBagCents = s.priceCents != null ? Math.round(s.priceCents / count) : undefined;
        const shares = perBagCents != null ? allocatePackagePrice(perBagCents, programs) : [];
        // "+10 Mins Wash/Dry" add-ons: each 10-minute unit goes to a different bag in turn (bag 1, bag 2, ...), so
        // "+10 x 1" on two bags extends one bag, and "+10 x 2" extends both. Each bag's extra merges into a program.
        const extraUnits = (kind) =>
          Math.min(30, Math.max(0, Math.round(((Array.isArray(s.extras) ? s.extras : []).filter((e) => e?.kind === kind).reduce((t, e) => t + Number(e.minutes || 0), 0)) / 10)));
        const unitsFor = (kind, bag) => {
          const total = extraUnits(kind);
          return Math.min(3, Math.floor(total / count) + (bag < total % count ? 1 : 0)) * 10;
        };
        return Array.from({ length: count }, (_unused, bag) =>
          programs.flatMap((program, i) => {
            const resolved = resolveExtra(products, program.id, unitsFor(program.machineKind, bag));
            const used = resolved.lines.length ? resolved.lines : [program];
            return used.map((line, lineIndex) => ({
              lineId: crypto.randomUUID(),
              productId: line.id,
              quantity: 1,
              ...(shares.length ? { priceCents: lineIndex === 0 ? shares[i] : 0 } : {}),
              ...extras,
              ...(resolved.merged ? { note: `${label ? label + " · " : ""}${resolved.note}` } : {}),
            }));
          })
        ).flat();
      }
    }

    // 2) Otherwise: a service LaundroBot has tagged as a washer/dryer with a cycle length that matches one of your programs.
    const product = products.find((p) => p.machineKind === s.kind && p.durationMinutes === s.durationMinutes);
    if (!product) return []; // not a machine service — skip

    // Expand quantity into one line per load so each load gets its own machine assignment.
    const pricePerLoad = s.priceCents != null ? Math.round(s.priceCents / count) : undefined;
    return Array.from({ length: count }, () => ({
      lineId: crypto.randomUUID(),
      productId: product.id,
      quantity: 1,
      priceCents: pricePerLoad,
      ...extras,
    }));
  });

  if (services.length === 0) return null; // nothing to assign in TLP POS

  return {
    externalOrderId: String(rawOrder.id),
    externalOrderUrl: rawOrder.orderUrl ?? undefined,
    customerName: rawOrder.customerName,
    contactNumber: rawOrder.contactNumber ?? undefined,
    notes: rawOrder.notes ?? undefined,
    services,
    tier: services.some((l) => l.tier === "titan") ? "titan" : undefined,
    ...(matchedPackage ? { packageId: matchedPackage.id, packageName: matchedPackage.name } : {}),
  };
};

export const buildOrderBundle = (mapped) => {
  const now = new Date().toISOString();
  const jobOrder = {
    id: crypto.randomUUID(),
    branchId: process.env.BRANCH_ID ?? "b1",
    source: "laundrobot",
    externalOrderId: mapped.externalOrderId,
    externalOrderUrl: mapped.externalOrderUrl,
    customerName: mapped.customerName,
    contactNumber: mapped.contactNumber,
    notes: mapped.notes,
    services: mapped.services ?? [],
    ...(mapped.tier ? { tier: mapped.tier } : {}),
    ...(mapped.packageId ? { packageId: mapped.packageId, packageName: mapped.packageName } : {}),
    assignments: [],
    status: "queued",
    paymentStatus: "unpaid",
    fulfillmentStage: "queued",
    createdAt: now,
    updatedAt: now,
  };
  return { jobOrder };
};

export const persistOrderBundle = async (bundle) => {
  await supabaseRequest("tlp_job_orders", {
    method: "POST",
    body: JSON.stringify(toJobOrderRow(bundle.jobOrder)),
    headers: { Prefer: "return=minimal" },
  });
};
