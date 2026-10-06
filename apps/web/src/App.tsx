import { useState, useEffect, useRef } from "react";
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
import { authFetch } from "./lib/supabase";
import { useOrders } from "./hooks/useOrders";
import { usePackages } from "./hooks/usePackages";
import { useSettings } from "./hooks/useSettings";
import { useMachines } from "./hooks/useMachines";
import type { JobOrder } from "@tlp/shared";
import type { NewOrderPayload } from "./components/overview/JobOrderForm";
import {
  mockJobOrders,
  mockSales,
} from "./lib/mockData";

const spring = { type: "spring" as const, stiffness: 320, damping: 30 };

export default function App() {
  const [section, setSection] = useState<Section>("overview");
  const { role, isAdmin, signOut } = useRole();
  const { machines, refreshMachines, patchMachine } = useMachines();
  const { products, tubCleanThreshold, settingsError, setProducts, setTubCleanThreshold } = useSettings();
  const { packages, error: packagesError, createPackage, removePackage, movePackage } = usePackages();
  const [adminTab, setAdminTab] = useState<"programs" | "packages" | "machines">("programs");
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [draftThreshold, setDraftThreshold] = useState(String(tubCleanThreshold));
  useEffect(() => { setDraftThreshold(String(tubCleanThreshold)); }, [tubCleanThreshold]);
  const [confirmCleanId, setConfirmCleanId] = useState<string | null>(null);
  const { orders, updateOrder, addOrder } = useOrders("b1", mockJobOrders);

  // Server calls run one after another so e.g. "restart" (release, then assign) can't race itself.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(fn, fn);
    queue.current = run.catch(() => undefined);
    return run;
  };

  const [notice, setNotice] = useState<string | null>(null);
  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 5000);
  };

  const callApi = async (url: string, body: unknown) => {
    const res = await authFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data?.message ?? "Something went wrong. Try again.");
    return data;
  };

  const handleCreateOrder = async (payload: NewOrderPayload): Promise<JobOrder> => {
    try {
      const data = await callApi("/api/orders/create", payload);
      addOrder(data.jobOrder);
      return data.jobOrder as JobOrder;
    } catch (e) {
      throw e instanceof Error ? e : new Error("Couldn't save the order. Try again.");
    }
  };

  const handleVoidOrder = async (orderId: string) => {
    try {
      const data = await callApi("/api/orders/void", { orderId });
      updateOrder(data.jobOrder);
      await refreshMachines();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Couldn't void the order.");
      throw e;
    }
  };

  const handleAssign = (orderId: string, machineId: string, productId: string, lineId: string) =>
    enqueue(async () => {
      try {
        const durationMinutes = products.find((p) => p.id === productId)?.durationMinutes;
        const data = await callApi("/api/orders/assign", { orderId, machineId, productId, lineId, durationMinutes });
        if (data.jobOrder) updateOrder(data.jobOrder);
      } catch (e) {
        showNotice(e instanceof Error ? e.message : "Couldn't assign the machine.");
      }
      await refreshMachines();
    });

  const handleMarkCleaned = (machineId: string) => {
    patchMachine(machineId, { lastTubCleanCycle: machines.find((m) => m.id === machineId)?.cycleCount ?? 0 });
    return enqueue(async () => {
      try {
        await callApi("/api/machines/action", { machineId, action: "clean" });
      } catch (e) {
        showNotice(e instanceof Error ? e.message : "Couldn't save the tub clean.");
      }
      await refreshMachines();
    });
  };

  const handleStartMachine = (machineId: string) => {
    patchMachine(machineId, { startedAt: new Date().toISOString() });
    return enqueue(async () => {
      try {
        await callApi("/api/machines/action", { machineId, action: "start" });
      } catch (e) {
        showNotice(e instanceof Error ? e.message : "Couldn't start the timer.");
      }
      await refreshMachines();
    });
  };

  const handleUnassign = (orderId: string, lineId: string, machineId: string, reason?: string, mode?: "rework" | "reassign") =>
    enqueue(async () => {
      try {
        const data = await callApi("/api/orders/unassign", { orderId, lineId, machineId, reason, mode });
        if (data.jobOrder) updateOrder(data.jobOrder);
      } catch (e) {
        showNotice(e instanceof Error ? e.message : "Couldn't release the machine.");
      }
      await refreshMachines();
    });

  const handleSectionChange = (s: Section) => {
    if (s === "admin" && !isAdmin) return;
    setSection(s);
  };

  return (
    <div className="flex min-h-[100dvh] bg-[#f4f6f8]">
      {notice && (
        <div
          role="alert"
          className="fixed top-3 inset-x-4 sm:left-auto sm:right-4 sm:max-w-sm z-[70] rounded-2xl bg-red-600 text-white text-sm font-medium px-4 py-3 shadow-lg"
          onClick={() => setNotice(null)}
        >{notice}</div>
      )}
      <Sidebar
        active={section}
        isAdmin={isAdmin}
        role={role}
        onChangeSection={handleSectionChange}
        onToggleRole={signOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          section={section}
          isAdmin={isAdmin}
          onNewOrder={() => { setSection("orders"); setShowCreateOrder(true); }}
          onToggleRole={signOut}
          onSyncLaundrobot={isAdmin ? async () => {
            const res = await authFetch("/api/orders/pull", { method: "POST" });
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
                  threshold={tubCleanThreshold}
                />
              )}
              {section === "orders" && (
                <OrdersSection
                  orders={orders}
                  products={products}
                  packages={packages}
                  machines={machines}
                  isAdmin={isAdmin}
                  showCreate={showCreateOrder}
                  onCloseCreate={() => setShowCreateOrder(false)}
                  onCreateOrder={handleCreateOrder}
                  onVoidOrder={handleVoidOrder}
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
                  products={products}
                  onUnassign={handleUnassign}
                  onAssign={handleAssign}
                  onStartMachine={handleStartMachine}
                />
              )}
              {section === "transactions" && (
                <TransactionTable
                  sales={mockSales}
                  orders={mockJobOrders}
                  products={products}
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
                    <div className="flex flex-col gap-3">
                      {settingsError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{settingsError}</p>}
                      <ProductManager products={products} onChange={setProducts} />
                    </div>
                  )}
                  {adminTab === "packages" && (
                    <PackageBuilder products={products} packages={packages} error={packagesError} onCreate={createPackage} onRemove={removePackage} onMove={movePackage} />
                  )}
                  {adminTab === "machines" && (
                    <div className="flex flex-col gap-5">
                      {settingsError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{settingsError}</p>}

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

                      {/* Per-machine cycle counts — all machines */}
                      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}>
                        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
                          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Machine Cycle Counts</div>
                          <div className="hidden sm:flex items-center gap-6 text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                            <span className="w-20 text-right">Total</span>
                            <span className="w-28 text-right">Since Clean</span>
                            <span className="w-24" />
                          </div>
                        </div>
                        {machines.map((m) => {
                          const since = (m.cycleCount ?? 0) - (m.lastTubCleanCycle ?? 0);
                          const due = m.kind === "washer" && since >= tubCleanThreshold;
                          return (
                            <div key={m.id} className="flex items-center justify-between px-5 py-3 border-b border-zinc-50 last:border-0">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-lg tabular-nums">{m.publicCode}</span>
                                <span className="text-sm text-zinc-700">{m.name}</span>
                                {due && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Clean due</span>
                                )}
                              </div>
                              <div className="flex items-center gap-6">
                                <span className="text-sm font-bold tabular-nums text-zinc-500 w-20 text-right">
                                  {m.cycleCount ?? 0} <span className="text-[10px] font-normal text-zinc-300">total</span>
                                </span>
                                <span className={`text-sm font-bold tabular-nums w-28 text-right ${due ? "text-amber-600" : m.kind === "dryer" ? "text-zinc-200" : "text-zinc-400"}`}>
                                  {m.kind === "washer" ? <>{since} <span className="text-[10px] font-normal">since clean</span></> : <span className="text-[10px] font-normal text-zinc-300">—</span>}
                                </span>
                                {due && m.kind === "washer" && (
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
