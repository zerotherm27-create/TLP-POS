import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { Machine, JobOrder, Product } from "@tlp/shared";

interface Props {
  machine: Machine;
  order?: JobOrder | null;
  products?: Product[];
  threshold?: number;
  onClose: () => void;
  /** Extra action content rendered under the details (e.g. rework / reassign). */
  children?: React.ReactNode;
}

const timeFmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function fmtDuration(totalSecs: number) {
  const s = Math.max(0, Math.floor(totalSecs));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtMinutes(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-zinc-50 last:border-0">
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-sm font-semibold text-zinc-800 text-right break-words min-w-0">{value}</span>
    </div>
  );
}

const STATUS_STYLE = {
  running: { label: "Running", bg: "#e0f6fa", fg: "#007a8c" },
  online: { label: "Available", bg: "#f0fdf4", fg: "#16a34a" },
  offline: { label: "Offline", bg: "#f4f4f5", fg: "#71717a" },
} as const;

export default function MachineDetailSheet({ machine, order, products, threshold, onClose, children }: Props) {
  const running = machine.status === "running";
  const started = !!machine.startedAt;
  const now = useNow(running && started);

  const durationMin = machine.remainingMinutes ?? 0;
  const startMs = machine.startedAt ? new Date(machine.startedAt).getTime() : null;
  const endMs = startMs !== null ? startMs + durationMin * 60000 : null;
  const leftSecs = endMs !== null ? Math.max(0, (endMs - now) / 1000) : null;
  const pct = endMs !== null && durationMin > 0 ? Math.min(100, ((durationMin * 60 - (leftSecs ?? 0)) / (durationMin * 60)) * 100) : 0;

  const assignment = order?.assignments.find((a) => a.machineId === machine.id) ?? null;
  const product = assignment ? products?.find((p) => p.id === assignment.productId) : undefined;
  const customer = machine.customerName ?? order?.customerName;

  const lastSeenMins = machine.lastSeenAt ? Math.floor((Date.now() - new Date(machine.lastSeenAt).getTime()) / 60000) : null;
  const since = (machine.cycleCount ?? 0) - (machine.lastTubCleanCycle ?? 0);
  const st = STATUS_STYLE[machine.status];

  return (
    <>
      <motion.div
        key="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/30 z-40"
      />
      <motion.div
        key="detail-sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-white overflow-hidden flex flex-col sm:max-w-md sm:mx-auto"
        style={{ maxHeight: "80dvh" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
          <div className="min-w-0">
            <div className="text-sm font-bold text-zinc-900 truncate">{machine.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-lg">{machine.publicCode}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {running && started && (
            <div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Time left</span>
                <span className="text-2xl font-bold tabular-nums text-[#007a8c] leading-none">{fmtDuration(leftSecs ?? 0)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#009eb5" }} />
              </div>
            </div>
          )}
          {running && !started && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[12px] font-semibold text-amber-700">
              Assigned — timer hasn't started yet
            </div>
          )}

          <div>
            {running && (
              <>
                <Row label="Customer" value={customer ?? "—"} />
                {order && <Row label="Order" value={order.orderNumber ?? order.id} />}
                {order?.contactNumber && <Row label="Contact" value={order.contactNumber} />}
                {product && <Row label="Service" value={product.name} />}
                <Row label="Started" value={startMs !== null ? timeFmt(new Date(startMs)) : "Not started"} />
                <Row label="Ends" value={endMs !== null ? timeFmt(new Date(endMs)) : "—"} />
                {durationMin > 0 && <Row label="Cycle length" value={fmtMinutes(durationMin)} />}
                {order?.notes && <Row label="Notes" value={order.notes} />}
              </>
            )}
            {machine.status === "offline" && (
              <Row
                label="Last seen"
                value={machine.lastSeenAt ? `${lastSeenMins}m ago (${timeFmt(new Date(machine.lastSeenAt))})` : "Never"}
              />
            )}
            {machine.status === "online" && <Row label="Status" value="Ready for the next load" />}
            <Row label="Type" value={`${machine.kind === "washer" ? "Washer" : "Dryer"}${machine.tier ? ` · ${machine.tier}` : ""}`} />
            <Row label="Total cycles" value={machine.cycleCount ?? 0} />
            {machine.totalRunMinutes !== undefined && <Row label="Total run time" value={fmtMinutes(machine.totalRunMinutes)} />}
            {machine.kind === "washer" && (
              <Row
                label="Since tub clean"
                value={
                  <span className={threshold !== undefined && since >= threshold ? "text-amber-600" : undefined}>
                    {since}{threshold !== undefined ? ` / ${threshold}` : ""} loads
                  </span>
                }
              />
            )}
          </div>

          {children}
        </div>
      </motion.div>
    </>
  );
}
