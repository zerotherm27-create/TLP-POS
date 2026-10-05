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
//   services: [{ kind: "washer"|"dryer", durationMinutes: number, quantity: number }]
// }
export const mapLaundrobotOrder = (rawOrder) => {
  const services = (rawOrder.services ?? []).map((s) => {
    const product = products.find(
      (p) => p.machineKind === s.kind && p.durationMinutes === s.durationMinutes
    );
    if (!product) {
      throw new Error(
        `No product found for ${s.kind} ${s.durationMinutes}min. Update api/_products.json.`
      );
    }
    return { productId: product.id, quantity: s.quantity ?? 1 };
  });

  return {
    externalOrderId: String(rawOrder.id),
    externalOrderUrl: rawOrder.orderUrl ?? undefined,
    customerName: rawOrder.customerName,
    contactNumber: rawOrder.contactNumber ?? undefined,
    notes: rawOrder.notes ?? undefined,
    services,
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
