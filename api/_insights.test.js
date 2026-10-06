import test from "node:test";
import assert from "node:assert/strict";
import { summarize, manilaDayStart, manilaHour, formatPeso, hourLabel } from "./_insights.js";

const products = [
  { id: "pw", name: "35 min", machineKind: "washer", priceCents: 12000 },
  { id: "pd", name: "30 min", machineKind: "dryer", priceCents: 8000 },
];
const machines = [
  { id: "m1", publicCode: "W1", name: "Washer 1", kind: "washer" },
  { id: "m2", publicCode: "W2", name: "Washer 2", kind: "washer" },
  { id: "m3", publicCode: "D1", name: "Dryer 1", kind: "dryer" },
];
const order = (id, createdAt, over = {}) => ({
  id, createdAt, status: "queued", paymentStatus: "paid", source: "tlp_pos", paymentMethod: "cash",
  services: [{ lineId: id + "w", productId: "pw", quantity: 1 }, { lineId: id + "d", productId: "pd", quantity: 1 }], ...over,
});

test("Manila day boundary: 23:30 Manila belongs to that day, 00:30 to the next", () => {
  const lateMon = Date.parse("2026-10-07T15:30:00Z"); // 23:30 Oct 7 Manila
  const earlyTue = Date.parse("2026-10-07T16:30:00Z"); // 00:30 Oct 8 Manila
  assert.equal(new Date(manilaDayStart(lateMon)).toISOString(), "2026-10-06T16:00:00.000Z");
  assert.equal(new Date(manilaDayStart(earlyTue)).toISOString(), "2026-10-07T16:00:00.000Z");
  assert.equal(manilaHour(lateMon), 23);
  assert.equal(manilaHour(earlyTue), 0);
});

test("summarize: an order at 23:30 Manila counts for that day, not the next", () => {
  const o = order("a", "2026-10-07T15:30:00Z");
  const sameDay = summarize({ orders: [o], runs: [], machines, products, range: "today", now: Date.parse("2026-10-07T15:45:00Z") });
  assert.equal(sameDay.orders.count, 1);
  const nextDay = summarize({ orders: [o], runs: [], machines, products, range: "today", now: Date.parse("2026-10-07T16:30:00Z") });
  assert.equal(nextDay.orders.count, 0);
  const week = summarize({ orders: [o], runs: [], machines, products, range: "7d", now: Date.parse("2026-10-07T16:30:00Z") });
  assert.equal(week.orders.count, 1);
});

test("summarize: totals, methods, voided orders are excluded from sales", () => {
  const now = Date.parse("2026-10-07T08:00:00Z");
  const orders = [
    order("a", "2026-10-07T01:10:00Z"), // 9 AM Manila, cash ₱200
    order("b", "2026-10-07T01:40:00Z", { paymentMethod: "gcash" }),
    order("c", "2026-10-07T05:00:00Z", { status: "voided", paymentStatus: "refunded" }),
    order("d", "2026-10-07T01:50:00Z", { source: "laundrobot", paymentMethod: undefined, services: [{ lineId: "x", productId: "pw", quantity: 1, priceCents: 15000 }] }),
  ];
  const s = summarize({ orders, runs: [], machines, products, range: "today", now });
  assert.equal(s.orders.count, 3);
  assert.equal(s.orders.voided, 1);
  assert.equal(s.orders.loads, 5);
  assert.equal(s.sales.totalCents, 20000 + 20000 + 15000);
  assert.deepEqual(s.sales.byMethod, { cash: 20000, gcash: 20000, manual: 0, online: 15000 });
  assert.equal(s.busiestHour, 9);
  assert.equal(s.topPrograms[0].name, "35 min");
  assert.match(s.recap, /^Today: 3 orders \(₱550\), 5 loads, busiest 9 AM–10 AM; 1 order voided\.$/);
});

test("summarize: machine cycles, utilization and most used", () => {
  const now = Date.parse("2026-10-07T08:00:00Z");
  const runs = [
    { machine_id: "m1", minutes: 35, ended_at: "2026-10-07T02:00:00Z" },
    { machine_id: "m1", minutes: 35, ended_at: "2026-10-07T04:00:00Z" },
    { machine_id: "m2", minutes: 35, ended_at: "2026-10-07T03:00:00Z" },
    { machine_id: "m1", minutes: 35, ended_at: "2026-10-05T03:00:00Z" }, // not today
  ];
  const s = summarize({ orders: [], runs, machines, products, range: "today", now });
  const w1 = s.machines.find((m) => m.code === "W1");
  assert.equal(w1.cycles, 2);
  assert.equal(w1.runMinutes, 70);
  assert.equal(w1.utilizationPct, Math.round((70 / 720) * 100));
  assert.equal(s.mostUsed.code, "W1");
  assert.equal(summarize({ orders: [], runs, machines, products, range: "7d", now }).machines.find((m) => m.code === "W1").cycles, 3);
});

test("summarize: empty day wording, and helpers", () => {
  const now = Date.parse("2026-10-07T08:00:00Z");
  assert.equal(summarize({ orders: [], runs: [], machines, products, now }).recap, "No orders yet today.");
  assert.equal(summarize({ orders: [], runs: [], machines, products, range: "7d", now }).recap, "No orders in the last 7 days.");
  assert.equal(formatPeso(184000), "₱1,840");
  assert.equal(formatPeso(12050), "₱120.50");
  assert.equal(hourLabel(16), "4 PM–5 PM");
  assert.equal(hourLabel(23), "11 PM–12 AM");
});
