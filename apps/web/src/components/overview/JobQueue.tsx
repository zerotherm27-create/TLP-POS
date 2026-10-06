import { motion, AnimatePresence } from "framer-motion";
import { Clock, ExternalLink } from "lucide-react";
import type { JobOrder, Product } from "@tlp/shared";
import { formatPeso, formatTime } from "../../lib/format";

const STAGE_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  queued:    { label: "Queued",   bg: "#fef9ee", text: "#b45309" },
  washing:   { label: "Washing",  bg: "#e0f6fa", text: "#007b8a" },
  drying:    { label: "Drying",   bg: "#fef3f2", text: "#b91c1c" },
  ready:     { label: "Ready",    bg: "#f0fdf4", text: "#15803d" },
  completed: { label: "Done",     bg: "#f4f4f5", text: "#71717a" },
  voided:    { label: "Voided",   bg: "#fef2f2", text: "#b91c1c" },
};

interface Props {
  orders: JobOrder[];
  products: Product[];
}

function orderTotal(order: JobOrder, products: Product[]) {
  return order.services.reduce((sum, line) => {
    const p = products.find((pr) => pr.id === line.productId);
    return sum + (p ? p.priceCents * line.quantity : 0);
  }, 0);
}

export default function JobQueue({ orders, products }: Props) {
  const active = orders.filter((o) => o.status !== "completed" && o.status !== "voided");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 tracking-tight">Job Queue</h2>
        <span className="text-xs font-medium text-zinc-400">{active.length} active</span>
      </div>

      {active.length === 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
          <div className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center mx-auto mb-3">
            <Clock size={20} className="text-zinc-300" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No active orders</p>
          <p className="text-xs text-zinc-300 mt-1">Create a job order to get started</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {active.map((order) => {
          const stage = STAGE_COLORS[order.fulfillmentStage] ?? STAGE_COLORS.queued;
          const total = orderTotal(order, products);
          const isExternal = order.source === "laundrobot";

          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5"
              style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900 truncate">
                      {order.customerName}
                    </span>
                    {isExternal && (
                      <ExternalLink size={11} className="text-zinc-300 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {order.orderNumber ?? order.externalOrderId}
                    </span>
                    <span className="text-[10px] text-zinc-300">·</span>
                    <span className="text-[10px] text-zinc-400">
                      {formatTime(order.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: stage.bg, color: stage.text }}
                  >
                    {stage.label}
                  </span>
                  <span className="text-xs font-semibold text-zinc-700">{formatPeso(total)}</span>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {order.services.map((line) => {
                  const p = products.find((pr) => pr.id === line.productId);
                  if (!p) return null;
                  return (
                    <span key={line.productId} className="text-[10px] bg-zinc-50 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-100">
                      {p.name} ×{line.quantity}
                    </span>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
