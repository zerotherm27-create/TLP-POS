import { RefreshCw, Trash2, Plus } from "lucide-react";
import type { Section } from "./BottomNav";

const SECTION_META: Record<Section, { title: string; subtitle: string }> = {
  overview:     { title: "Operations Desk", subtitle: "Live floor overview" },
  orders:       { title: "Job Orders", subtitle: "Create and manage customer orders" },
  machines:     { title: "Machines", subtitle: "Real-time machine status" },
  transactions: { title: "Transactions", subtitle: "Payment records for today" },
  admin:        { title: "Admin Panel", subtitle: "Package builder & configuration" },
};

interface Props {
  section: Section;
  isAdmin: boolean;
}

export default function Topbar({ section, isAdmin }: Props) {
  const { title, subtitle } = SECTION_META[section];

  return (
    <header className="flex items-center justify-between px-5 md:px-6 py-3.5 bg-white border-b border-zinc-100/80 sticky top-0 z-30">
      <div className="min-w-0">
        <h1 className="text-[15px] font-bold text-zinc-900 leading-none tracking-tight truncate">
          {title}
        </h1>
        <p className="text-[11px] text-zinc-400 mt-0.5 leading-none">{subtitle}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-4">
        {isAdmin && (
          <button className="h-8 flex items-center gap-1.5 px-3 text-[11px] font-semibold text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.97] transition-all">
            <RefreshCw size={12} strokeWidth={2.2} />
            <span className="hidden sm:inline">LaundroBot</span>
          </button>
        )}
        <button className="h-8 flex items-center gap-1.5 px-3 text-[11px] font-semibold text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.97] transition-all">
          <Trash2 size={12} strokeWidth={2.2} />
          <span className="hidden sm:inline">Void</span>
        </button>
        <button
          className="h-8 flex items-center gap-1.5 px-3.5 text-[11px] font-bold text-white rounded-xl active:scale-[0.97] transition-all"
          style={{
            background: "#009eb5",
            boxShadow: "0 2px 8px -2px rgba(0,158,181,0.45)",
          }}
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>Assign</span>
        </button>
      </div>
    </header>
  );
}
