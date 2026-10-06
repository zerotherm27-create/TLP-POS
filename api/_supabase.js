// No cross-site (CORS) headers on purpose: the app calls /api from its own domain, and LaundroBot calls the import
// route server to server, so no other website needs browser access to these routes.
const jsonHeaders = {
  "content-type": "application/json"
};

export const sendJson = (res, statusCode, body) => {
  res.statusCode = statusCode;
  Object.entries(jsonHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
};

export const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

export const ensurePost = (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return false;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "Method not allowed." });
    return false;
  }

  return true;
};

export const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return { url: url.replace(/\/$/, ""), key };
};

export const supabaseRequest = async (path, options = {}) => {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.message ?? body?.hint ?? `Supabase request failed with ${response.status}.`);
  }

  return body;
};

export const toJobOrderRow = (jobOrder) => ({
  id: jobOrder.id,
  branch_id: jobOrder.branchId,
  source: jobOrder.source,
  order_number: jobOrder.orderNumber,
  external_order_id: jobOrder.externalOrderId,
  external_order_url: jobOrder.externalOrderUrl,
  customer_name: jobOrder.customerName,
  contact_number: jobOrder.contactNumber,
  notes: jobOrder.notes,
  services: jobOrder.services,
  assignments: jobOrder.assignments,
  status: jobOrder.status,
  payment_status: jobOrder.paymentStatus,
  fulfillment_stage: jobOrder.fulfillmentStage,
  payment_method: jobOrder.paymentMethod,
  tier: jobOrder.tier,
  package_id: jobOrder.packageId,
  package_name: jobOrder.packageName,
  created_at: jobOrder.createdAt,
  updated_at: jobOrder.updatedAt
});

export const fromJobOrderRow = (row) => ({
  id: row.id,
  branchId: row.branch_id,
  source: row.source,
  orderNumber: row.order_number ?? undefined,
  externalOrderId: row.external_order_id ?? undefined,
  externalOrderUrl: row.external_order_url ?? undefined,
  customerName: row.customer_name,
  contactNumber: row.contact_number ?? undefined,
  notes: row.notes ?? undefined,
  services: row.services ?? [],
  assignments: row.assignments ?? [],
  status: row.status,
  paymentStatus: row.payment_status,
  fulfillmentStage: row.fulfillment_stage,
  paymentMethod: row.payment_method ?? undefined,
  tier: row.tier ?? undefined,
  packageId: row.package_id ?? undefined,
  packageName: row.package_name ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

/**
 * Saves an order only if nobody else saved it since it was read (compares updated_at), so two people working on
 * the same order at once can't overwrite each other's change. Returns true when it was saved.
 */
export const saveOrderIfUnchanged = async (safeId, readUpdatedAt, order) => {
  const guard = readUpdatedAt ? `&updated_at=eq.${encodeURIComponent(readUpdatedAt)}` : "";
  const done = await supabaseRequest(`tlp_job_orders?id=eq.${safeId}${guard}`, {
    method: "PATCH",
    body: JSON.stringify(toJobOrderRow(order)),
    headers: { Prefer: "return=representation" },
  });
  return Array.isArray(done) && done.length > 0;
};

/**
 * Read an order, let `change(order)` edit it in place, and save it. If someone else saved the order in between,
 * read it again and redo the change on the fresh copy. `change` returns a message to stop without saving.
 * Resolves to { status: "saved", order } | { status: "missing" } | { status: "refused", message } | { status: "busy" }.
 */
export const changeOrder = async (safeId, change, tries = 5) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const rows = await supabaseRequest(`tlp_job_orders?id=eq.${safeId}&limit=1`);
    if (!rows?.length) return { status: "missing" };
    const order = fromJobOrderRow(rows[0]);
    const refusal = await change(order);
    if (refusal) return { status: "refused", message: refusal };
    order.updatedAt = new Date().toISOString();
    if (await saveOrderIfUnchanged(safeId, rows[0].updated_at, order)) return { status: "saved", order };
  }
  return { status: "busy" };
};

/** Unexpected failure: keep the details in the server log and give the browser a plain message. */
export const sendServerError = (res, error, fallback) => {
  console.error(fallback, error instanceof Error ? error.message : error);
  sendJson(res, 500, { ok: false, message: fallback });
};

export const toSaleRow = (sale) => ({
  id: sale.id,
  job_order_id: sale.jobOrderId,
  branch_id: sale.branchId,
  operator_id: sale.operatorId,
  payment_method: sale.paymentMethod,
  paid_at: sale.paidAt,
  total_cents: sale.totalCents,
  lines: sale.lines,
  status: sale.status
});

export const fromSaleRow = (row) => ({
  id: row.id,
  jobOrderId: row.job_order_id ?? undefined,
  branchId: row.branch_id,
  operatorId: row.operator_id,
  paymentMethod: row.payment_method,
  paidAt: row.paid_at,
  totalCents: row.total_cents,
  lines: row.lines ?? [],
  status: row.status
});

export const toAuditLogRow = (entry) => ({
  id: entry.id,
  actor_id: entry.actorId,
  action: entry.action,
  entity_type: entry.entityType,
  entity_id: entry.entityId,
  created_at: entry.createdAt,
  metadata: entry.metadata
});

export const fromAuditLogRow = (row) => ({
  id: row.id,
  actorId: row.actor_id,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  createdAt: row.created_at,
  metadata: row.metadata ?? {}
});
