import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  WashingMachine,
  Receipt,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import type { Section } from "./BottomNav";

interface NavItem {
  id: Section;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "orders", label: "Job Orders", Icon: ClipboardList },
  { id: "machines", label: "Machines", Icon: WashingMachine },
  { id: "transactions", label: "Transactions", Icon: Receipt },
  { id: "admin", label: "Admin", Icon: ShieldCheck, adminOnly: true },
];

interface Props {
  active: Section;
  isAdmin: boolean;
  role: "staff" | "admin";
  onChangeSection: (s: Section) => void;
  onToggleRole: () => void;
}

export default function Sidebar({ active, isAdmin, role, onChangeSection, onToggleRole }: Props) {
  const visible = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <aside
      className="hidden md:flex flex-col w-[220px] shrink-0 min-h-[100dvh] sticky top-0"
      style={{ background: "#0b3d47" }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#009eb5] flex items-center justify-center shrink-0">
            <WashingMachine size={16} strokeWidth={2} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-none tracking-tight">TLP POS</div>
            <div className="text-white/50 text-[11px] leading-tight mt-0.5">The Laundry Project</div>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/8 mx-5" />

      {/* Branch + gateway */}
      <div className="px-5 py-3">
        <div className="text-white/40 text-[10px] font-medium uppercase tracking-widest mb-1">Branch</div>
        <div className="text-white/80 text-xs font-medium">Katipunan Ave.</div>
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#009eb5]/20 px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#009eb5]" />
          <span className="text-[#7dd9e8] text-[10px] font-medium">Gateway live</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5">
        {visible.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <div key={id} className="relative">
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <button
                onClick={() => onChangeSection(id)}
                className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
              >
                <span className={isActive ? "text-white" : "text-white/45"}>
                  <Icon size={17} strokeWidth={isActive ? 2 : 1.8} />
                </span>
                <span
                  className={`text-sm font-medium tracking-tight flex-1 ${isActive ? "text-white" : "text-white/55"}`}
                >
                  {label}
                </span>
                {isActive && <ChevronRight size={12} className="text-white/40" />}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="h-px bg-white/8 mx-5" />

      {/* Role switcher */}
      <div className="p-4">
        <div className="text-white/35 text-[10px] uppercase tracking-widest mb-2">Operator Role</div>
        <button
          onClick={onToggleRole}
          className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: role === "admin" ? "#009eb5" : "#4a6d73" }}
            >
              {role === "admin" ? "A" : "S"}
            </div>
            <span className="text-white/70 text-xs font-medium capitalize">{role}</span>
          </div>
          <span className="text-white/30 text-[10px]">Switch</span>
        </button>
      </div>
    </aside>
  );
}
