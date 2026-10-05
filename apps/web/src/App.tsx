import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/layout/Sidebar";
import BottomNav, { type Section } from "./components/layout/BottomNav";
import Topbar from "./components/layout/Topbar";
import OverviewSection from "./components/overview/OverviewSection";
import MachineBoard from "./components/machines/MachineBoard";
import TransactionTable from "./components/transactions/TransactionTable";
import PackageBuilder from "./components/admin/PackageBuilder";
import ProductManager from "./components/admin/ProductManager";
import OrdersSection from "./components/orders/OrdersSection";
import { useRole } from "./hooks/useRole";
import type { Machine, Product } from "@tlp/shared";
import {
  mockMachines,
  mockJobOrders,
  mockSales,
  mockProducts,
  mockPackages,
} from "./lib/mockData";

const spring = { type: "spring" as const, stiffness: 320, damping: 30 };

export default function App() {
  const [section, setSection] = useState<Section>("overview");
  const { role, isAdmin, toggleRole } = useRole();
  const [machines, setMachines] = useState<Machine[]>(mockMachines);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [adminTab, setAdminTab] = useState<"programs" | "packages">("programs");

  const handleMarkCleaned = (machineId: string) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId ? { ...m, lastTubCleanCycle: m.cycleCount ?? 0 } : m
      )
    );
  };

  const handleSectionChange = (s: Section) => {
    if (s === "admin" && !isAdmin) return;
    setSection(s);
  };

  return (
    <div className="flex min-h-[100dvh] bg-[#f4f6f8]">
      <Sidebar
        active={section}
        isAdmin={isAdmin}
        role={role}
        onChangeSection={handleSectionChange}
        onToggleRole={toggleRole}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar section={section} isAdmin={isAdmin} />

        <main className="flex-1 px-4 md:px-6 py-5 pb-24 md:pb-6 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={spring}
            >
              {section === "overview" && (
                <OverviewSection
                  machines={machines}
                  orders={mockJobOrders}
                  sales={mockSales}
                  products={products}
                  packages={mockPackages}
                  isAdmin={isAdmin}
                />
              )}
              {section === "orders" && (
                <OrdersSection
                  orders={mockJobOrders}
                  products={products}
                  machines={machines}
                  isAdmin={isAdmin}
                />
              )}
              {section === "machines" && (
                <MachineBoard
                  machines={machines}
                  isAdmin={isAdmin}
                  onMarkCleaned={handleMarkCleaned}
                />
              )}
              {section === "transactions" && (
                <TransactionTable
                  sales={mockSales}
                  orders={mockJobOrders}
                  products={mockProducts}
                />
              )}
              {section === "admin" && isAdmin && (
                <div className="flex flex-col gap-5">
                  {/* Tab switcher */}
                  <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
                    {(["programs", "packages"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setAdminTab(tab)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                          adminTab === tab
                            ? "bg-white text-zinc-900 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-600"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {adminTab === "programs" && (
                    <ProductManager products={products} onChange={setProducts} />
                  )}
                  {adminTab === "packages" && (
                    <PackageBuilder products={products} packages={mockPackages} />
                  )}
                </div>
              )}
              {section === "admin" && !isAdmin && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="text-3xl mb-3">🔒</div>
                    <p className="text-sm font-medium text-zinc-500">Admin access required</p>
                    <p className="text-xs text-zinc-400 mt-1">Switch to Admin role in the sidebar</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <BottomNav
        active={section}
        isAdmin={isAdmin}
        onChange={handleSectionChange}
      />
    </div>
  );
}
