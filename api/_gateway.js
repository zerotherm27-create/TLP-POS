import { loadProducts } from "./_catalog.js";
import { fromMachineRow } from "./_machines.js";
import { fromJobOrderRow, sendJson, supabaseRequest } from "./_supabase.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const requireGateway = (req, res) => {
  const expected = process.env.GATEWAY_API_TOKEN;
  if (!expected) {
    sendJson(res, 500, { ok: false, message: "Gateway API token is not configured." });
    return null;
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-gateway-token"];
  if (token !== expected) {
    sendJson(res, 401, { ok: false, message: "Gateway access denied." });
    return null;
  }

  const gatewayId = String(req.headers["x-gateway-id"] || process.env.GATEWAY_ID || "z83-local");
  if (!ID_RE.test(gatewayId)) {
    sendJson(res, 400, { ok: false, message: "Invalid gateway id." });
    return null;
  }
  return { gatewayId };
};

export const queueMachineStartCommand = async ({ machineRow, operatorId }) => {
  if (!machineRow.active_job_order_id) return null;

  const orders = await supabaseRequest(`tlp_job_orders?id=eq.${encodeURIComponent(machineRow.active_job_order_id)}&limit=1`);
  if (!orders?.length) return null;

  const order = fromJobOrderRow(orders[0]);
  const assignment = order.assignments.find((a) => a.machineId === machineRow.id && !a.startedAt && !a.finishedAt);
  if (!assignment) return null;

  const products = await loadProducts();
  const product = products.find((p) => p.id === assignment.productId);
  if (!product) return null;

  const machine = fromMachineRow(machineRow);
  const request = {
    commandId: crypto.randomUUID(),
    machine: {
      id: machine.id,
      name: machine.name,
      espIp: machine.espIp,
      kind: machine.kind
    },
    product: {
      id: product.id,
      name: product.name,
      pulse: product.pulse,
      pushDelayMs: product.pushDelayMs,
      durationMinutes: product.durationMinutes
    },
    mode: "real"
  };

  await supabaseRequest("tlp_machine_commands", {
    method: "POST",
    body: JSON.stringify({
      id: request.commandId,
      branch_id: machine.branchId,
      machine_id: machine.id,
      product_id: product.id,
      gateway_id: process.env.GATEWAY_ID || "z83-local",
      status: "queued",
      requested_by: operatorId,
      request
    }),
    headers: { Prefer: "return=minimal" }
  });

  return request.commandId;
};

export const failMachineStartCommand = async (commandId, error) => {
  if (!commandId) return;
  const completedAt = new Date().toISOString();
  await supabaseRequest(`tlp_machine_commands?id=eq.${encodeURIComponent(commandId)}&status=eq.queued`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "failed",
      completed_at: completedAt,
      error: String(error ?? "Machine start was not completed.").slice(0, 1000),
      result: { ok: false, response: String(error ?? "Machine start was not completed.").slice(0, 1000), completedAt }
    }),
    headers: { Prefer: "return=minimal" }
  });
};
