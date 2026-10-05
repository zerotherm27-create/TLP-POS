import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { WashingMachine, Wind, Clock } from "lucide-react";
import type { Machine } from "@tlp/shared";

/* ── Wall-clock countdown ──
   Computes remaining seconds from startedAt + durationMinutes.
   Returns null if startedAt is absent (machine not yet physically activated). */
function useCountdown(startedAt: string | undefined, durationMinutes: number) {
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

  if (ms === null) return { display: null, totalSecs: 0 };
  const secs = Math.floor(ms / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return { display: `${m}:${s}`, totalSecs: secs };
}

/* ── SVG circular progress ring ── */
function ProgressRing({ pct, size = 80, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.85)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: dash }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}

/* ── Whirlpool SVG (washer) ── */
function WaterWhirl() {
  return (
    <motion.svg
      width="30" height="30" viewBox="0 0 30 30" fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
    >
      <path d="M 15 2 A 13 13 0 1 1 3.7 21.5" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 23.5 15 A 8.5 8.5 0 1 1 15 6.5" stroke="rgba(255,255,255,0.58)" strokeWidth="2.0" strokeLinecap="round" />
      <path d="M 15 19.5 A 4.5 4.5 0 1 1 19.5 13" stroke="rgba(255,255,255,0.32)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="15" cy="15" r="1.4" fill="rgba(255,255,255,0.45)" />
    </motion.svg>
  );
}

/* ── Animated icon for running state ── */
function RunIcon({ kind }: { kind: "washer" | "dryer" }) {
  if (kind === "washer") return <WaterWhirl />;
  return (
    <motion.div
      animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.05, 0.95] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <Wind size={28} strokeWidth={1.5} className="text-white" />
    </motion.div>
  );
}

/* ── RUNNING card ── */
function RunningCard({ machine }: { machine: Machine }) {
  const { name, kind, tier, customerName, remainingMinutes, publicCode, startedAt } = machine;
  const maxSecs = (remainingMinutes ?? 0) * 60;
  const { display: timeDisplay, totalSecs } = useCountdown(startedAt, remainingMinutes ?? 0);
  const started = !!startedAt;
  const pct = started ? Math.min(100, Math.max(0, ((maxSecs - totalSecs) / maxSecs) * 100)) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(145deg, #006a7e 0%, #009eb5 55%, #00bcd4 100%)",
        boxShadow: "0 12px 32px -8px rgba(0,158,181,0.5), 0 2px 8px -2px rgba(0,0,0,0.15)",
      }}
    >
      {/* Noise texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          opacity: 0.6,
        }}
      />

      {/* Pulsing ring border */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.22)" }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[10px] font-bold text-white/50 tracking-widest uppercase">{publicCode}</span>
        {tier && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: tier === "titan" ? "rgba(255,214,0,0.22)" : "rgba(255,255,255,0.12)",
              color: tier === "titan" ? "#ffe87e" : "rgba(255,255,255,0.6)",
            }}
          >
            {tier}
          </span>
        )}
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
        {started ? (
          <>
            <div className="relative">
              <ProgressRing pct={pct} size={80} stroke={4} />
              <div className="absolute inset-0 flex items-center justify-center">
                <RunIcon kind={kind} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Clock size={11} className="text-white/50" strokeWidth={2} />
              <span className="text-white/70 text-[11px] font-bold tabular-nums tracking-wider">
                {timeDisplay}
              </span>
            </div>
          </>
        ) : (
          /* Pending physical activation */
          <div className="flex flex-col items-center gap-2">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <RunIcon kind={kind} />
            </motion.div>
            <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">
              Pending start
            </span>
          </div>
        )}
      </div>

      {/* Customer */}
      <div className="px-4 pb-4">
        <div className="h-px bg-white/10 mb-3" />
        <div className="text-[10px] text-white/45 font-medium uppercase tracking-wider mb-0.5">Customer</div>
        <div className="text-white text-sm font-semibold leading-tight truncate">{customerName ?? name}</div>
      </div>
    </motion.div>
  );
}

/* ── ONLINE (available) card ── */
function OnlineCard({ machine }: { machine: Machine }) {
  const { name, kind, tier, publicCode } = machine;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="rounded-2xl bg-white border border-zinc-100 flex flex-col overflow-hidden"
      style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">{publicCode}</span>
        {tier && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: tier === "titan" ? "#fefce8" : "#f4f4f5",
              color: tier === "titan" ? "#92400e" : "#71717a",
            }}
          >
            {tier}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center py-5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#e0f6fa" }}>
          {kind === "washer" ? (
            <WashingMachine size={28} strokeWidth={1.5} style={{ color: "#009eb5" }} />
          ) : (
            <Wind size={28} strokeWidth={1.5} style={{ color: "#009eb5" }} />
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="h-px bg-zinc-100 mb-3" />
        <div className="text-sm font-semibold text-zinc-800 leading-none truncate">{name}</div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-emerald-600 font-medium">Available</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── OFFLINE card ── */
function OfflineCard({ machine }: { machine: Machine }) {
  const { name, kind, tier, publicCode, lastSeenAt } = machine;
  const minutesAgo = lastSeenAt
    ? Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60000)
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[10px] font-bold text-zinc-300 tracking-widest uppercase">{publicCode}</span>
        {tier && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-400">
            {tier}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center py-5">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
          {kind === "washer" ? (
            <WashingMachine size={28} strokeWidth={1.5} className="text-zinc-300" />
          ) : (
            <Wind size={28} strokeWidth={1.5} className="text-zinc-300" />
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="h-px bg-zinc-200 mb-3" />
        <div className="text-sm font-semibold text-zinc-400 leading-none truncate">{name}</div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
          <span className="text-[11px] text-zinc-400 font-medium">
            Offline{minutesAgo !== null ? ` · ${minutesAgo}m ago` : ""}
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
  const el =
    machine.status === "running" ? (
      <RunningCard machine={machine} />
    ) : machine.status === "online" ? (
      <OnlineCard machine={machine} />
    ) : (
      <OfflineCard machine={machine} />
    );

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect?.(machine)}
      className="relative"
    >
      {el}

      {/* Tub cleaning due overlay */}
      {tubCleaningDue && (
        <>
          {/* Pulsing amber border ring */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "inset 0 0 0 2px #f59e0b" }}
          />
          {/* Badge */}
          <motion.button
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            onClick={(e) => {
              e.stopPropagation();
              onMarkCleaned?.(machine.id);
            }}
            title={onMarkCleaned ? "Tap to mark as cleaned" : undefined}
          >
            TUB CLEAN
          </motion.button>
        </>
      )}
    </motion.div>
  );
}
