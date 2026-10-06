import test from "node:test";
import assert from "node:assert/strict";
import type { Machine, JobOrder, Product } from "./index.js";
import { rankMachines, rankWasherPairs, planDryers, machineNumber, computeAlerts, isTubDue } from "./insights.js";

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

const w = (n: number, over: Partial<Machine> = {}) => machine({ id: `w${n}`, kind: "washer", publicCode: `W${n}`, ...over });
const d = (n: number, over: Partial<Machine> = {}) => machine({ id: `d${n}`, kind: "dryer", publicCode: `D${n}`, ...over });

test("machineNumber pairs W3 with D3", () => {
  assert.equal(machineNumber(w(3)), "3");
  assert.equal(machineNumber(d(3)), "3");
});

test("washer pairs: only washers whose same-number dryer is free are suggested first", () => {
  const ms = [
    w(1, { cycleCount: 2 }), d(1, { status: "running" }), // best washer, but its dryer is busy
    w(2, { cycleCount: 9 }), d(2),
    w(3, { cycleCount: 5 }), d(3, { status: "offline" }),
  ];
  const r = rankWasherPairs(ms, 50);
  assert.equal(r[0].washer.publicCode, "W2"); // W2 + D2 are both free
  assert.equal(r[0].dryer?.publicCode, "D2");
  assert.equal(r[0].dryerFree, true);
  assert.equal(r[0].suggested, true);
  assert.deepEqual(r.slice(1).map((x) => x.dryerFree), [false, false]);
  assert.equal(r.filter((x) => x.suggested).length, 1);
});

test("washer pairs: among free pairs, skip tub-due washers, then least used", () => {
  const ms = [
    w(1, { cycleCount: 60, lastTubCleanCycle: 0 }), d(1),
    w(2, { cycleCount: 20 }), d(2, { totalRunMinutes: 500 }),
    w(3, { cycleCount: 20 }), d(3, { totalRunMinutes: 100 }),
  ];
  const r = rankWasherPairs(ms, 50);
  assert.deepEqual(r.map((x) => x.washer.publicCode), ["W3", "W2", "W1"]); // tie on washer cycles -> less used dryer
  assert.equal(r[2].tubDue, true);
});

test("washer pairs: a washer with no matching dryer is never treated as a free pair", () => {
  const r = rankWasherPairs([w(7)], 50);
  assert.equal(r[0].dryer, undefined);
  assert.equal(r[0].dryerFree, false);
});

test("dryer plan: suggests only the dryer that matches the order's washer (no crossing)", () => {
  const ms = [w(3, { status: "running" }), d(1, { totalRunMinutes: 0 }), d(2, { totalRunMinutes: 0 }), d(3, { totalRunMinutes: 900 })];
  const plan = planDryers(ms, [ms[0]], 50);
  assert.equal(plan.choices[0].machine.publicCode, "D3"); // matching dryer first even though it is the most used
  assert.equal(plan.choices[0].suggested, true);
  assert.equal(plan.choices[0].pairOf, "W3");
  assert.equal(plan.choices.filter((c) => c.suggested).length, 1);
  assert.deepEqual(plan.pairCodes, ["D3"]);
  assert.equal(plan.pairBusy, false);
});

test("dryer plan: when the matching dryer is busy, nothing is suggested", () => {
  const ms = [w(3, { status: "running" }), d(1), d(2), d(3, { status: "running" })];
  const plan = planDryers(ms, [ms[0]], 50);
  assert.equal(plan.pairBusy, true);
  assert.equal(plan.choices.some((c) => c.suggested), false);
  assert.deepEqual(plan.choices.map((c) => c.machine.publicCode), ["D1", "D2"]);
});

test("dryer plan: no washer on the order falls back to the least-used dryer", () => {
  const ms = [d(1, { totalRunMinutes: 300 }), d(2, { totalRunMinutes: 100 })];
  const plan = planDryers(ms, [], 50);
  assert.equal(plan.choices[0].machine.publicCode, "D2");
  assert.equal(plan.choices[0].suggested, true);
  assert.equal(plan.pairBusy, false);
});

test("dryer plan: two washers on one order suggest their own two dryers", () => {
  const ms = [w(1, { status: "running" }), w(2, { status: "running" }), d(1), d(2), d(3)];
  const plan = planDryers(ms, [ms[0], ms[1]], 50);
  assert.deepEqual(plan.choices.slice(0, 2).map((c) => c.machine.publicCode), ["D1", "D2"]);
  assert.equal(plan.choices[0].suggested, true);
  assert.equal(plan.choices[1].suggested, false); // one suggestion at a time; after D1 is used D2 becomes the suggestion
  assert.deepEqual(plan.pairCodes, ["D1", "D2"]);
});
