// Pure calculations for the Insights view. No network, no database — easy to test.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Manila is UTC+8 all year (no daylight saving)
const DAY_MS = 24 * 60 * 60 * 1000;

/** Opening hours in Manila time (24h clock): open 8 AM, close 8 PM. Change these two numbers to adjust. */
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;
/** How many minutes a machine could run per day; used for the utilization %. */
export const OPERATING_MINUTES_PER_DAY = (CLOSE_HOUR - OPEN_HOUR) * 60;

/** UTC timestamp (ms) of 00:00 Manila time on the day containing `ts`. */
export const manilaDayStart = (ts) => Math.floor((ts + MANILA_OFFSET_MS) / DAY_MS) * DAY_MS - MANILA_OFFSET_MS;
export const manilaHour = (ts) => new Date(ts + MANILA_OFFSET_MS).getUTCHours();

export const rangeBounds = (range, now) => {
  const todayStart = manilaDayStart(now);
  if (range === "7d") return { start: todayStart - 6 * DAY_MS, end: todayStart + DAY_MS, days: 7 };
  return { start: todayStart, end: todayStart + DAY_MS, days: 1 };
};

export const formatPeso = (cents) => {
  const pesos = cents / 100;
  return `₱${pesos.toLocaleString("en-PH", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
};

const hour12 = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
export const hourLabel = (h) => `${hour12(h)}–${hour12((h + 1) % 24)}`;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function summarize({ orders, runs, machines, products, range = "today", now = Date.now() }) {
  const { start, end, days } = rangeBounds(range, now);
  const inRange = (iso) => {
    const t = Date.parse(iso);
    return t >= start && t < end;
  };
  const productOf = (id) => products.find((p) => p.id === id);
  const lineCents = (line) => line.priceCents ?? (productOf(line.productId)?.priceCents ?? 0) * (line.quantity ?? 1);

  const rangeOrders = orders.filter((o) => inRange(o.createdAt));
  const live = rangeOrders.filter((o) => o.status !== "voided");
  const voided = rangeOrders.length - live.length;

  const methodOf = (o) => o.paymentMethod ?? (o.source === "laundrobot" ? "online" : "manual");
  const byMethod = { cash: 0, gcash: 0, manual: 0, online: 0 };
  let totalCents = 0;
  for (const o of live) {
    if (o.paymentStatus !== "paid") continue;
    const cents = o.services.reduce((sum, l) => sum + lineCents(l), 0);
    totalCents += cents;
    byMethod[methodOf(o)] = (byMethod[methodOf(o)] ?? 0) + cents;
  }

  const loads = live.reduce((n, o) => n + o.services.length, 0);

  const hours = Array.from({ length: 24 }, () => 0);
  for (const o of live) hours[manilaHour(Date.parse(o.createdAt))] += 1;
  const peak = Math.max(...hours);
  const busiestHour = peak > 0 ? hours.indexOf(peak) : null;

  const programCount = new Map();
  for (const o of live) for (const l of o.services) programCount.set(l.productId, (programCount.get(l.productId) ?? 0) + 1);
  const topPrograms = [...programCount.entries()]
    .map(([id, count]) => ({ productId: id, name: productOf(id)?.name ?? id, kind: productOf(id)?.machineKind, loads: count }))
    .sort((a, b) => b.loads - a.loads || a.name.localeCompare(b.name))
    .slice(0, 5);

  const rangeRuns = runs.filter((r) => inRange(r.ended_at ?? r.endedAt));
  const machineStats = machines
    .map((m) => {
      const mine = rangeRuns.filter((r) => (r.machine_id ?? r.machineId) === m.id);
      const runMinutes = mine.reduce((n, r) => n + (r.minutes ?? 0), 0);
      return {
        id: m.id,
        code: m.publicCode,
        name: m.name,
        kind: m.kind,
        cycles: mine.length,
        runMinutes,
        utilizationPct: Math.min(100, Math.round((runMinutes / (days * OPERATING_MINUTES_PER_DAY)) * 100)),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const ranked = [...machineStats].sort((a, b) => b.cycles - a.cycles || a.code.localeCompare(b.code, undefined, { numeric: true }));
  const mostUsed = ranked[0]?.cycles > 0 ? ranked[0] : null;

  const label = range === "7d" ? "Last 7 days" : "Today";
  let recap;
  if (rangeOrders.length === 0) {
    recap = range === "7d" ? "No orders in the last 7 days." : "No orders yet today.";
  } else {
    const parts = [`${label}: ${plural(live.length, "order")} (${formatPeso(totalCents)}), ${plural(loads, "load")}`];
    if (busiestHour !== null) parts.push(`busiest ${hourLabel(busiestHour)}`);
    if (mostUsed) parts.push(`${mostUsed.code} ran most (${plural(mostUsed.cycles, "cycle")})`);
    recap = parts.join(", ") + (voided ? `; ${plural(voided, "order")} voided.` : ".");
  }

  return {
    range,
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
    orders: { count: live.length, loads, voided },
    sales: { totalCents, count: live.filter((o) => o.paymentStatus === "paid").length, byMethod },
    hours,
    openHour: OPEN_HOUR,
    closeHour: CLOSE_HOUR,
    busiestHour,
    topPrograms,
    machines: machineStats,
    mostUsed,
    recap,
  };
}
