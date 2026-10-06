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

test("your second LaundroBot order: FULL SERVICE - CLOTHES, GIANT (max 8kg / load), quantity 2 -> two regular loads at 290 each", () => {
  const m = mapLaundrobotOrder(raw([{
    kind: "washer", durationMinutes: 35, quantity: 2, priceCents: 58000,
    serviceName: "FULL SERVICE - CLOTHES",
    options: ["CLOTHES FULL SERVICE GIANT (max 8kg / load)"],
  }]));
  assert.equal(m.services.length, 2);
  assert.deepEqual(m.services.map((l) => l.tier), [undefined, undefined]); // giant = regular machines
  assert.deepEqual(m.services.map((l) => l.priceCents), [29000, 29000]);
  assert.equal(m.services[0].note, "CLOTHES FULL SERVICE GIANT (max 8kg / load)");
  assert.equal(m.tier, undefined);
});

test("the size can be in any option: Titan or Large, or a stated max of 10 kg or more, means the larger machines", () => {
  const one = (options) => mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, quantity: 1, serviceName: "FULL SERVICE - CLOTHES", options }])).services[0];
  assert.equal(one(["CLOTHES FULL SERVICE TITAN (max 12kg / load)"]).tier, "titan");
  assert.equal(one(["Colored", "Large Bag"]).tier, "titan");
  assert.equal(one(["CLOTHES FULL SERVICE JUMBO (max 12kg / load)"]).tier, "titan"); // stated max
  assert.equal(one(["Colored", "Standard ( 3 Days )"]).tier, undefined);
  assert.equal(one([]).tier, undefined);
});

const FULL_CARE = { id: "pkg-full", name: "FULL - CARE EXPRESS", services: ["p2", "p5"] }; // 35 min wash + 30 min dry

test("order 1 (FULL SERVICE - CLOTHES, GIANT max 8kg, quantity 2, PHP 580) becomes 2 x [wash 35 + dry 30] on regular machines", () => {
  const m = mapLaundrobotOrder(
    raw([{
      quantity: 2, priceCents: 58000, // no machine tags needed: the service name is recognised
      serviceName: "FULL SERVICE - CLOTHES",
      options: ["CLOTHES MACHINE WASH : CLOTHES FULL SERVICE GIANT (max 8kg / load)"],
    }]),
    { packages: [FULL_CARE] }
  );
  assert.deepEqual(m.services.map((l) => l.productId), ["p2", "p5", "p2", "p5"]); // wash, dry, wash, dry
  assert.deepEqual(m.services.map((l) => l.tier), [undefined, undefined, undefined, undefined]);
  assert.equal(m.services.reduce((t, l) => t + l.priceCents, 0), 58000); // the whole PHP 580 is accounted for
  assert.deepEqual(m.services.slice(0, 2).map((l) => l.priceCents), [14500, 14500]); // PHP 290 per load, split wash/dry
  assert.equal(m.packageName, "FULL - CARE EXPRESS");
  assert.equal(m.tier, undefined);
});

test("order 2 (Clothes - Machine Wash, Large Bag max 12kg, quantity 2, PHP 1,100) becomes 2 x [wash + dry] on the LARGE machines", () => {
  const m = mapLaundrobotOrder(
    raw([{
      quantity: 2, priceCents: 110000,
      serviceName: "Clothes - Machine Wash",
      size: "Large Bag (max 12kg/bag)",
      options: ["Colored", "Large Bag (max 12kg/bag)", "Standard ( 3 Days )"],
    }]),
    { packages: [FULL_CARE] }
  );
  assert.equal(m.services.length, 4);
  assert.deepEqual(m.services.map((l) => l.tier), ["titan", "titan", "titan", "titan"]); // dryer lines are large too, so they pair with W5 -> D5
  assert.equal(m.services.reduce((t, l) => t + l.priceCents, 0), 110000);
  assert.equal(m.services[0].note, "Large Bag (max 12kg/bag)");
  assert.equal(m.packageName, "FULL - CARE EXPRESS");
  assert.equal(m.tier, "titan");
});

test("if the package isn't found, a recognised order is not invented; tagged services still import the old way", () => {
  const untagged = mapLaundrobotOrder(raw([{ quantity: 1, serviceName: "FULL SERVICE - CLOTHES" }]), { packages: [] });
  assert.equal(untagged, null); // nothing to assign -> skipped
  const tagged = mapLaundrobotOrder(raw([{ kind: "washer", durationMinutes: 35, quantity: 1, serviceName: "Handwash" }]), { packages: [] });
  assert.equal(tagged.services.length, 1);
});

test("services that are not machine services (handwash, dry cleaning) are skipped", () => {
  assert.equal(mapLaundrobotOrder(raw([{ quantity: 1, serviceName: "Dry cleaning - Suit", options: ["Dark"] }]), { packages: [FULL_CARE] }), null);
});
