import { useState } from "react";
import { RefreshCw, Plus, Check, AlertCircle, LogOut } from "lucide-react";
import type { Section } from "./BottomNav";

const SECTION_META: Record<Section, { title: string; subtitle: string }> = {
  overview:     { title: "Operations Desk", subtitle: "Live floor overview" },
  orders:       { title: "Job Orders", subtitle: "Create and manage customer orders" },
  machines:     { title: "Machines", subtitle: "Real-time machine status" },
  transactions: { title: "Transactions", subtitle: "Payment records for today" },
  admin:        { title: "Admin Panel", subtitle: "Package builder & configuration" },
};

type SyncState = "idle" | "loading" | "ok" | "error";

interface Props {
  section: Section;
  isAdmin: boolean;
  onNewOrder: () => void;
  onToggleRole: () => void;
  onSyncLaundrobot?: () => Promise<void>;
}

export default function Topbar({ section, isAdmin, onNewOrder, onToggleRole, onSyncLaundrobot }: Props) {
  const { title, subtitle } = SECTION_META[section];
  const [sync, setSync] = useState<SyncState>("idle");

  const handleSync = async () => {
    if (!onSyncLaundrobot || sync === "loading") return;
    setSync("loading");
    try {
      await onSyncLaundrobot();
      setSync("ok");
    } catch {
      setSync("error");
    } finally {
      setTimeout(() => setSync("idle"), 2500);
    }
  };

  const syncLabel = sync === "loading" ? "Syncing…" : sync === "ok" ? "Synced" : sync === "error" ? "Failed" : "LaundroBot";
  const SyncIcon = sync === "ok" ? Check : sync === "error" ? AlertCircle : RefreshCw;

  return (
    <header className="flex items-center justify-between px-5 md:px-6 py-3.5 bg-white border-b border-zinc-100/80 sticky top-0 z-30">
      <div className="min-w-0">
        <h1 className="text-[15px] font-bold text-zinc-900 leading-none tracking-tight truncate">
          {title}
        </h1>
        <p className="text-[11px] text-zinc-400 mt-0.5 leading-none">{subtitle}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-4">
        {/* Role + sign out — mobile only (desktop uses the sidebar) */}
        <button
          onClick={onToggleRole}
          aria-label="Sign out"
          className="md:hidden h-8 flex items-center gap-1.5 pl-1.5 pr-2.5 text-[11px] font-semibold border border-zinc-200 rounded-xl text-zinc-600 active:scale-[0.97] transition-all"
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: isAdmin ? "#009eb5" : "#4a6d73" }}
          >{isAdmin ? "A" : "S"}</span>
          {isAdmin ? "Admin" : "Staff"}
          <LogOut size={12} className="text-zinc-400" />
        </button>
        {isAdmin && onSyncLaundrobot && (
          <button
            onClick={handleSync}
            disabled={sync === "loading"}
            className={`h-8 flex items-center gap-1.5 px-3 text-[11px] font-semibold border rounded-xl active:scale-[0.97] transition-all disabled:opacity-60 ${
              sync === "ok"    ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
              sync === "error" ? "border-red-200 bg-red-50 text-red-600" :
                                 "border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
            }`}
          >
            <SyncIcon
              size={12}
              strokeWidth={2.2}
              className={sync === "loading" ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">{syncLabel}</span>
          </button>
        )}
        {section === "orders" && (
          <button
            onClick={onNewOrder}
            className="h-8 flex items-center gap-1.5 px-3.5 text-[11px] font-bold text-white rounded-xl active:scale-[0.97] transition-all"
            style={{
              background: "#009eb5",
              boxShadow: "0 2px 8px -2px rgba(0,158,181,0.45)",
            }}
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>New Job Order</span>
          </button>
        )}
      </div>
    </header>
  );
}
