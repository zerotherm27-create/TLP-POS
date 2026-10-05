import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Clock, ExternalLink, Phone, StickyNote,
  WashingMachine, Wind, X, ChevronRight,
} from "lucide-react";
import type { JobOrder, Product, Machine, FulfillmentStage } from "@tlp/shared";
import { formatPeso, formatTime, formatDateTime } from "../../lib/format";

/* ── Stage config ── */
const STAGES: Record<FulfillmentStage, { label: string; bg: string; text: string; dot: string }> = {
  queued:    { label: "Queued",    bg: "#fef9ee", text: "#b45309", dot: "#f59e0b" },
  washing:   { label: "Washing",  bg: "#e0f6fa", text: "#007b8a", dot: "#009eb5" },
  drying:    { label: "Drying",   bg: "#fef3f2", text: "#c2410c", dot: "#f97316" },
  ready:     { label: "Ready",    bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  completed: { label: "Done",     bg: "#f4f4f5", text: "#71717a", dot: "#a1a1aa" },
  voided:    { label: "Voided",   bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
};

const FILTER_TABS = [
  { key: "all",         label: "All" },
  { key: "queued",      label: "Queued" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed",   label: "Done" },
  { key: "voided",      label: "Voided" },
] as const;

type FilterKey = typeof FILTER_TABS[number]["key"];

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function orderServices(order: JobOrder, products: Product[]) {
  return order.services.map((line) => ({
    line,
    product: products.find((p) => p.id === line.productId),
  }));
}

/* ── Order list card ── */
function OrderCard({
  order,
  products,
  selected,
  onClick,
}: {
  order: JobOrder;
  products: Product[];
  selected: boolean;
  onClick: () => void;
}) {
  const stage = STAGES[order.fulfillmentStage] ?? STAGES.queued;
  const services = orderServices(order, products);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-colors ${
        selected
          ? "border-[#009eb5] bg-[#f0fbfd]"
          : "border-zinc-100 bg-white hover:border-zinc-200"
      }`}
      style={{ boxShadow: selected ? "0 0 0 1px #009eb5" : "0 2px 8px -4px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-zinc-900 truncate">{order.customerName}</span>
            {order.source === "laundrobot" && (
              <ExternalLink size={11} className="text-zinc-300 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-zinc-400 font-mono">{order.orderNumber}</span>
            <span className="text-zinc-200 text-[10px]">·</span>
            <span className="text-[10px] text-zinc-400">{formatTime(order.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: stage.bg, color: stage.text }}
          >
            {stage.label}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {services.map(({ line, product }) =>
          product ? (
            <span
              key={line.productId}
              className="text-[10px] bg-zinc-50 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-100"
            >
              {product.name} ×{line.quantity}
            </span>
          ) : null
        )}
      </div>
    </motion.button>
  );
}

/* ── Detail panel ── */
function DetailPanel({
  order,
  products,
  machines,
  isAdmin,
  onClose,
  onVoid,
  onAssign,
}: {
  order: JobOrder;
  products: Product[];
  machines: Machine[];
  isAdmin?: boolean;
  onClose: () => void;
  onVoid: (id: string) => void;
  onAssign?: (orderId: string, machineId: string, productId: string) => void;
}) {
  const stage = STAGES[order.fulfillmentStage] ?? STAGES.queued;
  const services = orderServices(order, products);
  const isActive = order.status !== "completed" && order.status !== "voided";
  const orderTotal = services.reduce((sum, { line, product }) =>
    sum + (line.priceCents ?? (product?.priceCents ?? 0) * line.quantity), 0);

  const assignedProductIds = new Set(order.assignments.map((a) => a.productId));
  const unassignedServices = services.filter(({ line }) => !assignedProductIds.has(line.productId));
  const canAssign = isActive && unassignedServices.length > 0 && onAssign;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="bg-white rounded-2xl border border-zinc-100 flex flex-col overflow-hidden"
      style={{ boxShadow: "0 4px 24px -8px rgba(0,0,0,0.08)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-zinc-100">
        <div>
          <div className="text-base font-bold text-zinc-900">{order.customerName}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-zinc-400">{order.orderNumber}</span>
            {order.source === "laundrobot" && (
              <>
                <span className="text-zinc-200">·</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                  LaundroBot
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {/* Status */}
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full"
            style={{ background: stage.bg, color: stage.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.dot }} />
            {stage.label}
          </span>
          <span className="text-[11px] text-zinc-400">{timeAgo(order.createdAt)}</span>
        </div>

        {/* Customer info */}
        {(order.contactNumber || order.notes) && (
          <div className="flex flex-col gap-2">
            {order.contactNumber && (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-50 flex items-center justify-center shrink-0">
                  <Phone size={13} className="text-zinc-400" strokeWidth={1.8} />
                </div>
                <span className="text-sm text-zinc-600">{order.contactNumber}</span>
              </div>
            )}
            {order.notes && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-50 flex items-center justify-center shrink-0 mt-0.5">
                  <StickyNote size={13} className="text-zinc-400" strokeWidth={1.8} />
                </div>
                <span className="text-sm text-zinc-600">{order.notes}</span>
              </div>
            )}
          </div>
        )}

        {/* Services */}
        <div>
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Services</div>
          <div className="flex flex-col gap-1.5">
            {services.map(({ line, product }) => {
              const linePrice = line.priceCents ?? (product?.priceCents ?? 0) * line.quantity;
              return (
                <div key={line.productId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-zinc-50 flex items-center justify-center">
                      {product?.machineKind === "washer"
                        ? <WashingMachine size={12} className="text-zinc-400" strokeWidth={1.8} />
                        : <Wind size={12} className="text-zinc-400" strokeWidth={1.8} />
                      }
                    </div>
                    <span className="text-sm text-zinc-700">{product?.name ?? line.productId}</span>
                    {line.quantity > 1 && (
                      <span className="text-xs text-zinc-400">×{line.quantity}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-zinc-700">
                    {formatPeso(linePrice)}
                  </span>
                </div>
              );
            })}
            {orderTotal > 0 && (
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-100">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total</span>
                <span className="text-sm font-bold text-zinc-900">{formatPeso(orderTotal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Machine assignments */}
        {order.assignments.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Assigned Machines</div>
            <div className="flex flex-col gap-1.5">
              {order.assignments.map((a) => {
                const machine = machines.find((m) => m.id === a.machineId);
                const product = products.find((p) => p.id === a.productId);
                return (
                  <div key={a.machineId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-lg tabular-nums">
                        {machine?.publicCode ?? a.machineId}
                      </span>
                      <span className="text-sm text-zinc-600">{machine?.name ?? a.machineId}</span>
                    </div>
                    <span className="text-[11px] text-zinc-400">{product?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assign machine */}
        {canAssign && (
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Assign Machine</div>
            <div className="flex flex-col gap-3">
              {unassignedServices.map(({ line, product }) => {
                if (!product) return null;
                const available = machines.filter(
                  (m) => m.kind === product.machineKind && m.status === "online"
                );
                return (
                  <div key={line.productId}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded-md bg-zinc-50 flex items-center justify-center">
                        {product.machineKind === "washer"
                          ? <WashingMachine size={11} className="text-zinc-400" strokeWidth={1.8} />
                          : <Wind size={11} className="text-zinc-400" strokeWidth={1.8} />
                        }
                      </div>
                      <span className="text-[11px] text-zinc-500">{product.name}</span>
                    </div>
                    {available.length === 0 ? (
                      <p className="text-[11px] text-zinc-300 px-1">
                        No available {product.machineKind}s
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {available.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => onAssign(order.id, m.id, line.productId)}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-xl border border-zinc-200 text-[11px] font-semibold text-zinc-700 hover:border-[#009eb5] hover:text-[#007a8c] hover:bg-[#e0f6fa] transition-colors"
                          >
                            <span className="font-bold">{m.publicCode}</span>
                            <span className="text-zinc-400 font-normal">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Timeline</div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Created</span>
            <span className="text-[11px] text-zinc-600">{formatDateTime(order.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Updated</span>
            <span className="text-[11px] text-zinc-600">{formatDateTime(order.updatedAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Payment</span>
            <span className={`text-[11px] font-semibold ${order.paymentStatus === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
              {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      {isAdmin && isActive && (
        <div className="px-5 pb-5 pt-3 border-t border-zinc-100">
          <button
            onClick={() => onVoid(order.id)}
            className="w-full h-9 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            Void Order
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ── Main section ── */
interface Props {
  orders: JobOrder[];
  products: Product[];
  machines: Machine[];
  isAdmin?: boolean;
  onAssign?: (orderId: string, machineId: string, productId: string) => void;
}

export default function OrdersSection({ orders: initialOrders, products, machines, isAdmin, onAssign }: Props) {
  const [orders, setOrders] = useState(initialOrders);

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = orders.filter((o) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "in_progress" && o.status === "in_progress") ||
      o.status === filter ||
      o.fulfillmentStage === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      o.customerName.toLowerCase().includes(q) ||
      (o.orderNumber ?? "").toLowerCase().includes(q) ||
      (o.contactNumber ?? "").includes(q);
    return matchesFilter && matchesSearch;
  });

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const handleVoid = (id: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: "voided", fulfillmentStage: "voided", updatedAt: new Date().toISOString() }
          : o
      )
    );
    setSelectedId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
      {/* ── Left: order list ── */}
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-300" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or order #…"
            className="w-full h-10 pl-9 pr-4 rounded-2xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
            style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? orders.length
                : orders.filter(
                    (o) => o.status === tab.key || (tab.key === "in_progress" && o.status === "in_progress")
                  ).length;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  filter === tab.key
                    ? "bg-[#009eb5] text-white"
                    : "bg-white border border-zinc-100 text-zinc-500 hover:border-zinc-200"
                }`}
              >
                {tab.label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filter === tab.key ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
              <div className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center mx-auto mb-3">
                <Clock size={20} className="text-zinc-300" />
              </div>
              <p className="text-sm font-medium text-zinc-400">No orders found</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                products={products}
                selected={selectedId === order.id}
                onClick={() => setSelectedId(selectedId === order.id ? null : order.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      <div className="sticky top-5">
        <AnimatePresence mode="wait">
          {selected ? (
            <DetailPanel
              key={selected.id}
              order={selected}
              products={products}
              machines={machines}
              isAdmin={isAdmin}
              onClose={() => setSelectedId(null)}
              onVoid={handleVoid}
              onAssign={onAssign}
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-2xl border border-dashed border-zinc-200 p-10 text-center"
            >
              <ChevronRight size={24} className="text-zinc-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-400">Select an order</p>
              <p className="text-xs text-zinc-300 mt-1">Tap any order to view details</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
