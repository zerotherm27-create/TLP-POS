import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "http://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
const { changeOrder } = await import("./_supabase.js");

// A tiny in-memory stand-in for the orders table: GET reads the row, PATCH only applies when the updated_at guard matches.
const fakeDb = (initial) => {
  const db = { row: { ...initial }, patches: 0 };
  globalThis.fetch = async (url, options = {}) => {
    await new Promise((r) => setTimeout(r, 1)); // let concurrent callers interleave
    const u = new URL(url);
    const reply = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    if (!options.method || options.method === "GET") return reply([structuredClone(db.row)]);
    const guard = u.searchParams.get("updated_at");
    if (guard && guard !== `eq.${db.row.updated_at}`) return reply([]);
    Object.assign(db.row, JSON.parse(options.body));
    db.patches += 1;
    return reply([structuredClone(db.row)]);
  };
  return db;
};
const baseRow = { id: "o1", branch_id: "b1", source: "tlp_pos", customer_name: "A", services: [], assignments: [], status: "queued", payment_status: "paid", fulfillment_stage: "queued", created_at: "2026-10-07T00:00:00.000Z", updated_at: "2026-10-07T00:00:00.000Z" };
const add = (lineId) => (order) => { order.assignments = [...order.assignments, { lineId, machineId: lineId, productId: "p2", assignedAt: "x" }]; };

test("two people changing the same order at once both keep their change", async () => {
  const db = fakeDb(baseRow);
  const [a, b] = await Promise.all([changeOrder("o1", add("w1")), changeOrder("o1", add("w2"))]);
  assert.equal(a.status, "saved");
  assert.equal(b.status, "saved");
  assert.deepEqual(db.row.assignments.map((x) => x.lineId).sort(), ["w1", "w2"]);
});

test("a refusal stops without saving, and a missing order is reported", async () => {
  const db = fakeDb(baseRow);
  const refused = await changeOrder("o1", () => "Nope");
  assert.deepEqual(refused, { status: "refused", message: "Nope" });
  assert.equal(db.patches, 0);
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => "[]" });
  assert.equal((await changeOrder("o1", add("w1"))).status, "missing");
});

test("an order that keeps changing under us gives up as busy instead of overwriting", async () => {
  fakeDb(baseRow);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => (options.method === "PATCH" ? { ok: true, status: 200, text: async () => "[]" } : realFetch(url, options));
  assert.equal((await changeOrder("o1", add("w1"), 3)).status, "busy");
});
