import test from "node:test";
import assert from "node:assert/strict";
import { resolveWash } from "./_catalog.js";

const P = (id, kind, min, extra = {}) => ({ id, machineKind: kind, name: `${min} min`, durationMinutes: min, priceCents: min * 100, pulse: 1, pushDelayMs: 0, ...extra });
const products = [P("w10", "washer", 10), P("w35", "washer", 35), P("w45", "washer", 45, { pulse: 2 }), P("d10", "dryer", 10), P("d45", "dryer", 45)];

test("35 + 10 extra merges into the existing 45-min washer program", () => {
  const r = resolveWash(products, "w35", 10);
  assert.equal(r.merged, true);
  assert.deepEqual(r.lines.map((p) => p.id), ["w45"]);
  assert.equal(r.lines[0].pulse, 2); // the machine runs the 45-min program's own pulses
  assert.equal(r.note, "35 min + 10 min extra");
  assert.equal(r.notice, undefined);
});

test("no extra minutes leaves the program untouched", () => {
  const r = resolveWash(products, "w35", 0);
  assert.deepEqual(r.lines.map((p) => p.id), ["w35"]);
  assert.equal(r.merged, false);
});

test("a dryer program is never used to satisfy an extra wash", () => {
  const r = resolveWash(products, "w35", 10);
  assert.equal(r.lines[0].machineKind, "washer");
});

test("no matching total: the extra stays a separate load and staff are told", () => {
  const r = resolveWash(products, "w35", 20); // there is no 55-min program, but a 10... use 20 -> no 20-min program either
  assert.equal(r.merged, false);
  assert.match(r.notice, /no 55-min wash program/);
  assert.deepEqual(r.lines.map((p) => p.id), ["w35"]); // and no 20-min program to add
  const sep = resolveWash(products, "w45", 10); // 55 does not exist, but a 10-min program does
  assert.deepEqual(sep.lines.map((p) => p.id), ["w45", "w10"]);
  assert.match(sep.notice, /separate wash load/);
});

test("unknown program returns nothing", () => {
  assert.deepEqual(resolveWash(products, "nope", 10).lines, []);
});

import { allocatePackagePrice, extraChargeCents } from "./_catalog.js";

test("package price splits across the loads and always adds up exactly", () => {
  // 330 with a 35-min wash (₱100) and a 30-min dry (₱50): 2/3 and 1/3
  assert.deepEqual(allocatePackagePrice(33000, [{ priceCents: 10000 }, { priceCents: 5000 }]), [22000, 11000]);
  // no program prices: equal split, odd cent goes to the first load
  assert.deepEqual(allocatePackagePrice(33001, [{ priceCents: 0 }, { priceCents: 0 }]), [16501, 16500]);
  for (const price of [0, 1, 999, 33000, 12345]) {
    const parts = allocatePackagePrice(price, [{ priceCents: 3333 }, { priceCents: 7777 }, { priceCents: 1 }]);
    assert.equal(parts.reduce((a, b) => a + b, 0), price);
  }
  assert.deepEqual(allocatePackagePrice(500, []), []);
});

test("extra minutes are charged per 10 minutes at the admin rate", () => {
  const rates = { washCentsPer10: 2000, dryCentsPer10: 1500 };
  assert.equal(extraChargeCents(rates, "washer", 10), 2000);
  assert.equal(extraChargeCents(rates, "washer", 30), 6000);
  assert.equal(extraChargeCents(rates, "dryer", 20), 3000);
  assert.equal(extraChargeCents(rates, "dryer", 0), 0);
  assert.equal(extraChargeCents(undefined, "dryer", 10), 0); // not set yet
});

test("larger (titan) machines can have their own extra-time rate, falling back to the regular one", () => {
  const rates = { washCentsPer10: 2000, dryCentsPer10: 1500, titanWashCentsPer10: 3000, titanDryCentsPer10: 0 };
  assert.equal(extraChargeCents(rates, "washer", 20, "giant"), 4000);
  assert.equal(extraChargeCents(rates, "washer", 20, "titan"), 6000);
  assert.equal(extraChargeCents(rates, "dryer", 10, "titan"), 1500); // titan dry rate not set -> regular rate
  assert.equal(extraChargeCents({ washCentsPer10: 2000, dryCentsPer10: 1500 }, "washer", 10, "titan"), 2000);
});
