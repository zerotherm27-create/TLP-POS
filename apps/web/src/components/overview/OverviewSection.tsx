import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import MetricsGrid from "./MetricsGrid";
import JobQueue from "./JobQueue";
import type { Machine, JobOrder, Sale, Product, ServicePackage } from "@tlp/shared";

interface Props {
  machines: Machine[];
  orders: JobOrder[];
  sales: Sale[];
  products: Product[];
  packages: ServicePackage[];
  isAdmin: boolean;
}

/* ── Compact countdown for machine mini-card ── */
function useMiniCountdown(startedAt: string | undefined, durationMinutes: number) {
  const get = () => {
    if (!startedAt) return null;
    return Math.max(0, new Date(startedAt).getTime() + durationMinutes * 60 * 1000 - Date.now());
  };
  const [ms, setMs] = useState<number | null>(get);
  useEffect(() => {
    if (!startedAt) { setMs(null); return; }
    setMs(get());
    const id = setInterval(() => setMs(get()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (ms === null) return null;
  const secs = Math.floor(ms / 1000);
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

/* ── Single mini machine tile ── */
function MachineTile({ machine }: { machine: Machine }) {
  const countdown = useMiniCountdown(machine.startedAt, machine.remainingMinutes ?? 0);
  const isRunning = machine.status === "running";
  const isOffline = machine.status === "offline";

  const accent = isRunning ? "#009eb5" : isOffline ? "#e4e4e7" : "#22c55e";
  const textColor = isRunning ? "#009eb5" : isOffline ? "#a1a1aa" : "#16a34a";

  return (
    <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden flex flex-col"
      style={{ boxShadow: "0 1px 3px -1px rgba(0,0,0,0.06)" }}
    >
      <div style={{ height: 2, background: accent }} />
      <div className="px-2.5 pt-2 pb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] font-bold text-zinc-800 tracking-tight">{machine.publicCode}</span>
          {machine.tier && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1 rounded"
              style={machine.tier === "titan"
                ? { background: "#fef3c7", color: "#b45309" }
                : { background: "#f4f4f5", color: "#71717a" }
              }
            >
              {machine.tier}
            </span>
          )}
        </div>
        {isRunning && countdown ? (
          <span className="text-[12px] font-bold tabular-nums" style={{ color: textColor }}>{countdown}</span>
        ) : isRunning && !countdown ? (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="text-[10px] font-semibold" style={{ color: textColor }}
          >pending</motion.span>
        ) : (
          <span className="text-[10px] font-medium" style={{ color: textColor }}>
            {isOffline ? "offline" : "ready"}
          </span>
        )}
        {isRunning && machine.customerName && (
          <div className="text-[9px] text-zinc-400 truncate mt-0.5">{machine.customerName}</div>
        )}
      </div>
    </div>
  );
}

export default function OverviewSection({ machines, orders, sales, products, isAdmin }: Props) {
  const openOrders = orders.filter((o) => o.status !== "completed" && o.status !== "voided").length;
  const washers = machines.filter((m) => m.kind === "washer");
  const dryers = machines.filter((m) => m.kind === "dryer");

  return (
    <div className="flex flex-col gap-5">
      <MetricsGrid machines={machines} sales={sales} openOrders={openOrders} isAdmin={isAdmin} />

      {/* Compact machine status grid */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4"
        style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
      >
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Machine Status</div>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[9px] font-semibold text-zinc-300 uppercase tracking-widest mb-1.5">Washers</div>
            <div className="grid grid-cols-5 gap-1.5">
              {washers.map((m) => <MachineTile key={m.id} machine={m} />)}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-zinc-300 uppercase tracking-widest mb-1.5">Dryers</div>
            <div className="grid grid-cols-5 gap-1.5">
              {dryers.map((m) => <MachineTile key={m.id} machine={m} />)}
            </div>
          </div>
        </div>
      </div>

      <JobQueue orders={orders} products={products} />
    </div>
  );
}
