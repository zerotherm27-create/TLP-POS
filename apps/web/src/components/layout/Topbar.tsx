import { Plus, LogOut, CircleHelp } from "lucide-react";
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
  onNewOrder: () => void;
  onToggleRole: () => void;
  onShowGuide?: () => void;
}

export default function Topbar({ section, isAdmin, onNewOrder, onToggleRole, onShowGuide }: Props) {
  const { title, subtitle } = SECTION_META[section];

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3.5 bg-white border-b border-zinc-100/80 sticky top-0 z-30">
      <div className="min-w-0 mr-auto">
        {/* Phones have no sidebar, so the brand logo lives here */}
        <img src="/tlp-logo.png" alt="The Laundry Project" className="md:hidden h-6 w-auto mb-1.5" />
        <h1 className="text-[15px] font-bold text-zinc-900 leading-none tracking-tight truncate">
          {title}
        </h1>
        <p className="hidden sm:block text-[11px] text-zinc-400 mt-0.5 leading-none">{subtitle}</p>
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
          <span className="hidden min-[430px]:inline">{isAdmin ? "Admin" : "Staff"}</span>
          <LogOut size={12} className="text-zinc-400" />
        </button>
        {onShowGuide && (
          <button
            onClick={onShowGuide}
            aria-label="Show the welcome guide"
            title="Welcome guide"
            className="h-8 w-8 flex items-center justify-center border border-zinc-200 rounded-xl text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.97] transition-all"
          >
            <CircleHelp size={14} strokeWidth={2} />
          </button>
        )}
        {section === "orders" && isAdmin && (
          <button
            onClick={onNewOrder}
            className="h-8 flex items-center gap-1.5 px-3.5 text-[11px] font-bold text-white rounded-xl active:scale-[0.97] transition-all"
            style={{
              background: "#009eb5",
              boxShadow: "0 2px 8px -2px rgba(0,158,181,0.45)",
            }}
          >
            <Plus size={13} strokeWidth={2.5} />
            <span className="hidden min-[430px]:inline">New Job Order</span>
            <span className="min-[430px]:hidden">New</span>
          </button>
        )}
      </div>
    </header>
  );
}
