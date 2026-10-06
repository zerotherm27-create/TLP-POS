import test from "node:test";
import assert from "node:assert/strict";
import type { Machine, JobOrder, Product } from "./index.js";
import { rankMachines, computeAlerts, isTubDue } from "./insights.js";

const NOW = Date.parse("2026-10-07T10:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();

const machine = (over: Partial<Machine>): Machine => ({
  id: "m", name: "Washer", kind: "washer", branchId: "b1", espIp: "", publicCode: "W1", status: "online",
  cycleCount: 0, totalRunMinutes: 0, lastTubCleanCycle: 0, lastSeenAt: ago(1), ...over,
});

const products: Product[] = [
  { id: "pw", machineKind: "washer", name: "35 min", durationMinutes: 35, priceCents: 0, pulse: 1, pushDelayMs: 0 },
  { id: "pd", machineKind: "dryer", name: "30 min", durationMinutes: 30, priceCents: 0, pulse: 1, pushDelayMs: 0 },
];

const order = (over: Partial<JobOrder>): JobOrder => ({
  id: "o1", branchId: "b1", source: "tlp_pos", customerName: "Maria", services: [], assignments: [],
  status: "in_progress", paymentStatus: "paid", fulfillmentStage: "washing", createdAt: ago(60), updatedAt: ago(5), ...over,
});

test("rankMachines: fewest cycles first, skips non-online, ties go to the lowest code", () => {
  const ms = [
    machine({ id: "a", publicCode: "W2", cycleCount: 10 }),
    machine({ id: "b", publicCode: "W1", cycleCount: 10 }),
    machine({ id: "c", publicCode: "W3", cycleCount: 4, status: "running" }),
    machine({ id: "d", publicCode: "W4", cycleCount: 3, status: "offline" }),
    machine({ id: "e", publicCode: "W5", cycleCount: 7 }),
  ];
  const r = rankMachines(ms, "washer", 50);
  assert.deepEqual(r.map((x) => x.machine.id), ["e", "b", "a"]);
  assert.equal(r[0].suggested, true);
  assert.equal(r[1].suggested, false);
});

test("rankMachines: washers due for a tub clean go last, even with fewer cycles", () => {
  const ms = [
    machine({ id: "due", publicCode: "W1", cycleCount: 60, lastTubCleanCycle: 0 }),
    machine({ id: "ok", publicCode: "W2", cycleCount: 80, lastTubCleanCycle: 70 }),
  ];
  const r = rankMachines(ms, "washer", 50);
  assert.equal(r[0].machine.id, "ok");
  assert.equal(r[1].tubDue, true);
  assert.equal(isTubDue(ms[0], 50), true);
});

test("rankMachines: dryers rank by run minutes and never show tub-due", () => {
  const ms = [
    machine({ id: "d1", kind: "dryer", publicCode: "D1", totalRunMinutes: 900, cycleCount: 99 }),
    machine({ id: "d2", kind: "dryer", publicCode: "D2", totalRunMinutes: 300 }),
  ];
  const r = rankMachines(ms, "dryer", 50);
  assert.equal(r[0].machine.id, "d2");
  assert.equal(r.some((x) => x.tubDue), false);
});

test("alerts: tub clean due vs due soon, at the exact boundaries", () => {
  const at = (n: number) => computeAlerts([machine({ id: "w", publicCode: "W1", cycleCount: n })], [], products, 50, NOW);
  assert.equal(at(39).length, 0); // 39 < 40 (80% of 50)
  assert.equal(at(40)[0].kind, "tub_soon");
  assert.equal(at(49)[0].kind, "tub_soon");
  assert.equal(at(50)[0].kind, "tub_due");
  assert.equal(at(50)[0].severity, "warn");
});

test("alerts: load waiting to be started only after 10 minutes", () => {
  const m = machine({ id: "w", publicCode: "W1", status: "running", activeJobOrderId: "o1" });
  const mk = (min: number) => order({ assignments: [{ lineId: "l1", machineId: "w", productId: "pw", assignedAt: ago(min) }] });
  assert.equal(computeAlerts([m], [mk(9)], products, 50, NOW).length, 0);
  const a = computeAlerts([m], [mk(10)], products, 50, NOW);
  assert.equal(a[0].kind, "unstarted");
  assert.match(a[0].detail, /Maria/);
  // started machines never raise it
  assert.equal(computeAlerts([{ ...m, startedAt: ago(5) }], [mk(30)], products, 50, NOW).length, 0);
});

test("alerts: washed order waiting for a dryer after 15 minutes", () => {
  const base = {
    services: [{ lineId: "lw", productId: "pw", quantity: 1 }, { lineId: "ld", productId: "pd", quantity: 1 }],
  };
  const washed = (min: number) => order({
    ...base,
    assignments: [{ lineId: "lw", machineId: "w", productId: "pw", assignedAt: ago(90), finishedAt: ago(min) }],
  });
  assert.equal(computeAlerts([], [washed(14)], products, 50, NOW).length, 0);
  assert.equal(computeAlerts([], [washed(15)], products, 50, NOW)[0].kind, "dryer_wait");
  // still washing (no finishedAt) -> no alert
  const still = order({ ...base, assignments: [{ lineId: "lw", machineId: "w", productId: "pw", assignedAt: ago(90) }] });
  assert.equal(computeAlerts([], [still], products, 50, NOW).length, 0);
  // dryer already assigned -> no alert
  const dried = order({
    ...base,
    assignments: [
      { lineId: "lw", machineId: "w", productId: "pw", assignedAt: ago(90), finishedAt: ago(40) },
      { lineId: "ld", machineId: "d", productId: "pd", assignedAt: ago(30) },
    ],
  });
  assert.equal(computeAlerts([], [dried], products, 50, NOW).length, 0);
  // closed orders are ignored
  assert.equal(computeAlerts([], [{ ...washed(60), status: "voided" }], products, 50, NOW).length, 0);
});

test("alerts: offline for 2+ hours, sorted with warnings first", () => {
  const ms = [
    machine({ id: "o", publicCode: "W9", status: "offline", lastSeenAt: ago(119) }),
    machine({ id: "o2", publicCode: "W8", status: "offline", lastSeenAt: ago(180) }),
    machine({ id: "t", publicCode: "W1", cycleCount: 55 }),
  ];
  const a = computeAlerts(ms, [], products, 50, NOW);
  assert.deepEqual(a.map((x) => x.kind), ["tub_due", "offline"]);
  assert.match(a[1].detail, /3 hours/);
});
