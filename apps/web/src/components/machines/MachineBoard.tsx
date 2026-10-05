import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MachineCard from "./MachineCard";
import type { Machine } from "@tlp/shared";
import { WashingMachine, Wind, Zap, CheckCircle2, WifiOff, Settings2, AlertTriangle } from "lucide-react";

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
  onMarkCleaned?: (machineId: string) => void;
}

export default function MachineBoard({ machines, isAdmin, onMarkCleaned }: Props) {
  const [threshold, setThreshold] = useState(50);
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [draftThreshold, setDraftThreshold] = useState(String(threshold));

  const washers = machines.filter((m) => m.kind === "washer");
  const dryers = machines.filter((m) => m.kind === "dryer");
  const running = machines.filter((m) => m.status === "running");
  const available = machines.filter((m) => m.status === "online").length;
  const offline = machines.filter((m) => m.status === "offline").length;

  const isDue = (m: Machine) =>
    m.kind === "washer" &&
    (m.cycleCount ?? 0) - (m.lastTubCleanCycle ?? 0) >= threshold;

  const dueCount = machines.filter(isDue).length;

  const applyThreshold = () => {
    const n = parseInt(draftThreshold, 10);
    if (!isNaN(n) && n > 0) setThreshold(n);
    setShowThresholdEditor(false);
  };

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
        onMarkCleaned={isAdmin ? onMarkCleaned : undefined}
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

          {/* Admin: threshold settings trigger */}
          {isAdmin && (
            <button
              onClick={() => {
                setDraftThreshold(String(threshold));
                setShowThresholdEditor((v) => !v);
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors"
              title="Tub cleaning settings"
            >
              <Settings2 size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ── Admin: threshold editor panel ── */}
      <AnimatePresence>
        {isAdmin && showThresholdEditor && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="overflow-hidden"
          >
            <div
              className="bg-amber-50 border border-amber-200/70 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1">
                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">
                  Tub Cleaning Reminder
                </div>
                <div className="text-[12px] text-amber-600">
                  Notify after every{" "}
                  <strong>{threshold}</strong> loads per machine.
                  Currently: {washers.map((m) => `${m.publicCode} (${(m.cycleCount ?? 0) - (m.lastTubCleanCycle ?? 0)} loads)`).join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[11px] text-amber-700 font-semibold">Every</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={draftThreshold}
                  onChange={(e) => setDraftThreshold(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyThreshold()}
                  className="w-16 h-8 rounded-xl border border-amber-300 bg-white text-center text-sm font-bold text-amber-800 outline-none focus:ring-2 focus:ring-amber-400/50 tabular-nums"
                />
                <label className="text-[11px] text-amber-700 font-semibold">loads</label>
                <button
                  onClick={applyThreshold}
                  className="h-8 px-3 text-[11px] font-bold text-white rounded-xl"
                  style={{ background: "#d97706" }}
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Now Running hero strip ── */}
      <AnimatePresence>
        {running.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-[#009eb5]"
              />
              <span className="text-[11px] font-bold text-[#009eb5] uppercase tracking-widest">
                Now Running
              </span>
              <div className="flex-1 h-px bg-[#009eb5]/15" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[10px]">
              {running.map((m, i) => renderCard(m, i * 0.06))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Washers grid ── */}
      <div>
        <SectionLabel label="Washers" count={washers.length} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[10px]">
          {washers.map((m, i) => renderCard(m, i * 0.04))}
        </div>
      </div>

      {/* ── Dryers grid ── */}
      <div>
        <SectionLabel label="Dryers" count={dryers.length} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[10px]">
          {dryers.map((m, i) => renderCard(m, (washers.length + i) * 0.04))}
        </div>
      </div>
    </div>
  );
}
