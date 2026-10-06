import { createRequire } from "module";
import { supabaseRequest, toJobOrderRow } from "./_supabase.js";

const require = createRequire(import.meta.url);
const products = require("./_products.json");

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
//   services: [{ kind: string, durationMinutes?: number, quantity?: number, priceCents?: number, serviceName?: string, weightKg?: number }]
// }
// Returns null when the order contains no machine-wash/dry services (e.g. handwash, dryclean).
export const mapLaundrobotOrder = (rawOrder, { largeKg = 10 } = {}) => {
  // Only import services that map to a TLP machine product (washer/dryer).
  // Other kinds (handwash, dryclean, fold, etc.) are silently skipped.
  const services = (rawOrder.services ?? []).flatMap((s) => {
    const product = products.find(
      (p) => p.machineKind === s.kind && p.durationMinutes === s.durationMinutes
    );
    if (!product) return []; // not a machine service — skip

    // Expand quantity into one line per load so each load gets its own machine assignment.
    const count = s.quantity ?? 1;
    const pricePerLoad = s.priceCents != null ? Math.round(s.priceCents / count) : undefined;
    // A "Large bag" (about 10-12 kg) belongs in the larger machines (W5 / D5). The service name decides;
    // a recorded weight at or above the threshold does too, as a backup for services that are priced per kg.
    const serviceName = typeof s.serviceName === "string" ? s.serviceName.trim() : "";
    const weightKg = Number(s.weightKg);
    const hasWeight = Number.isFinite(weightKg) && weightKg > 0;
    const large = /\blarge\b/i.test(serviceName) || (hasWeight && weightKg >= largeKg);
    return Array.from({ length: count }, () => ({
      lineId: crypto.randomUUID(),
      productId: product.id,
      quantity: 1,
      priceCents: pricePerLoad,
      ...(hasWeight ? { weightKg } : {}),
      ...(serviceName ? { note: serviceName } : {}),
      ...(large ? { tier: "titan" } : {}),
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
