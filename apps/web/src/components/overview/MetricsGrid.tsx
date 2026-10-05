import { motion } from "framer-motion";
import { formatPeso } from "../../lib/format";
import type { Machine, Sale } from "@tlp/shared";

interface Props {
  machines: Machine[];
  sales: Sale[];
  openOrders: number;
  isAdmin: boolean;
}

interface Stat {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}

export default function MetricsGrid({ machines, sales, openOrders, isAdmin }: Props) {
  const paidToday = sales.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.totalCents, 0);
  const inOperation = machines.filter((m) => m.status === "running").length;
  const available = machines.filter((m) => m.status === "online").length;
  const offline = machines.filter((m) => m.status === "offline").length;
  const paidCount = sales.filter((s) => s.status === "paid").length;

  const opsStats: Stat[] = [
    {
      label: "In Operation",
      value: String(inOperation),
      sub: `${available} available · ${offline} offline`,
      highlight: true,
    },
    {
      label: "Open Orders",
      value: String(openOrders),
      sub: "awaiting assignment",
    },
    {
      label: "Available",
      value: String(available),
      sub: `of ${machines.length} machines`,
    },
    {
      label: "Offline",
      value: offline === 0 ? "—" : String(offline),
      sub: offline === 0 ? "all reachable" : "unreachable",
    },
  ];

  const adminStats: Stat[] = [
    {
      label: "Revenue Today",
      value: formatPeso(paidToday),
      sub: `${paidCount} transaction${paidCount !== 1 ? "s" : ""}`,
      highlight: true,
    },
    {
      label: "In Operation",
      value: String(inOperation),
      sub: `${available} avail · ${offline} offline`,
    },
    {
      label: "Open Orders",
      value: String(openOrders),
      sub: "awaiting assignment",
    },
    {
      label: "Available",
      value: String(available),
      sub: `of ${machines.length} machines`,
    },
  ];

  const stats = isAdmin ? adminStats : opsStats;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="bg-white rounded-2xl border border-zinc-100 overflow-hidden"
      style={{ boxShadow: "0 1px 8px -2px rgba(0,0,0,0.05)" }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-zinc-100">
        {stats.map(({ label, value, sub, highlight }, i) => (
          <div key={label} className="px-5 py-4 flex flex-col gap-1">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest leading-none">
              {label}
            </div>
            <div
              className="text-[28px] font-bold tabular-nums leading-none tracking-tight"
              style={{ color: highlight ? "#009eb5" : "#18181b" }}
            >
              {value}
            </div>
            <div className="text-[11px] text-zinc-400 leading-none">{sub}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
