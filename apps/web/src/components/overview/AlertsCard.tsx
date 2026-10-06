import { useState } from "react";
import { AlertTriangle, Info, ChevronRight } from "lucide-react";
import type { Alert } from "@tlp/shared";

interface Props {
  alerts: Alert[];
  onSelect?: (alert: Alert) => void;
}

const COLLAPSED_COUNT = 3;

/** "Needs attention" list: tub cleans, loads waiting to start, orders waiting for a dryer, long-offline machines. */
export default function AlertsCard({ alerts, onSelect }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (alerts.length === 0) return null;

  const shown = showAll ? alerts : alerts.slice(0, COLLAPSED_COUNT);
  const warnCount = alerts.filter((a) => a.severity === "warn").length;

  return (
    <div
      className="bg-white rounded-2xl border border-zinc-100 overflow-hidden"
      style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Needs attention</div>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${warnCount ? "bg-amber-50 text-amber-600" : "bg-zinc-100 text-zinc-500"}`}
        >
          {alerts.length}
        </span>
      </div>

      <ul className="flex flex-col">
        {shown.map((a) => {
          const warn = a.severity === "warn";
          const Icon = warn ? AlertTriangle : Info;
          return (
            <li key={a.id} className="border-t border-zinc-50">
              <button
                onClick={() => onSelect?.(a)}
                className="w-full flex items-start gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-zinc-50/70 active:bg-zinc-50 transition-colors"
              >
                <span
                  className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${warn ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-400"}`}
                >
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-zinc-800 leading-snug">{a.title}</span>
                  <span className="block text-[12px] text-zinc-400 mt-0.5 leading-snug">{a.detail}</span>
                </span>
                {onSelect && <ChevronRight size={16} className="text-zinc-300 mt-1.5 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>

      {alerts.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full border-t border-zinc-50 py-3 text-[12px] font-semibold text-[#007a8c] hover:bg-zinc-50/70 transition-colors"
        >
          {showAll ? "Show fewer" : `Show all ${alerts.length}`}
        </button>
      )}
    </div>
  );
}
