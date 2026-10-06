import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Clock, ExternalLink, Phone, StickyNote,
  WashingMachine, Wind, X, ChevronRight, RotateCcw, ArrowLeftRight,
} from "lucide-react";
import type { JobOrder, Product, Machine, FulfillmentStage, ServicePackage } from "@tlp/shared";
import { rankWasherPairs, planDryers, extraChargeCents } from "@tlp/shared";
import type { ExtraRates } from "@tlp/shared";
import JobOrderForm, { type NewOrderPayload } from "../overview/JobOrderForm";
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
  onUnassign,
  onAddService,
  onFinishMachine,
  onAddExtra,
  extraRates,
  tubCleanThreshold = 50,
}: {
  order: JobOrder;
  products: Product[];
  machines: Machine[];
  isAdmin?: boolean;
  onClose: () => void;
  onVoid: (id: string) => void;
  onAssign?: (orderId: string, machineId: string, productId: string, lineId: string) => void;
  onUnassign?: (orderId: string, lineId: string, machineId: string, reason: string, mode: "rework" | "reassign") => void;
  onAddService?: (orderId: string, productId: string) => Promise<void>;
  onFinishMachine?: (machineId: string) => Promise<void> | void;
  onAddExtra?: (orderId: string, lineId: string, productId: string) => Promise<void>;
  extraRates?: ExtraRates;
  tubCleanThreshold?: number;
}) {
  const [showOtherSize, setShowOtherSize] = useState(false);
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [extraBusy, setExtraBusy] = useState(false);
  const addExtra = async (lineId: string, productId: string) => {
    if (!onAddExtra || extraBusy) return;
    setExtraBusy(true);
    try {
      await onAddExtra(order.id, lineId, productId);
      setExtraFor(null);
    } finally {
      setExtraBusy(false);
    }
  };
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const addLoad = async (productId: string) => {
    if (!onAddService || addBusy) return;
    setAddBusy(true);
    try {
      await onAddService(order.id, productId);
      setAdding(false);
    } finally {
      setAddBusy(false);
    }
  };
  const [actionLine, setActionLine] = useState<{ lineId: string; machineId: string; productId: string; mode: "rework" | "reassign" } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const stage = STAGES[order.fulfillmentStage] ?? STAGES.queued;
  const services = orderServices(order, products);
  const isActive = order.status !== "completed" && order.status !== "voided";
  const orderTotal = services.reduce((sum, { line, product }) =>
    sum + (line.priceCents ?? (product?.priceCents ?? 0) * line.quantity), 0);

  const assignedLineIds = new Set(order.assignments.map((a) => a.lineId));

  // All washers done when none of their machines is still running
  const washerAssignments = order.assignments.filter((a) => {
    const p = products.find((p) => p.id === a.productId);
    return p?.machineKind === "washer";
  });
  const anyWasherRunning = washerAssignments.some(
    (a) => machines.find((m) => m.id === a.machineId)?.status === "running"
  );
  const washersDone = washerAssignments.length === 0 || !anyWasherRunning;
  // A washer load that hasn't been given a machine yet: its dryer is chosen after it (the washer list already suggests the pair).
  const washerUnassigned = services.some(({ line, product }) => product?.machineKind === "washer" && !assignedLineIds.has(line.lineId));
  const dryersHeld = !washersDone || washerUnassigned;

  // Each load has a machine size: regular, or large (the bigger W5 + D5). Offer only that size unless overridden.
  const machineTier = (m: Machine) => (m.tier === "titan" ? "titan" : "giant");
  const loadTier = (line: { tier?: "giant" | "titan" }) =>
    line.tier ?? (order.source === "laundrobot" ? "giant" : order.tier) ?? "giant";
  const poolFor = (tier: "giant" | "titan") => (showOtherSize ? machines : machines.filter((m) => machineTier(m) === tier));
  const hasLargeLoad = services.some(({ line }) => loadTier(line) === "titan");

  const unassignedServices = services.filter(({ line, product }) => {
    if (assignedLineIds.has(line.lineId)) return false;
    // Hold dryer assignment until all washers are done
    if (product?.machineKind === "dryer" && dryersHeld) return false;
    return true;
  });
  const canAssign = isActive && unassignedServices.length > 0 && onAssign;

  // Load numbers per productId (for "Load 1 / Load 2" labels on multi-load orders)
  const loadCounters: Record<string, number> = {};
  const loadNumbers = services.map(({ line }) => {
    loadCounters[line.productId] = (loadCounters[line.productId] ?? 0) + 1;
    return loadCounters[line.productId];
  });
  const hasMultipleLoads = Object.values(loadCounters).some((c) => c > 1);

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
            {order.tier === "titan" && (
              <>
                <span className="text-zinc-200">·</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Large</span>
              </>
            )}
            {order.packageName && (
              <>
                <span className="text-zinc-200">·</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#e0f6fa] text-[#007a8c]">{order.packageName}</span>
              </>
            )}
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
            {services.map(({ line, product }, idx) => {
              const linePrice = line.priceCents ?? (product?.priceCents ?? 0) * line.quantity;
              const loadNum = loadNumbers[idx];
              const assigned = order.assignments.find((a) => a.lineId === line.lineId);
              const assignedMachine = assigned ? machines.find((m) => m.id === assigned.machineId) : undefined;
              return (
                <div key={line.lineId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-zinc-50 flex items-center justify-center">
                      {product?.machineKind === "washer"
                        ? <WashingMachine size={12} className="text-zinc-400" strokeWidth={1.8} />
                        : <Wind size={12} className="text-zinc-400" strokeWidth={1.8} />
                      }
                    </div>
                    <span className="text-sm text-zinc-700">
                      {product?.name ?? line.productId}
                      {hasMultipleLoads && <span className="text-zinc-400 ml-1">· Load {loadNum}</span>}
                      {line.note && <span className="block text-[10px] text-[#009eb5] leading-tight">{line.note}</span>}
                      {line.weightKg ? <span className="block text-[10px] text-zinc-400 leading-tight">{line.weightKg} kg{line.tier === "titan" ? " · large load" : ""}</span> : null}
                    </span>
                    {assignedMachine && (
                      <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                        {assignedMachine.publicCode}
                      </span>
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
            {isActive && onAddService && (
              adding ? (
                <div className="mt-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Add a load to this order</span>
                    <button onClick={() => setAdding(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-600">Cancel</button>
                  </div>
                  {(["dryer", "washer"] as const).map((kind) => (
                    <div key={kind}>
                      <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-zinc-500 font-medium capitalize">
                        {kind === "washer" ? <WashingMachine size={11} strokeWidth={1.8} /> : <Wind size={11} strokeWidth={1.8} />}
                        {kind}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {products.filter((p) => p.machineKind === kind && !p.isExtraTime).map((p) => (
                          <button
                            key={p.id}
                            disabled={addBusy}
                            onClick={() => addLoad(p.id)}
                            className="h-8 px-3 rounded-xl border border-zinc-200 bg-white text-[12px] font-semibold text-zinc-700 hover:border-[#009eb5] hover:text-[#007a8c] hover:bg-[#e0f6fa] disabled:opacity-50 transition-colors"
                          >
                            +{p.durationMinutes} min <span className="font-normal text-zinc-400">· {formatPeso(extraRates && (p.machineKind === "washer" ? extraRates.washCentsPer10 : extraRates.dryCentsPer10) > 0 ? extraChargeCents(extraRates, p.machineKind, p.durationMinutes) : p.priceCents)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="mt-2 h-9 rounded-xl border border-dashed border-[#009eb5]/50 text-[12px] font-semibold text-[#007a8c] hover:bg-[#e0f6fa] transition-colors"
                >
                  + Add a dryer or washer load
                </button>
              )
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
                const isActioning = actionLine?.lineId === a.lineId;
                return (
                  <div key={a.lineId} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-lg tabular-nums">
                          {machine?.publicCode ?? a.machineId}
                        </span>
                        <span className="text-sm text-zinc-600">{machine?.name ?? a.machineId}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-400 mr-1">{product?.name}</span>
                        {isActive && onUnassign && (
                          <>
                            <button
                              onClick={() => {
                                if (isActioning && actionLine!.mode === "rework") { setActionLine(null); setActionReason(""); }
                                else { setActionLine({ lineId: a.lineId, machineId: a.machineId, productId: a.productId, mode: "rework" }); setActionReason(""); }
                              }}
                              title="Rework (same machine)"
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isActioning && actionLine?.mode === "rework" ? "bg-amber-100 text-amber-600" : "text-zinc-300 hover:text-amber-500 hover:bg-amber-50"}`}
                            >
                              <RotateCcw size={11} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => {
                                if (isActioning && actionLine!.mode === "reassign") { setActionLine(null); setActionReason(""); }
                                else { setActionLine({ lineId: a.lineId, machineId: a.machineId, productId: a.productId, mode: "reassign" }); setActionReason(""); }
                              }}
                              title="Reassign (different machine)"
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isActioning && actionLine?.mode === "reassign" ? "bg-teal-100 text-teal-600" : "text-zinc-300 hover:text-[#009eb5] hover:bg-[#e0f6fa]"}`}
                            >
                              <ArrowLeftRight size={11} strokeWidth={2.5} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Extra time goes on the same machine, so the laundry never moves */}
                    {isActive && onAddExtra && product && !product.isExtraTime && (() => {
                      const addons = products.filter((p) => p.machineKind === product.machineKind && p.durationMinutes <= 30).sort((a, b) => a.durationMinutes - b.durationMinutes);
                      if (addons.length === 0) return null;
                      return extraFor === a.lineId ? (
                        <div className="ml-2 pl-3 border-l-2 border-[#009eb5]/30 flex flex-col gap-2">
                          <div className="text-[10px] text-zinc-400">
                            Adds time on <strong className="text-zinc-600">{machine?.publicCode ?? a.machineId}</strong> — the laundry stays where it is.
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {addons.map((p) => (
                              <button
                                key={p.id}
                                disabled={extraBusy}
                                onClick={() => addExtra(a.lineId, p.id)}
                                className="h-8 px-3 rounded-xl border border-zinc-200 bg-white text-[11px] font-semibold text-zinc-700 hover:border-[#009eb5] hover:text-[#007a8c] hover:bg-[#e0f6fa] disabled:opacity-50 transition-colors"
                              >
                                {p.name} <span className="font-normal text-zinc-400">· {formatPeso(p.priceCents)}</span>
                              </button>
                            ))}
                            <button onClick={() => setExtraFor(null)} className="h-8 px-2 text-[11px] font-semibold text-zinc-400 hover:text-zinc-600">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setExtraFor(a.lineId)}
                          className="ml-2 self-start h-7 px-3 rounded-lg border border-dashed border-[#009eb5]/50 text-[11px] font-semibold text-[#007a8c] hover:bg-[#e0f6fa] transition-colors"
                        >
                          + Extra time on {machine?.publicCode ?? "this machine"}
                        </button>
                      );
                    })()}
                    {/* Inline picker for rework / reassign */}
                    {isActioning && actionLine && onUnassign && onAssign && (() => {
                      const al = actionLine;
                      const available = machines.filter((m) => {
                        if (m.kind !== product?.machineKind) return false;
                        if (al.mode === "rework") return m.id === a.machineId;
                        return m.id !== a.machineId && m.status === "online";
                      });
                      const reasonOk = actionReason.trim().length > 0;
                      return (
                        <div className="ml-2 pl-3 border-l-2 border-zinc-100">
                          <div className="text-[10px] text-zinc-400 mb-1.5">
                            {al.mode === "rework" ? "Confirm rework on same machine:" : "Pick replacement machine:"}
                          </div>
                          <input
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            placeholder="Reason (required)"
                            autoFocus
                            className="w-full mb-2 h-8 px-3 text-[11px] rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
                          />
                          {available.length === 0 ? (
                            <p className="text-[11px] text-zinc-300">
                              {al.mode === "rework" ? "Machine not available" : `No other ${product?.machineKind}s available`}
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {available.map((m) => (
                                <button
                                  key={m.id}
                                  disabled={!reasonOk}
                                  onClick={() => {
                                    if (!reasonOk) return;
                                    onUnassign(order.id, a.lineId, a.machineId, actionReason.trim(), al.mode);
                                    onAssign(order.id, m.id, a.productId, a.lineId);
                                    setActionLine(null);
                                    setActionReason("");
                                  }}
                                  className={`flex items-center gap-1.5 h-7 px-3 rounded-xl border text-[11px] font-semibold transition-colors ${
                                    reasonOk
                                      ? "border-zinc-200 text-zinc-700 hover:border-[#009eb5] hover:text-[#007a8c] hover:bg-[#e0f6fa]"
                                      : "border-zinc-100 text-zinc-300 cursor-not-allowed"
                                  }`}
                                >
                                  <span className="font-bold">{m.publicCode}</span>
                                  <span className="font-normal">{m.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dryer loads waiting for the washer */}
        {isActive && dryersHeld && (() => {
          const heldDryers = services.filter(({ line, product }) => product?.machineKind === "dryer" && !assignedLineIds.has(line.lineId));
          if (heldDryers.length === 0) return null;
          const runningWashers = washerAssignments
            .map((a) => machines.find((m) => m.id === a.machineId))
            .filter((m): m is Machine => !!m && m.status === "running");
          return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 flex flex-col gap-2">
              <div className="text-[12px] font-semibold text-amber-800">
                {heldDryers.length} dryer {heldDryers.length === 1 ? "load is" : "loads are"} {washerUnassigned ? "chosen after the washer" : "waiting for the washer to finish"}
              </div>
              <div className="text-[11px] text-amber-700">
                {washerUnassigned
                  ? "Pick the washer above first. Its matching dryer (for example W2 + D2) is suggested with it, and the dryer unlocks when the wash ends."
                  : <>{runningWashers.map((m) => `${m.publicCode} ${m.startedAt ? "is washing" : "hasn't been started yet"}`).join(" · ")}.
                The dryer unlocks by itself when the wash timer ends.</>}
              </div>
              {onFinishMachine && runningWashers.length > 0 && (confirmFinish ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-amber-800">Washer finished?</span>
                  <button
                    onClick={async () => { setConfirmFinish(false); for (const m of runningWashers) await onFinishMachine(m.id); }}
                    className="h-8 px-3 rounded-xl text-[11px] font-bold text-white"
                    style={{ background: "#009eb5" }}
                  >Yes, unlock dryer</button>
                  <button onClick={() => setConfirmFinish(false)} className="h-8 px-3 rounded-xl text-[11px] font-semibold text-zinc-500 bg-white border border-zinc-200">No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmFinish(true)}
                  className="self-start h-8 px-3 rounded-xl text-[11px] font-bold text-amber-800 bg-white border border-amber-300 hover:bg-amber-100 transition-colors"
                >Washer is done — unlock dryer</button>
              ))}
            </div>
          );
        })()}

        {/* Assign machine */}
        {canAssign && (
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Assign Machine</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5 text-[11px] text-zinc-500">
              <span>
                {showOtherSize
                  ? "Showing all machines."
                  : hasLargeLoad
                    ? "Large loads use the large machines (W5 + D5); regular loads use the regular machines."
                    : "Machines are matched to each load's size."}
              </span>
              <button onClick={() => setShowOtherSize((v) => !v)} className="font-semibold text-[#007a8c] hover:underline">
                {showOtherSize ? "Match sizes again" : "Show all machines"}
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {unassignedServices.map(({ line, product }) => {
                if (!product) return null;
                // Washer and dryer are chosen together: W1 pairs with D1, never W1 with D2.
                type Chip = { machine: Machine; suggested: boolean; tubDue?: boolean; sub?: string; busyNote?: string };
                let available: Chip[];
                let hint: string | null = null;
                if (product.machineKind === "washer") {
                  const pairs = rankWasherPairs(poolFor(loadTier(line)), tubCleanThreshold);
                  available = pairs.map((p) => ({
                    machine: p.washer,
                    suggested: p.suggested,
                    tubDue: p.tubDue,
                    sub: p.dryer && p.dryerFree ? `+ ${p.dryer.publicCode}` : undefined,
                    busyNote: !p.dryer ? "no dryer pair" : !p.dryerFree ? `${p.dryer.publicCode} busy` : undefined,
                  }));
                  const top = pairs[0];
                  if (top) {
                    hint = top.dryerFree && top.dryer
                      ? `Suggested pair: ${top.washer.publicCode} + ${top.dryer.publicCode}`
                      : `No washer + dryer pair is free right now. ${top.washer.publicCode} is the best washer, but its dryer is busy.`;
                  }
                } else {
                  const orderWashers = washerAssignments
                    .map((a) => machines.find((m) => m.id === a.machineId))
                    .filter((m): m is Machine => !!m);
                  const plan = planDryers(poolFor(loadTier(line)), orderWashers, tubCleanThreshold);
                  available = plan.choices.map((c) => ({ machine: c.machine, suggested: c.suggested, sub: c.pairOf ? `pairs with ${c.pairOf}` : undefined }));
                  const pick = plan.choices.find((c) => c.suggested && c.pairOf);
                  if (pick) hint = `Suggested: ${pick.machine.publicCode} (matches ${pick.pairOf})`;
                  else if (plan.pairBusy) hint = `${plan.pairCodes.join(" / ")} (the matching dryer) is busy. Wait for it, or pick another.`;
                }
                const serviceIdx = services.findIndex((s) => s.line.lineId === line.lineId);
                const loadNum = loadNumbers[serviceIdx];
                return (
                  <div key={line.lineId}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded-md bg-zinc-50 flex items-center justify-center">
                        {product.machineKind === "washer"
                          ? <WashingMachine size={11} className="text-zinc-400" strokeWidth={1.8} />
                          : <Wind size={11} className="text-zinc-400" strokeWidth={1.8} />
                        }
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        {product.name}
                        {hasMultipleLoads && <span className="text-zinc-300 ml-1">· Load {loadNum}</span>}
                        {line.weightKg ? <span className="text-zinc-400 ml-1">· {line.weightKg} kg</span> : null}
                        {loadTier(line) === "titan" && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Large</span>}
                      </span>
                    </div>
                    {hint && <p className="text-[11px] text-[#007a8c] mb-1.5 px-0.5">{hint}</p>}
                    {available.length === 0 ? (
                      <p className="text-[11px] text-zinc-300 px-1">
                        No available {product.machineKind}s
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {available.map(({ machine: m, suggested, tubDue, sub, busyNote }) => (
                          <button
                            key={m.id}
                            onClick={() => onAssign(order.id, m.id, line.productId, line.lineId)}
                            className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[11px] font-semibold transition-colors ${
                              suggested
                                ? "border-[#009eb5] bg-[#e0f6fa] text-[#007a8c]"
                                : "border-zinc-200 text-zinc-700 hover:border-[#009eb5] hover:text-[#007a8c] hover:bg-[#e0f6fa]"
                            }`}
                          >
                            <span className="font-bold">{m.publicCode}</span>
                            <span className={suggested ? "font-normal text-[#009eb5]" : "text-zinc-400 font-normal"}>{m.name}</span>
                            {sub && <span className="font-medium text-[#007a8c]">{sub}</span>}
                            {suggested && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#007a8c] text-white">Suggested</span>
                            )}
                            {busyNote && <span className="font-normal italic text-zinc-400">{busyNote}</span>}
                            {tubDue && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Clean due</span>
                            )}
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
  packages: ServicePackage[];
  isAdmin?: boolean;
  showCreate?: boolean;
  onCloseCreate?: () => void;
  onCreateOrder?: (payload: NewOrderPayload) => Promise<JobOrder>;
  onVoidOrder?: (orderId: string) => Promise<void>;
  onAddService?: (orderId: string, productId: string) => Promise<void>;
  onAddExtra?: (orderId: string, lineId: string, productId: string) => Promise<void>;
  onFinishMachine?: (machineId: string) => Promise<void> | void;
  extraRates?: ExtraRates;
  tubCleanThreshold?: number;
  onAssign?: (orderId: string, machineId: string, productId: string, lineId: string) => void;
  onUnassign?: (orderId: string, lineId: string, machineId: string, reason: string, mode: "rework" | "reassign") => void;
}

export default function OrdersSection({ orders: initialOrders, products, packages, machines, isAdmin, showCreate, onCloseCreate, onCreateOrder, onVoidOrder, onAddService, onAddExtra, onFinishMachine, extraRates, tubCleanThreshold, onAssign, onUnassign }: Props) {
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

  const handleCheckout = async (payload: NewOrderPayload) => {
    if (!onCreateOrder) return;
    const created = await onCreateOrder(payload);
    setSelectedId(created.id);
    onCloseCreate?.();
  };

  const handleVoid = async (id: string) => {
    if (onVoidOrder) {
      try {
        await onVoidOrder(id);
      } catch {
        return; // the app shows the error
      }
      setSelectedId(null);
      return;
    }
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

      {/* ── Right: create form or detail panel (desktop) ── */}
      <div className="hidden lg:block sticky top-5">
        <AnimatePresence mode="wait">
          {showCreate ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="bg-white rounded-2xl border border-zinc-100 overflow-hidden"
              style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-0">
                <span className="text-sm font-bold text-zinc-900">New Job Order</span>
                {onCloseCreate && (
                  <button onClick={onCloseCreate} className="w-7 h-7 flex items-center justify-center rounded-xl text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <JobOrderForm products={products} packages={packages} extraRates={extraRates} onCheckout={handleCheckout} />
            </motion.div>
          ) : selected ? (
            <DetailPanel
              key={selected.id}
              order={selected}
              products={products}
              machines={machines}
              isAdmin={isAdmin}
              onClose={() => setSelectedId(null)}
              onVoid={handleVoid}
              onAssign={onAssign}
              onUnassign={onUnassign}
              onAddService={onAddService}
              onFinishMachine={onFinishMachine}
              onAddExtra={onAddExtra}
              extraRates={extraRates}
              tubCleanThreshold={tubCleanThreshold}
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

      {/* ── Mobile: create form drawer ── */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              key="create-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseCreate}
              className="lg:hidden fixed inset-0 bg-black/30 z-[55]"
            />
            <motion.div
              key="create-drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-white overflow-auto"
              style={{ maxHeight: "92dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-5 pt-5 pb-2">
                <span className="text-base font-bold text-zinc-900">New Job Order</span>
                {onCloseCreate && (
                  <button onClick={onCloseCreate} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
              <JobOrderForm products={products} packages={packages} extraRates={extraRates} onCheckout={handleCheckout} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile: order detail drawer ── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="lg:hidden fixed inset-0 bg-black/30 z-[55]"
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-white overflow-y-auto"
              style={{ maxHeight: "90dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <DetailPanel
                order={selected}
                products={products}
                machines={machines}
                isAdmin={isAdmin}
                onClose={() => setSelectedId(null)}
                onVoid={handleVoid}
                onAssign={onAssign}
                onUnassign={onUnassign}
              onAddService={onAddService}
              onFinishMachine={onFinishMachine}
              onAddExtra={onAddExtra}
              extraRates={extraRates}
              tubCleanThreshold={tubCleanThreshold}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
