import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Banknote, Smartphone, Globe } from "lucide-react";
import type { JobOrder, Product } from "@tlp/shared";
import { formatPeso, formatDateTime } from "../../lib/format";

type MethodKey = "cash" | "gcash" | "manual" | "online";

const METHOD: Record<MethodKey, { label: string; Icon: typeof Banknote }> = {
  cash: { label: "Cash", Icon: Banknote },
  gcash: { label: "GCash", Icon: Smartphone },
  manual: { label: "Manual", Icon: CreditCard },
  online: { label: "Online (LaundroBot)", Icon: Globe },
};

const STATUS_STYLE = {
  paid: { bg: "#f0fdf4", text: "#15803d", label: "Paid" },
  voided: { bg: "#fef2f2", text: "#b91c1c", label: "Voided" },
};

interface Props {
  orders: JobOrder[];
  products: Product[];
}

interface Sale {
  id: string;
  orderNumber?: string;
  customerName: string;
  paidAt: string;
  method: MethodKey;
  totalCents: number;
  status: "paid" | "voided";
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function TransactionTable({ orders, products }: Props) {
  const [range, setRange] = useState<"today" | "all">("today");

  // Every order that was paid becomes a sale; voided/refunded ones stay listed but don't count.
  const sales: Sale[] = useMemo(() => {
    const priceOf = (o: JobOrder) =>
      o.services.reduce((sum, line) => {
        const p = products.find((pr) => pr.id === line.productId);
        return sum + (line.priceCents ?? (p?.priceCents ?? 0) * line.quantity);
      }, 0);

    return orders
      .filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "refunded" || o.paymentStatus === "voided")
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        paidAt: o.createdAt,
        method: (o.paymentMethod ?? (o.source === "laundrobot" ? "online" : "manual")) as MethodKey,
        totalCents: priceOf(o),
        status: (o.status === "voided" || o.paymentStatus !== "paid" ? "voided" : "paid") as Sale["status"],
      }))
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [orders, products]);

  const shown = range === "today" ? sales.filter((s) => isToday(s.paidAt)) : sales;
  const counted = shown.filter((s) => s.status === "paid");
  const sumBy = (m: MethodKey) => counted.filter((s) => s.method === m).reduce((t, s) => t + s.totalCents, 0);
  const total = counted.reduce((t, s) => t + s.totalCents, 0);

  const summary: { label: string; value: string; sub?: string }[] = [
    { label: range === "today" ? "Sales today" : "Total sales", value: formatPeso(total), sub: `${counted.length} order${counted.length === 1 ? "" : "s"}` },
    { label: "Cash", value: formatPeso(sumBy("cash")) },
    { label: "GCash", value: formatPeso(sumBy("gcash")) },
    { label: "Online / other", value: formatPeso(sumBy("online") + sumBy("manual")) },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Range toggle */}
      <div className="flex items-center gap-1 self-start rounded-xl bg-white border border-zinc-100 p-1">
        {(["today", "all"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 h-8 rounded-lg text-xs font-semibold transition-all ${range === r ? "bg-[#009eb5] text-white" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            {r === "today" ? "Today" : "All"}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5" style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{s.label}</div>
            <div className="text-lg font-bold text-zinc-900 tracking-tight mt-1 tabular-nums">{s.value}</div>
            {s.sub && <div className="text-[11px] text-zinc-400 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {shown.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
            <p className="text-sm text-zinc-400">{range === "today" ? "No sales yet today" : "No sales yet"}</p>
          </div>
        )}
        {shown.map((sale, i) => {
          const { Icon, label } = METHOD[sale.method];
          const s = STATUS_STYLE[sale.status];
          return (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
              className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5"
              style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 truncate">{sale.customerName}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-zinc-400">{sale.orderNumber ?? sale.id.slice(0, 8)}</span>
                    <span className="text-[11px] text-zinc-300">·</span>
                    <span className="text-[11px] text-zinc-400">{formatDateTime(sale.paidAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                  <span className={`text-sm font-bold ${sale.status === "voided" ? "text-zinc-300 line-through" : "text-zinc-800"}`}>{formatPeso(sale.totalCents)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Icon size={12} className="text-zinc-400" strokeWidth={2} />
                <span className="text-[11px] text-zinc-400 font-medium">{label}</span>
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
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-400">
                  {range === "today" ? "No sales recorded today." : "No sales recorded yet."}
                </td>
              </tr>
            )}
            {shown.map((sale, i) => {
              const { Icon, label } = METHOD[sale.method];
              const s = STATUS_STYLE[sale.status];
              return (
                <motion.tr
                  key={sale.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  className="hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-5 py-3 text-xs text-zinc-500">{formatDateTime(sale.paidAt)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">{sale.orderNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-800">{sale.customerName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className="text-zinc-400" strokeWidth={2} />
                      <span className="text-xs text-zinc-500">{label}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold ${sale.status === "voided" ? "text-zinc-300 line-through" : "text-zinc-800"}`}>
                    {formatPeso(sale.totalCents)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>{s.label}</span>
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
