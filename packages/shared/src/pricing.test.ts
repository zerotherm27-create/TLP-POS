import test from "node:test";
import assert from "node:assert/strict";
import { allocatePackagePrice, extraChargeCents } from "./pricing.js";

test("shared copy matches the server: allocation adds up and follows program prices", () => {
  assert.deepEqual(allocatePackagePrice(33000, [{ priceCents: 10000 }, { priceCents: 5000 }]), [22000, 11000]);
  assert.deepEqual(allocatePackagePrice(33001, [{ priceCents: 0 }, { priceCents: 0 }]), [16501, 16500]);
  assert.equal(allocatePackagePrice(12345, [{ priceCents: 3333 }, { priceCents: 7777 }]).reduce((a, b) => a + b, 0), 12345);
});

test("shared copy matches the server: extra minutes rate", () => {
  const rates = { washCentsPer10: 2000, dryCentsPer10: 1500 };
  assert.equal(extraChargeCents(rates, "washer", 30), 6000);
  assert.equal(extraChargeCents(rates, "dryer", 20), 3000);
});
