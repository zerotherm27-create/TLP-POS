import { motion } from "framer-motion";
import { CreditCard, Banknote, Smartphone } from "lucide-react";
import type { Sale, JobOrder, Product } from "@tlp/shared";
import { formatPeso, formatDateTime } from "../../lib/format";

const PAYMENT_ICON = {
  cash: Banknote,
  gcash: Smartphone,
  manual: CreditCard,
};

const STATUS_STYLE = {
  paid: { bg: "#f0fdf4", text: "#15803d", label: "Paid" },
  voided: { bg: "#fef2f2", text: "#b91c1c", label: "Voided" },
};

interface Props {
  sales: Sale[];
  orders: JobOrder[];
  products: Product[];
}

export default function TransactionTable({ sales, orders, products }: Props) {
  const sorted = [...sales].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const getOrder = (id?: string) => orders.find((o) => o.id === id);

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {sorted.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
            <p className="text-sm text-zinc-400">No transactions yet</p>
          </div>
        )}
        {sorted.map((sale, i) => {
          const order = getOrder(sale.jobOrderId);
          const PayIcon = PAYMENT_ICON[sale.paymentMethod];
          const s = STATUS_STYLE[sale.status];
          return (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5"
              style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    {order?.customerName ?? "—"}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-zinc-400">
                      {order?.orderNumber ?? sale.id.slice(0, 8)}
                    </span>
                    <span className="text-[11px] text-zinc-300">·</span>
                    <span className="text-[11px] text-zinc-400">{formatDateTime(sale.paidAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: s.bg, color: s.text }}
                  >
                    {s.label}
                  </span>
                  <span className="text-sm font-bold text-zinc-800">{formatPeso(sale.totalCents)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <PayIcon size={12} className="text-zinc-400" strokeWidth={2} />
                <span className="text-[11px] text-zinc-400 font-medium capitalize">{sale.paymentMethod}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Desktop/tablet table */}
      <div
        className="hidden sm:block bg-white rounded-2xl border border-zinc-100 overflow-hidden"
        style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-5 py-3">Time</th>
              <th className="text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3">Order</th>
              <th className="text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3">Customer</th>
              <th className="text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3">Method</th>
              <th className="text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3">Total</th>
              <th className="text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-400">
                  No transactions recorded today.
                </td>
              </tr>
            )}
            {sorted.map((sale, i) => {
              const order = getOrder(sale.jobOrderId);
              const PayIcon = PAYMENT_ICON[sale.paymentMethod];
              const s = STATUS_STYLE[sale.status];
              return (
                <motion.tr
                  key={sale.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-5 py-3 text-xs text-zinc-500">{formatDateTime(sale.paidAt)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">{order?.orderNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-800">{order?.customerName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <PayIcon size={13} className="text-zinc-400" strokeWidth={2} />
                      <span className="text-xs text-zinc-500 capitalize">{sale.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-800">
                    {formatPeso(sale.totalCents)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className="inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: s.bg, color: s.text }}
                    >
                      {s.label}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
