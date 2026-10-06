import { motion, AnimatePresence } from "framer-motion";
import PesoBoxIcon from "./PesoBoxIcon";
import {
  LayoutDashboard,
  ClipboardList,
  WashingMachine,
  ShieldCheck,
} from "lucide-react";

export type Section = "overview" | "orders" | "machines" | "transactions" | "admin";

interface NavItem {
  id: Section;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "orders", label: "Orders", Icon: ClipboardList },
  { id: "machines", label: "Machines", Icon: WashingMachine },
  { id: "transactions", label: "Sales", Icon: PesoBoxIcon },
  { id: "admin", label: "Admin", Icon: ShieldCheck, adminOnly: true },
];

interface Props {
  active: Section;
  isAdmin: boolean;
  onChange: (s: Section) => void;
}

export default function BottomNav({ active, isAdmin, onChange }: Props) {
  const visible = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-t border-zinc-200/70"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {visible.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
            >
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-2 top-0 h-[2px] rounded-full bg-[#009eb5]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <motion.span
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className={isActive ? "text-[#009eb5]" : "text-zinc-400"}
              >
                <Icon size={20} />
              </motion.span>
              <span
                className={`text-[10px] font-medium tracking-tight leading-none ${isActive ? "text-[#009eb5]" : "text-zinc-400"}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { NAV_ITEMS };
