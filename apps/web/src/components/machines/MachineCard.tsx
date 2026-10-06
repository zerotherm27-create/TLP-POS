import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { WashingMachine, Wind } from "lucide-react";
import type { Machine } from "@tlp/shared";

/* ── Wall-clock countdown ── */
function useMiniCountdown(startedAt: string | undefined, durationMinutes: number) {
  const getRemainingMs = () => {
    if (!startedAt) return null;
    const endMs = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    return Math.max(0, endMs - Date.now());
  };
  const [ms, setMs] = useState<number | null>(getRemainingMs);
  useEffect(() => {
    if (!startedAt) { setMs(null); return; }
    setMs(getRemainingMs());
    const id = setInterval(() => setMs(getRemainingMs()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (ms === null) return null;
  const secs = Math.floor(ms / 1000);
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

function MiniWhirl() {
  return (
    <motion.svg width="14" height="14" viewBox="0 0 30 30" fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
    >
      <path d="M 15 2 A 13 13 0 1 1 3.7 21.5" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 23.5 15 A 8.5 8.5 0 1 1 15 6.5" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 15 19.5 A 4.5 4.5 0 1 1 19.5 13" stroke="rgba(255,255,255,0.28)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="15" cy="15" r="1.4" fill="rgba(255,255,255,0.4)" />
    </motion.svg>
  );
}

function MiniWind() {
  return (
    <motion.div
      animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.05, 0.95] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <Wind size={12} strokeWidth={1.8} className="text-white" />
    </motion.div>
  );
}

/* ── Tier badges: hidden on mobile, visible sm+ ── */
function TierBadge({ tier }: { tier: "giant" | "titan" }) {
  return (
    <span
      className="hidden sm:inline text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
      style={tier === "titan"
        ? { background: "rgba(255,214,0,0.22)", color: "#ffe87e" }
        : { background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }
      }
    >{tier}</span>
  );
}

function TierBadgeLight({ tier }: { tier: "giant" | "titan" }) {
  return (
    <span
      className="hidden sm:inline text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
      style={tier === "titan"
        ? { background: "#fefce8", color: "#92400e" }
        : { background: "#f4f4f5", color: "#71717a" }
      }
    >{tier}</span>
  );
}

/* ── RUNNING card ── */
function RunningCard({ machine }: { machine: Machine }) {
  const countdown = useMiniCountdown(machine.startedAt, machine.remainingMinutes ?? 0);
  const started = !!machine.startedAt;
  const maxSecs = (machine.remainingMinutes ?? 0) * 60;
  const remainMs = machine.startedAt
    ? Math.max(0, new Date(machine.startedAt).getTime() + maxSecs * 1000 - Date.now())
    : 0;
  const pct = started && maxSecs > 0 ? Math.min(100, ((maxSecs - remainMs / 1000) / maxSecs) * 100) : 0;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="relative rounded-2xl overflow-hidden flex flex-col h-full"
      style={{
        background: "linear-gradient(145deg, #006a7e 0%, #009eb5 55%, #00bcd4 100%)",
        boxShadow: "0 6px 18px -6px rgba(0,158,181,0.5), 0 1px 4px -1px rgba(0,0,0,0.12)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        opacity: 0.6,
      }} />
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)" }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-2 pb-0 sm:px-2.5 sm:pt-2.5">
        <span className="text-[9px] sm:text-[10px] font-bold text-white/60 tracking-widest uppercase">{machine.publicCode}</span>
        {machine.tier && <TierBadge tier={machine.tier} />}
      </div>

      {/* Center: responsive ring container via viewBox */}
      <div className="flex-1 flex flex-col items-center justify-center py-2 sm:py-3">
        {started ? (
          <>
            <div className="relative w-9 h-9 sm:w-11 sm:h-11">
              <svg width="100%" height="100%" viewBox="0 0 44 44" className="-rotate-90">
                <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                <motion.circle
                  cx="22" cy="22" r={r} fill="none"
                  stroke="rgba(255,255,255,0.85)" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: dash }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {machine.kind === "washer" ? <MiniWhirl /> : <MiniWind />}
              </div>
            </div>
            {countdown && (
              <span className="text-white/80 text-[9px] sm:text-[10px] font-bold tabular-nums tracking-wider mt-1 sm:mt-1.5">{countdown}</span>
            )}
          </>
        ) : (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
              {machine.kind === "washer" ? <MiniWhirl /> : <MiniWind />}
            </div>
            <span className="text-white/45 text-[8px] sm:text-[9px] font-semibold uppercase tracking-widest">Pending</span>
          </motion.div>
        )}
      </div>

      {/* Customer */}
      <div className="px-2 pb-2 sm:px-2.5 sm:pb-2.5">
        <div className="h-px bg-white/10 mb-1.5 sm:mb-2" />
        <div className="text-white text-[8px] sm:text-[10px] font-semibold leading-tight break-words line-clamp-2 sm:line-clamp-1">{machine.customerName ?? machine.name}</div>
      </div>
    </motion.div>
  );
}

/* ── ONLINE card ── */
function OnlineCard({ machine }: { machine: Machine }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="rounded-2xl bg-white border border-zinc-100 flex flex-col overflow-hidden h-full"
      style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between px-2 pt-2 pb-0 sm:px-2.5 sm:pt-2.5">
        <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 tracking-widest uppercase">{machine.publicCode}</span>
        {machine.tier && <TierBadgeLight tier={machine.tier} />}
      </div>
      <div className="flex-1 flex items-center justify-center py-2 sm:py-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center" style={{ background: "#e0f6fa" }}>
          {machine.kind === "washer"
            ? <WashingMachine size={16} strokeWidth={1.5} style={{ color: "#009eb5" }} />
            : <Wind size={16} strokeWidth={1.5} style={{ color: "#009eb5" }} />}
        </div>
      </div>
      <div className="px-2 pb-2 sm:px-2.5 sm:pb-2.5">
        <div className="h-px bg-zinc-100 mb-1.5 sm:mb-2" />
        <div className="text-[8px] sm:text-[10px] font-semibold leading-tight break-words line-clamp-2 sm:line-clamp-1 text-zinc-700">{machine.name}</div>
        <div className="flex items-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-[8px] sm:text-[9px] text-emerald-600 font-medium">Available</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── OFFLINE card ── */
function OfflineCard({ machine }: { machine: Machine }) {
  const mins = machine.lastSeenAt
    ? Math.floor((Date.now() - new Date(machine.lastSeenAt).getTime()) / 60000)
    : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 flex flex-col overflow-hidden h-full"
    >
      <div className="flex items-center justify-between px-2 pt-2 pb-0 sm:px-2.5 sm:pt-2.5">
        <span className="text-[9px] sm:text-[10px] font-bold text-zinc-300 tracking-widest uppercase">{machine.publicCode}</span>
        {machine.tier && (
          <span className="hidden sm:inline text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400 shrink-0">{machine.tier}</span>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center py-2 sm:py-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
          {machine.kind === "washer"
            ? <WashingMachine size={16} strokeWidth={1.5} className="text-zinc-300" />
            : <Wind size={16} strokeWidth={1.5} className="text-zinc-300" />}
        </div>
      </div>
      <div className="px-2 pb-2 sm:px-2.5 sm:pb-2.5">
        <div className="h-px bg-zinc-200 mb-1.5 sm:mb-2" />
        <div className="text-[8px] sm:text-[10px] font-semibold leading-tight break-words line-clamp-2 sm:line-clamp-1 text-zinc-400">{machine.name}</div>
        <div className="flex items-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
          <span className="text-[8px] sm:text-[9px] text-zinc-400 font-medium">
            {mins !== null ? `${mins}m ago` : "Offline"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Public export ── */
interface Props {
  machine: Machine;
  onSelect?: (m: Machine) => void;
  tubCleaningDue?: boolean;
  onMarkCleaned?: (id: string) => void;
}

export default function MachineCard({ machine, onSelect, tubCleaningDue, onMarkCleaned }: Props) {
  const [confirming, setConfirming] = useState(false);

  const card =
    machine.status === "running" ? <RunningCard machine={machine} /> :
    machine.status === "online"  ? <OnlineCard machine={machine} /> :
                                   <OfflineCard machine={machine} />;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={() => { setConfirming(false); onSelect?.(machine); }}
      className="relative h-full"
    >
      {card}

      {tubCleaningDue && (
        <>
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "inset 0 0 0 2px #f59e0b" }}
          />
          {confirming ? (
            <div
              className="absolute inset-0 rounded-2xl bg-white/95 flex flex-col items-center justify-center gap-1 p-1 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[8px] sm:text-[10px] font-bold text-amber-700 leading-tight">Tub clean done?</div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onMarkCleaned?.(machine.id); setConfirming(false); }}
                  className="h-5 px-1.5 rounded-full text-[8px] font-bold bg-amber-500 text-white border border-amber-600"
                >Yes</button>
                <button
                  onClick={() => setConfirming(false)}
                  className="h-5 px-1.5 rounded-full text-[8px] font-bold bg-white text-zinc-500 border border-zinc-200"
                >No</button>
              </div>
            </div>
          ) : (
            <motion.button
              className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase"
              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              onClick={(e) => { e.stopPropagation(); if (onMarkCleaned) setConfirming(true); }}
            >TUB</motion.button>
          )}
        </>
      )}
    </motion.div>
  );
}
