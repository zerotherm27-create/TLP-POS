import test from "node:test";
import assert from "node:assert/strict";
import type { Product } from "./index.js";
import { resolveWash } from "./extraWash.js";

const P = (id: string, kind: "washer" | "dryer", min: number, over: Partial<Product> = {}): Product => ({
  id, machineKind: kind, name: `${min} min`, durationMinutes: min, priceCents: min * 100, pulse: 1, pushDelayMs: 0, ...over,
});
const products = [P("w10", "washer", 10), P("w35", "washer", 35), P("w45", "washer", 45, { pulse: 2 }), P("d45", "dryer", 45)];

test("35 + 10 extra merges into the 45-min washer program (same rule as the server)", () => {
  const r = resolveWash(products, "w35", 10);
  assert.equal(r.merged, true);
  assert.deepEqual(r.lines.map((p) => p.id), ["w45"]);
  assert.equal(r.note, "35 min + 10 min extra");
});

test("no extra minutes, unknown program, and no matching total", () => {
  assert.deepEqual(resolveWash(products, "w35", 0).lines.map((p) => p.id), ["w35"]);
  assert.deepEqual(resolveWash(products, "nope", 10).lines, []);
  const sep = resolveWash(products, "w45", 10);
  assert.deepEqual(sep.lines.map((p) => p.id), ["w45", "w10"]);
  assert.match(sep.notice ?? "", /separate wash load/);
});
