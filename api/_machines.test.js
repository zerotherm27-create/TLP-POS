import test from "node:test";
import assert from "node:assert/strict";
import { computeStage, dryerBlockedByWasher, pairNumber } from "./_machines.js";

const products = [
  { id: "w35", machineKind: "washer", durationMinutes: 35 },
  { id: "d30", machineKind: "dryer", durationMinutes: 30 },
];
const machines = [
  { id: "m1", name: "Washer 1", kind: "washer", public_code: "W1" },
  { id: "m2", name: "Washer 2", kind: "washer", public_code: "W2" },
  { id: "m5", name: "Washer 5", kind: "washer", public_code: "W5" },
  { id: "m6", name: "Dryer 1", kind: "dryer", public_code: "D1" },
  { id: "m7", name: "Dryer 2", kind: "dryer", public_code: "D2" },
  { id: "m8", name: "Dryer 3", kind: "dryer", public_code: "D3" },
  { id: "m10", name: "Dryer 5", kind: "dryer", public_code: "D5" },
];
const byId = (id) => machines.find((m) => m.id === id);

// Two bags: wash 1, wash 2, dry 1, dry 2.
const services = [
  { lineId: "lw1", productId: "w35" },
  { lineId: "lw2", productId: "w35" },
  { lineId: "ld1", productId: "d30" },
  { lineId: "ld2", productId: "d30" },
];
const asg = (lineId, machineId, productId, finishedAt) => ({ lineId, machineId, productId, assignedAt: "2026-11-08T10:00:00Z", ...(finishedAt ? { finishedAt } : {}) });

test("machines pair by the number at the end of their code", () => {
  assert.equal(pairNumber(byId("m1")), 1);
  assert.equal(pairNumber(byId("m7")), 2);
  assert.equal(pairNumber({ publicCode: "D5" }), 5); // a mapped machine works too
  assert.equal(pairNumber({}), null);
});

test("a dryer waits for the washer with its own number, W1 with D1", () => {
  const order = { services, assignments: [asg("lw1", "m1", "w35"), asg("ld1", "m6", "d30")] };
  assert.deepEqual(dryerBlockedByWasher(order, byId("m6"), machines, products), { waitingFor: "Washer 1" });
  order.assignments[0].finishedAt = "2026-11-08T10:35:00Z";
  assert.equal(dryerBlockedByWasher(order, byId("m6"), machines, products), null);
});

test("two bags: D1 unlocks when W1 ends even if W2 is still washing", () => {
  const order = {
    services,
    assignments: [asg("lw1", "m1", "w35", "2026-11-08T10:35:00Z"), asg("lw2", "m2", "w35"), asg("ld1", "m6", "d30"), asg("ld2", "m7", "d30")],
  };
  assert.equal(dryerBlockedByWasher(order, byId("m6"), machines, products), null);
  assert.deepEqual(dryerBlockedByWasher(order, byId("m7"), machines, products), { waitingFor: "Washer 2" });
});

test("a dryer whose number has no washer on the order waits for all the order's washers", () => {
  const order = { services, assignments: [asg("lw1", "m1", "w35", "2026-11-08T10:35:00Z"), asg("lw2", "m2", "w35"), asg("ld1", "m8", "d30")] };
  assert.deepEqual(dryerBlockedByWasher(order, byId("m8"), machines, products), { waitingFor: "Washer 2" });
  order.assignments[1].finishedAt = "2026-11-08T10:40:00Z";
  assert.equal(dryerBlockedByWasher(order, byId("m8"), machines, products), null);
});

test("several unfinished washers are named together", () => {
  const order = { services, assignments: [asg("lw1", "m1", "w35"), asg("lw2", "m2", "w35"), asg("ld1", "m8", "d30")] };
  assert.deepEqual(dryerBlockedByWasher(order, byId("m8"), machines, products), { waitingFor: "the washers" });
});

test("a wash load with no machine yet keeps an unpaired dryer waiting", () => {
  const order = { services, assignments: [asg("ld1", "m8", "d30")] };
  assert.deepEqual(dryerBlockedByWasher(order, byId("m8"), machines, products), { waitingFor: "the washer" });
});

test("a dry-only order never waits", () => {
  const order = { services: [{ lineId: "ld1", productId: "d30" }], assignments: [asg("ld1", "m6", "d30")] };
  assert.equal(dryerBlockedByWasher(order, byId("m6"), machines, products), null);
});

test("the larger machines pair too, W5 with D5", () => {
  const order = { services: services.slice(0, 1).concat(services.slice(2, 3)), assignments: [asg("lw1", "m5", "w35"), asg("ld1", "m10", "d30")] };
  assert.deepEqual(dryerBlockedByWasher(order, byId("m10"), machines, products), { waitingFor: "Washer 5" });
});

test("the order stays washing while a washer runs, even with a dryer queued", () => {
  const order = { assignments: [asg("lw1", "m1", "w35"), asg("ld1", "m6", "d30")] };
  assert.equal(computeStage(order, products), "washing");
  order.assignments[0].finishedAt = "2026-11-08T10:35:00Z";
  assert.equal(computeStage(order, products), "drying");
});

test("stage with no machines, or only a finished wash", () => {
  assert.equal(computeStage({ assignments: [] }, products), "queued");
  assert.equal(computeStage({ assignments: [asg("lw1", "m1", "w35", "2026-11-08T10:35:00Z")] }, products), "washing");
});

test("a dryer queued before its washer is assigned still moves to drying once the wash ends", () => {
  const order = { assignments: [asg("ld1", "m6", "d30"), asg("lw1", "m1", "w35", "2026-11-08T10:35:00Z")] };
  assert.equal(computeStage(order, products), "drying");
});
