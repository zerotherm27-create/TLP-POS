import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MachineCard from "./MachineCard";
import MachineDetailSheet from "./MachineDetailSheet";
import ConnectionTest from "./ConnectionTest";
import type { Machine, JobOrder, Product } from "@tlp/shared";
import { WashingMachine, Wind, Zap, CheckCircle2, WifiOff, AlertTriangle, RotateCcw, ArrowLeftRight, Play } from "lucide-react";

/* ── Stat chip ── */
function StatChip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon size={14} style={{ color }} strokeWidth={2} />
      </div>
      <div>
        <div className="text-xs font-bold text-zinc-800 leading-none">{value}</div>
        <div className="text-[10px] text-zinc-400 leading-none mt-0.5">{label}</div>
      </div>
    </div>
  );
}

/* ── Section header ── */
function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-semibold text-zinc-300 tabular-nums">{count}</span>
      <div className="flex-1 h-px bg-zinc-100" />
    </div>
  );
}

/* ── Main board ── */
interface Props {
  machines: Machine[];
  isAdmin?: boolean;
  threshold?: number;
  onMarkCleaned?: (machineId: string) => void;
  orders?: JobOrder[];
  products?: Product[];
  onUnassign?: (orderId: string, lineId: string, machineId: string, reason: string, mode: "rework" | "reassign") => void;
  onAssign?: (orderId: string, machineId: string, productId: string, lineId: string) => void;
  onActivateMachine?: (machineId: string) => void;
  onTestMachine?: (machineId: string) => Promise<{ ok: boolean; message: string }>;
  /** Ends the time in the POS only (emergency). The reason is required by the popup. */
  onFinishMachine?: (machineId: string, reason?: string) => Promise<void> | void;
  /** Open this machine's popup as soon as the board shows (set after a machine is assigned). */
  openMachineId?: string | null;
  onOpenedMachine?: () => void;
}

