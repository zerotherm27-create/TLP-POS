import test from "node:test";
import assert from "node:assert/strict";
import { mapLaundrobotOrder } from "./_laundrobot.js";

const raw = (services) => ({ id: "BKG-1", customerName: "Maria", services });

test("a 12 kg load from LaundroBot is marked large (W5 / D5); lighter loads stay regular", () => {
  const heavy = mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, quantity: 1, priceCents: 33000, weightKg: 12 }]));
  assert.equal(heavy.services[0].tier, "titan");
  assert.equal(heavy.services[0].weightKg, 12);
  assert.equal(heavy.tier, "titan");

  const light = mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, quantity: 1, priceCents: 33000, weightKg: 8 }]));
  assert.equal(light.services[0].tier, undefined);
  assert.equal(light.services[0].weightKg, 8);
  assert.equal(light.tier, undefined);
});

test("the threshold is adjustable and no weight means regular machines", () => {
  const svc = { kind: "washer", durationMinutes: 35, weightKg: 10 };
  assert.equal(mapLaundrobotOrder(raw([svc]), { largeKg: 10 }).services[0].tier, "titan"); // at the threshold counts
  assert.equal(mapLaundrobotOrder(raw([svc]), { largeKg: 12 }).services[0].tier, undefined);
  const none = mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35 }]));
  assert.equal(none.services[0].tier, undefined);
  assert.equal(none.services[0].weightKg, undefined);
  assert.equal(mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, weightKg: "abc" }])).services[0].tier, undefined);
});

test("one booking can mix a large and a regular load, each sized on its own", () => {
  const m = mapLaundrobotOrder(raw([
    { kind: "washer", durationMinutes: 35, weightKg: 12 },
    { kind: "washer", durationMinutes: 35, weightKg: 6 },
  ]));
  assert.deepEqual(m.services.map((l) => l.tier), ["titan", undefined]);
  assert.equal(m.tier, "titan"); // the order carries the Large tag if any load is large
});
