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

test('a "Large bag" service goes to the larger machines; small and medium bags do not', () => {
  const line = (serviceName, extra = {}) => mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, serviceName, ...extra }])).services[0];
  assert.equal(line("Large bag").tier, "titan");
  assert.equal(line("LARGE BAG (10-12kg)").tier, "titan");
  assert.equal(line("Medium bag").tier, undefined);
  assert.equal(line("Small bag").tier, undefined);
  assert.equal(line("Large bag").note, "Large bag"); // staff see which bag it was
  assert.equal(line("Enlarged hamper").tier, undefined); // only the whole word "large"
});

test("weight is only the backup: a medium bag over the threshold is still treated as large, a large bag with no weight is large", () => {
  const one = (name, weightKg) => mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, serviceName: name, weightKg }])).services[0];
  assert.equal(one("Large bag", undefined).tier, "titan");
  assert.equal(one("Medium bag", 10).tier, "titan"); // default threshold is now 10 kg
  assert.equal(one("Medium bag", 9.5).tier, undefined);
});

test("your real LaundroBot order: Clothes - Machine Wash, Size: Large Bag (max 12kg/bag), Quantity 2 -> two large loads, price split", () => {
  const m = mapLaundrobotOrder(raw([{
    kind: "washer", durationMinutes: 35, quantity: 2, priceCents: 110000,
    serviceName: "Clothes - Machine Wash", size: "Large Bag (max 12kg/bag)",
  }]));
  assert.equal(m.services.length, 2); // one load per bag
  assert.deepEqual(m.services.map((l) => l.tier), ["titan", "titan"]);
  assert.deepEqual(m.services.map((l) => l.priceCents), [55000, 55000]); // PHP 1,100 split across the two bags
  assert.equal(m.services[0].note, "Large Bag (max 12kg/bag)");
  assert.equal(m.tier, "titan");
});

test("medium and small bags stay on the regular machines, even when the service name has no size", () => {
  const one = (size) => mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, quantity: 1, serviceName: "Clothes - Machine Wash", size }])).services[0];
  assert.equal(one("Medium Bag (max 8kg/bag)").tier, undefined);
  assert.equal(one("Small Bag (max 5kg/bag)").tier, undefined);
  assert.equal(one("Large Bag (max 12kg/bag)").tier, "titan");
  assert.equal(one(undefined).tier, undefined);
  // stated maximum alone decides when a size is worded differently
  assert.equal(one("Jumbo (max 12kg)").tier, "titan");
});

test("a recorded total weight is divided across the bags before comparing", () => {
  const two = (kg) => mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, quantity: 2, weightKg: kg }])).services[0];
  assert.equal(two(24).tier, "titan"); // 12 kg per bag
  assert.equal(two(16).tier, undefined); // 8 kg per bag
  assert.equal(two(24).weightKg, 12);
});