export default function MachineBoard({ machines, isAdmin, threshold = 50, onMarkCleaned, orders, products, onUnassign, onAssign, onActivateMachine, onTestMachine, onFinishMachine, openMachineId, onOpenedMachine }: Props) {
  // Keep only the id and read the machine from the live list, so the popup follows refreshes.
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeMachine = machines.find((m) => m.id === activeId) ?? null;
  const [sheetReason, setSheetReason] = useState("");
  const [endReason, setEndReason] = useState("");

  useEffect(() => {
    if (!openMachineId) return;
    setActiveId(openMachineId);
    setSheetReason("");
    setEndReason("");
    onOpenedMachine?.();
  }, [openMachineId, onOpenedMachine]);

  const washers = machines.filter((m) => m.kind === "washer");
  const dryers = machines.filter((m) => m.kind === "dryer");
  const running = machines.filter((m) => m.status === "running" && !m.queued); // a queued dryer isn't running yet
  const available = machines.filter((m) => m.status === "online").length;
  const offline = machines.filter((m) => m.status === "offline").length;

  const isDue = (m: Machine) =>
    m.kind === "washer" &&
    (m.cycleCount ?? 0) - (m.lastTubCleanCycle ?? 0) >= threshold;

  const dueCount = machines.filter(isDue).length;

  const handleCardSelect = (m: Machine) => {
    setActiveId(m.id);
    setSheetReason("");
    setEndReason("");
  };

  const closeSheet = () => {
    setActiveId(null);
    setSheetReason("");
    setEndReason("");
  };

  // Resolve the order and assignment for the active machine
  const activeOrder = activeMachine?.activeJobOrderId
    ? (orders ?? []).find((o) => o.id === activeMachine.activeJobOrderId) ?? null
    : null;
  const activeAssignment = activeOrder?.assignments.find((a) => a.machineId === activeMachine?.id) ?? null;

  const reasonOk = sheetReason.trim().length > 0;

  const renderCard = (m: Machine, delay: number) => (
    <motion.div
      key={m.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 26, delay }}
    >
      <MachineCard
        machine={m}
        tubCleaningDue={isDue(m)}
        onMarkCleaned={onMarkCleaned}
        onSelect={handleCardSelect}
      />
    </motion.div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Stats bar ── */}
      <div
        className="flex items-center gap-5 px-5 py-3.5 rounded-2xl bg-white border border-zinc-100 flex-wrap"
        style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
      >
        <StatChip icon={Zap} label="Running" value={running.length} color="#009eb5" />
        <div className="w-px h-6 bg-zinc-100 hidden sm:block" />
        <StatChip icon={CheckCircle2} label="Available" value={available} color="#22c55e" />
        <div className="w-px h-6 bg-zinc-100 hidden sm:block" />
        <StatChip icon={WifiOff} label="Offline" value={offline} color="#a1a1aa" />

        {/* Cleaning due badge */}
        {dueCount > 0 && (
          <>
            <div className="w-px h-6 bg-zinc-100 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "#fef3c718" }}
              >
                <AlertTriangle size={14} style={{ color: "#d97706" }} strokeWidth={2} />
              </motion.div>
              <div>
                <div className="text-xs font-bold text-amber-600 leading-none">{dueCount}</div>
                <div className="text-[10px] text-amber-500 leading-none mt-0.5">Clean due</div>
              </div>
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <WashingMachine size={13} className="text-zinc-400" strokeWidth={1.8} />
              <span className="text-[11px] text-zinc-400">{washers.length} washers</span>
            </div>
            <div className="w-px h-4 bg-zinc-100" />
            <div className="flex items-center gap-1.5">
              <Wind size={13} className="text-zinc-400" strokeWidth={1.8} />
              <span className="text-[11px] text-zinc-400">{dryers.length} dryers</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Dryers grid ── */}
      <div>
        <SectionLabel label="Dryers" count={dryers.length} />
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {dryers.map((m, i) => renderCard(m, i * 0.04))}
        </div>
      </div>

      {/* ── Washers grid ── */}
      <div>
        <SectionLabel label="Washers" count={washers.length} />
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {washers.map((m, i) => renderCard(m, (dryers.length + i) * 0.04))}
        </div>
      </div>

      {/* ── Machine detail sheet (card tap) ── */}
      <AnimatePresence>
        {activeMachine && (
          <MachineDetailSheet
            machine={activeMachine}
            order={activeOrder}
            products={products}
            threshold={threshold}
            onClose={closeSheet}
          >
            {onTestMachine && (
              <ConnectionTest machineId={activeMachine.id} machineName={activeMachine.name} onTest={onTestMachine} />
            )}
            {activeMachine.status === "running" && (
              <>
                {/* Activate — sends the waiting load to the machine; the timer starts when Start is pressed on it */}
                {activeMachine.queued && (
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-bold text-amber-800">Queued — waiting for {activeMachine.waitingOn ?? "the washer"}</div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      This dryer is already set for the order. Activate unlocks here as soon as the washer finishes.
                    </div>
                  </div>
                )}
                {!activeMachine.startedAt && !activeMachine.queued && onActivateMachine && (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-emerald-800">
                        {activeMachine.activation === "ready" ? "Activated — press Start on the machine" : "Activate machine"}
                      </div>
                      <div className="text-[11px] text-emerald-600 mt-0.5">
                        {activeMachine.activation === "ready"
                          ? "The machine accepted the load. Press Start on the machine now."
                          : activeMachine.activation === "sending"
                            ? "Sending the load to the machine…"
                            : activeMachine.activation === "failed"
                              ? "The machine didn't answer. Check it is on, then try again."
                              : "Sends this order to the machine and starts the timer. Press Start on the machine right after."}
                      </div>
                      {activeMachine.kind === "washer" && activeMachine.activation !== "ready" && (
                        <div className="text-[11px] font-bold text-amber-700 mt-1.5">
                          {activeMachine.remainingMinutes === 45
                            ? "After Activate, a reminder will tell you to press COLD on the washer."
                            : activeMachine.remainingMinutes === 35
                              ? "Check HOT is selected on the washer (it is after switching on), then Activate."
                              : null}
                        </div>
                      )}
                    </div>
                    <button
                      disabled={activeMachine.activation === "sending"}
                      onClick={() => {
                        onActivateMachine(activeMachine.id);
                        closeSheet();
                      }}
                      className="shrink-0 flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={14} strokeWidth={2.5} fill="currentColor" />
                      {activeMachine.activation === "ready" ? "Send again" : activeMachine.activation === "failed" ? "Try again" : "Activate"}
                    </button>
                  </div>
                )}

                {/* Rework / Reassign — only available once machine has started */}
                {activeOrder && activeAssignment && onUnassign && onAssign && (
                  <>
                    {/* Reason input */}
                    <div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Reason</div>
                      <input
                        value={sheetReason}
                        onChange={(e) => setSheetReason(e.target.value)}
                        placeholder="Describe why this machine needs rework or reassignment…"
                                                className="w-full h-9 px-3 text-sm rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
                      />
                    </div>

                    {/* Rework */}
                    <div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Rework</div>
                      <button
                        disabled={!reasonOk}
                        onClick={() => {
                          if (!reasonOk) return;
                          onUnassign(activeOrder.id, activeAssignment.lineId, activeMachine.id, sheetReason.trim(), "rework");
                          onAssign(activeOrder.id, activeMachine.id, activeAssignment.productId, activeAssignment.lineId);
                          closeSheet();
                        }}
                        className={`flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-semibold transition-colors ${
                          reasonOk
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed"
                        }`}
                      >
                        <RotateCcw size={14} strokeWidth={2.5} />
                        Restart on {activeMachine.publicCode}
                      </button>
                    </div>

                    {/* Reassign */}
                    <div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Reassign to another machine</div>
                      {(() => {
                        const alternatives = machines.filter(
                          (m) => m.kind === activeMachine.kind && m.status === "online" && m.id !== activeMachine.id
                        );
                        if (alternatives.length === 0) {
                          return <p className="text-[11px] text-zinc-300">No other {activeMachine.kind}s available</p>;
                        }
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {alternatives.map((m) => (
                              <button
                                key={m.id}
                                disabled={!reasonOk}
                                onClick={() => {
                                  if (!reasonOk) return;
                                  onUnassign(activeOrder.id, activeAssignment.lineId, activeMachine.id, sheetReason.trim(), "reassign");
                                  onAssign(activeOrder.id, m.id, activeAssignment.productId, activeAssignment.lineId);
                                  closeSheet();
                                }}
                                className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-[12px] font-semibold transition-colors ${
                                  reasonOk
                                    ? "border-zinc-200 text-zinc-700 hover:border-[#009eb5] hover:text-[#007a8c] hover:bg-[#e0f6fa]"
                                    : "border-zinc-100 text-zinc-300 cursor-not-allowed"
                                }`}
                              >
                                <ArrowLeftRight size={12} strokeWidth={2.5} />
                                <span className="font-bold">{m.publicCode}</span>
                                <span className="font-normal text-zinc-400">{m.name}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {/* End time — frees the machine in the POS only; for emergencies */}
                {onFinishMachine && (
                  <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
                    <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5">End time</div>
                    <p className="text-[11px] text-red-700 mb-2.5 leading-relaxed">
                      This does not stop the machine. For emergency purposes only. The transaction will not be rolled back.
                    </p>
                    <input
                      value={endReason}
                      onChange={(e) => setEndReason(e.target.value)}
                      placeholder="Reason for ending the time (required)…"
                      className="w-full h-9 px-3 text-sm rounded-xl border border-red-200 bg-white text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all"
                    />
                    <button
                      disabled={endReason.trim().length === 0}
                      onClick={() => {
                        const why = endReason.trim();
                        if (!why) return;
                        onFinishMachine(activeMachine.id, why);
                        closeSheet();
                      }}
                      className={`mt-2.5 h-10 px-4 rounded-xl text-sm font-bold transition-colors ${
                        endReason.trim().length > 0
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                      }`}
                    >
                      End time now
                    </button>
                  </div>
                )}
              </>
            )}
          </MachineDetailSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
