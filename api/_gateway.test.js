import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "http://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.GATEWAY_ID = "z83-local";

const { failMachineStartCommand, queueMachineStartCommand, requireGateway } = await import("./_gateway.js");

const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body)
});

const makeRes = () => {
  const res = { headers: {}, body: "" };
  res.setHeader = (key, value) => { res.headers[key] = value; };
  res.end = (body) => { res.body = body; };
  return res;
};

test("gateway auth accepts the configured bearer token and rejects bad tokens", () => {
  process.env.GATEWAY_API_TOKEN = "secret";

  const ok = makeRes();
  assert.deepEqual(requireGateway({ headers: { authorization: "Bearer secret", "x-gateway-id": "z83-local" } }, ok), {
    gatewayId: "z83-local"
  });

  const denied = makeRes();
  assert.equal(requireGateway({ headers: { authorization: "Bearer wrong" } }, denied), null);
  assert.equal(denied.statusCode, 401);
  assert.deepEqual(JSON.parse(denied.body), { ok: false, message: "Gateway access denied." });
});

test("starting a machine queues exactly the assigned product command for the gateway", async () => {
  const inserted = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname + new URL(url).search;
    if (path.startsWith("/rest/v1/tlp_job_orders")) {
      return reply([{
        id: "job-1",
        branch_id: "b1",
        source: "tlp_pos",
        customer_name: "Maria",
        services: [],
        assignments: [{ lineId: "line-1", machineId: "washer-1", productId: "wash-35", assignedAt: "now" }],
        status: "queued",
        payment_status: "paid",
        fulfillment_stage: "washing",
        created_at: "2026-10-09T00:00:00.000Z",
        updated_at: "2026-10-09T00:00:00.000Z"
      }]);
    }
    if (path.startsWith("/rest/v1/tlp_settings")) {
      return reply([{ value: [{ id: "wash-35", name: "Wash 35", pulse: 1, pushDelayMs: 500, durationMinutes: 35 }] }]);
    }
    if (path.startsWith("/rest/v1/tlp_machine_commands") && options.method === "POST") {
      inserted.push(JSON.parse(options.body));
      return reply(null);
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  const commandId = await queueMachineStartCommand({
    machineRow: {
      id: "washer-1",
      name: "Washer 1",
      kind: "washer",
      branch_id: "b1",
      esp_ip: "192.168.210.6",
      public_code: "W1",
      status: "running",
      active_job_order_id: "job-1",
      remaining_minutes: 35,
      last_seen_at: "2026-10-09T00:00:00.000Z",
      cycle_count: 10,
      total_run_minutes: 350,
      last_tub_clean_cycle: 8
    },
    operatorId: "user-1"
  });

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].id, commandId);
  assert.equal(inserted[0].gateway_id, "z83-local");
  assert.equal(inserted[0].status, "queued");
  assert.equal(inserted[0].request.machine.espIp, "192.168.210.6");
  assert.equal(inserted[0].request.product.id, "wash-35");
  assert.equal(inserted[0].request.mode, "real");
});

test("a prepared machine command can be marked failed if the guarded start loses a race", async () => {
  const patches = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname + new URL(url).search;
    if (path.startsWith("/rest/v1/tlp_machine_commands") && options.method === "PATCH") {
      patches.push({ path, body: JSON.parse(options.body) });
      return reply(null);
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  await failMachineStartCommand("cmd-1", "Machine start was claimed by another request.");

  assert.equal(patches.length, 1);
  assert.match(patches[0].path, /id=eq\.cmd-1/);
  assert.match(patches[0].path, /status=eq\.queued/);
  assert.equal(patches[0].body.status, "failed");
  assert.equal(patches[0].body.result.ok, false);
  assert.match(patches[0].body.error, /claimed/);
});
