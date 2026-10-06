import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MachineCard from "./MachineCard";
import MachineDetailSheet from "./MachineDetailSheet";
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
  onStartMachine?: (machineId: string) => void;
}

export default function MachineBoard({ machines, isAdmin, threshold = 50, onMarkCleaned, orders, products, onUnassign, onAssign, onStartMachine }: Props) {
  const [activeMachine, setActiveMachine] = useState<Machine | null>(null);
  const [sheetReason, setSheetReason] = useState("");

  const washers = machines.filter((m) => m.kind === "washer");
  const dryers = machines.filter((m) => m.kind === "dryer");
  const running = machines.filter((m) => m.status === "running");
  const available = machines.filter((m) => m.status === "online").length;
  const offline = machines.filter((m) => m.status === "offline").length;

  const isDue = (m: Machine) =>
    m.kind === "washer" &&
    (m.cycleCount ?? 0) - (m.lastTubCleanCycle ?? 0) >= threshold;

  const dueCount = machines.filter(isDue).length;

  const handleCardSelect = (m: Machine) => {
    setActiveMachine(m);
    setSheetReason("");
  };

  const closeSheet = () => {
    setActiveMachine(null);
    setSheetReason("");
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

      {/* ── Washers grid ── */}
      <div>
        <SectionLabel label="Washers" count={washers.length} />
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {washers.map((m, i) => renderCard(m, i * 0.04))}
        </div>
      </div>

      {/* ── Dryers grid ── */}
      <div>
        <SectionLabel label="Dryers" count={dryers.length} />
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {dryers.map((m, i) => renderCard(m, (washers.length + i) * 0.04))}
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
            {activeMachine.status === "running" && (
              <>
                {/* Start Timer — shown only when machine not yet physically activated */}
                {!activeMachine.startedAt && onStartMachine && (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-emerald-800">Start timer manually</div>
                      <div className="text-[11px] text-emerald-600 mt-0.5">
                        Machine is assigned but timer hasn't started. Tap when the machine physically begins.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onStartMachine(activeMachine.id);
                        closeSheet();
                      }}
                      className="shrink-0 flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
                    >
                      <Play size={14} strokeWidth={2.5} fill="currentColor" />
                      Start
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
              </>
            )}
          </MachineDetailSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
