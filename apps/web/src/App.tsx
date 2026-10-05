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
import { useOrders } from "./hooks/useOrders";
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
  const [packages, setPackages] = useState(mockPackages);
  const [adminTab, setAdminTab] = useState<"programs" | "packages" | "machines">("programs");
  const [tubCleanThreshold, setTubCleanThreshold] = useState(50);
  const [draftThreshold, setDraftThreshold] = useState("50");
  const [confirmCleanId, setConfirmCleanId] = useState<string | null>(null);
  const { orders, updateOrder } = useOrders("b1", mockJobOrders);

  const handleAssign = async (orderId: string, machineId: string, productId: string, lineId: string) => {
    try {
      const res = await fetch("/api/orders/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, machineId, productId, lineId }),
      });
      const data = await res.json();
      if (data.ok && data.jobOrder) {
        updateOrder(data.jobOrder);
      }
    } catch {
      // API unavailable — update locally only
    }
    // Optimistic local update for machines
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? { ...m, status: "running", activeJobOrderId: orderId }
          : m
      )
    );
    // Optimistic local update for orders (for when API is unavailable)
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      const newAssignment = { lineId, machineId, productId, assignedAt: new Date().toISOString() };
      const allAssigned = [...order.assignments, newAssignment];
      const lastProduct = mockProducts.find((p) => p.id === productId);
      updateOrder({
        ...order,
        status: "in_progress",
        fulfillmentStage: lastProduct?.machineKind === "dryer" ? "drying" : "washing",
        assignments: allAssigned,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleMarkCleaned = (machineId: string) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId ? { ...m, lastTubCleanCycle: m.cycleCount ?? 0 } : m
      )
    );
  };

  const handleStartMachine = (machineId: string) => {
    setMachines((prev) =>
      prev.map((m) => m.id === machineId ? { ...m, startedAt: new Date().toISOString() } : m)
    );
  };

  const handleUnassign = (orderId: string, lineId: string, machineId: string, reason?: string, mode?: "rework" | "reassign") => {
    if (reason && mode) {
      console.log(`[${new Date().toISOString()}] ${mode.toUpperCase()} — order ${orderId}, machine ${machineId}. Reason: ${reason}`);
    }
    setMachines((prev) =>
      prev.map((m) => m.id === machineId ? { ...m, status: "online" as const, activeJobOrderId: undefined } : m)
    );
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      const remaining = order.assignments.filter((a: { lineId: string }) => a.lineId !== lineId);
      updateOrder({
        ...order,
        assignments: remaining,
        status: remaining.length === 0 ? "queued" : "in_progress",
        fulfillmentStage: remaining.length === 0 ? "queued" : order.fulfillmentStage,
        updatedAt: new Date().toISOString(),
      });
    }
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
        <Topbar
          section={section}
          isAdmin={isAdmin}
          onNewOrder={() => setSection("orders")}
          onSyncLaundrobot={isAdmin ? async () => {
            const res = await fetch("/api/orders/pull", { method: "POST" });
            if (!res.ok) throw new Error(`sync failed: ${res.status}`);
          } : undefined}
        />

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
                  orders={orders}
                  sales={mockSales}
                  products={products}
                  packages={packages}
                  isAdmin={isAdmin}
                />
              )}
              {section === "orders" && (
                <OrdersSection
                  orders={orders}
                  products={products}
                  machines={machines}
                  isAdmin={isAdmin}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                />
              )}
              {section === "machines" && (
                <MachineBoard
                  machines={machines}
                  isAdmin={isAdmin}
                  threshold={tubCleanThreshold}
                  onMarkCleaned={handleMarkCleaned}
                  orders={orders}
                  onUnassign={handleUnassign}
                  onAssign={handleAssign}
                  onStartMachine={handleStartMachine}
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
                    {(["programs", "packages", "machines"] as const).map((tab) => (
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
                    <PackageBuilder products={products} packages={packages} onChange={setPackages} />
                  )}
                  {adminTab === "machines" && (
                    <div className="flex flex-col gap-5">
                      {/* Tub cleaning threshold */}
                      <div className="bg-amber-50 border border-amber-200/70 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Tub Cleaning Reminder</div>
                          <div className="text-[12px] text-amber-600">
                            Alert after every <strong>{tubCleanThreshold}</strong> loads per washer.
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-[11px] text-amber-700 font-semibold">Every</label>
                          <input
                            type="number" min={1} max={500}
                            value={draftThreshold}
                            onChange={(e) => setDraftThreshold(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const n = parseInt(draftThreshold, 10);
                                if (!isNaN(n) && n > 0) setTubCleanThreshold(n);
                              }
                            }}
                            className="w-16 h-8 rounded-xl border border-amber-300 bg-white text-center text-sm font-bold text-amber-800 outline-none focus:ring-2 focus:ring-amber-400/50 tabular-nums"
                          />
                          <label className="text-[11px] text-amber-700 font-semibold">loads</label>
                          <button
                            onClick={() => { const n = parseInt(draftThreshold, 10); if (!isNaN(n) && n > 0) setTubCleanThreshold(n); }}
                            className="h-8 px-3 text-[11px] font-bold text-white rounded-xl"
                            style={{ background: "#d97706" }}
                          >Save</button>
                        </div>
                      </div>

                      {/* Per-machine cycle counts */}
                      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}>
                        <div className="px-5 py-3 border-b border-zinc-100">
                          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Washer Cycle Counts</div>
                        </div>
                        {machines.filter((m) => m.kind === "washer").map((m) => {
                          const since = (m.cycleCount ?? 0) - (m.lastTubCleanCycle ?? 0);
                          const due = since >= tubCleanThreshold;
                          return (
                            <div key={m.id} className="flex items-center justify-between px-5 py-3 border-b border-zinc-50 last:border-0">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-lg tabular-nums">{m.publicCode}</span>
                                <span className="text-sm text-zinc-700">{m.name}</span>
                                {due && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Clean due</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold tabular-nums ${due ? "text-amber-600" : "text-zinc-400"}`}>
                                  {since} <span className="text-[10px] font-normal">loads since clean</span>
                                </span>
                                {due && (
                                  confirmCleanId === m.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-amber-700 font-semibold">Tub clean done?</span>
                                      <button
                                        onClick={() => { handleMarkCleaned(m.id); setConfirmCleanId(null); }}
                                        className="h-7 px-3 text-[11px] font-bold text-white rounded-xl"
                                        style={{ background: "#009eb5" }}
                                      >Yes</button>
                                      <button
                                        onClick={() => setConfirmCleanId(null)}
                                        className="h-7 px-3 text-[11px] font-semibold text-zinc-500 bg-zinc-100 rounded-xl"
                                      >No</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmCleanId(m.id)}
                                      className="h-7 px-3 text-[11px] font-semibold text-white rounded-xl"
                                      style={{ background: "#009eb5" }}
                                    >Mark Cleaned</button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
