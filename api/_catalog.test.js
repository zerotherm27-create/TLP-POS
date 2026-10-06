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
