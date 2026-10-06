import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Package, ChevronUp, ChevronDown, Pencil, Check } from "lucide-react";
import type { Product, ServicePackage } from "@tlp/shared";
import { formatPeso } from "../../lib/format";

interface Props {
  products: Product[];
  packages: ServicePackage[];
  error?: string | null;
  onCreate: (pkg: ServicePackage) => void;
  onUpdate: (pkg: ServicePackage) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}

export default function PackageBuilder({ products, packages, error, onCreate, onUpdate, onRemove, onMove }: Props) {
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgTitan, setPkgTitan] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string; titan: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const toCents = (text: string) => Math.max(0, Math.round((parseFloat(text) || 0) * 100));
  const cleanPrice = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  const toggle = (productId: string) => {
    setSelected((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const create = () => {
    if (!pkgName.trim() || selected.length === 0 || toCents(pkgPrice) <= 0) return;
    const newPkg: ServicePackage = {
      id: `pkg-${Date.now()}`,
      name: pkgName.trim(),
      description: pkgDesc.trim() || undefined,
      priceCents: toCents(pkgPrice),
      titanPriceCents: toCents(pkgTitan),
      services: selected,
      createdAt: new Date().toISOString(),
    };
    onCreate(newPkg);
    setPkgName("");
    setPkgDesc("");
    setPkgPrice("");
    setPkgTitan("");
    setSelected([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      {/* Builder form */}
      <div
        className="bg-white rounded-2xl border border-zinc-100 p-5"
        style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}
      >
        <h2 className="text-sm font-semibold text-zinc-700 tracking-tight mb-4">Build Package</h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Package name <span className="text-red-400">*</span>
            </label>
            <input
              value={pkgName}
              onChange={(e) => setPkgName(e.target.value)}
              placeholder="e.g. Wash & Dry Bundle"
              className="w-full h-9 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Sub description <span className="text-zinc-300 normal-case font-normal">(optional)</span>
            </label>
            <input
              value={pkgDesc}
              onChange={(e) => setPkgDesc(e.target.value)}
              maxLength={80}
              placeholder="e.g. 8kg wash + 30 min dry, folded"
              className="w-full h-9 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Package price (₱) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">₱</span>
              <input
                type="text"
                inputMode="decimal"
                value={pkgPrice}
                onChange={(e) => setPkgPrice(cleanPrice(e.target.value))}
                placeholder="e.g. 330"
                className="w-full h-9 pl-7 pr-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
              />
            </div>
            <p className="text-[11px] text-zinc-400">What the customer pays for the whole package, wash and dry together.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Large machines price (₱) <span className="text-zinc-300 normal-case font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">₱</span>
              <input
                type="text"
                inputMode="decimal"
                value={pkgTitan}
                onChange={(e) => setPkgTitan(cleanPrice(e.target.value))}
                placeholder="Leave blank if not offered"
                className="w-full h-9 pl-7 pr-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
              />
            </div>
            <p className="text-[11px] text-zinc-400">For the bigger titan washer and dryer (W5 + D5).</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Include services
            </label>
            <div className="grid grid-cols-2 gap-2">
              {products.filter((p) => !p.isExtraTime).map((product) => {
                const isChecked = selected.includes(product.id);
                return (
                  <label
                    key={product.id}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked ? "border-[#009eb5] bg-[#e0f6fa]" : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(product.id)}
                      className="mt-0.5 accent-[#009eb5]"
                    />
                    <div>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider ${isChecked ? "text-[#007a8c]" : "text-zinc-400"}`}>
                        {product.machineKind}
                      </div>
                      <div className={`text-sm font-medium ${isChecked ? "text-[#007a8c]" : "text-zinc-700"}`}>
                        {product.name}
                      </div>
                      <div className={`text-xs mt-0.5 ${isChecked ? "text-[#009eb5]" : "text-zinc-400"}`}>
                        {formatPeso(product.priceCents)}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={create}
            disabled={!pkgName.trim() || selected.length === 0 || toCents(pkgPrice) <= 0}
            className="flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#009eb5" }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Create Package
          </button>
        </div>
      </div>

      {/* Package list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700 tracking-tight">Saved Packages</h2>
          <span className="text-xs text-zinc-400">{packages.length} packages</span>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        {packages.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
            <div className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center mx-auto mb-3">
              <Package size={20} className="text-zinc-300" />
            </div>
            <p className="text-sm font-medium text-zinc-400">No packages yet</p>
            <p className="text-xs text-zinc-300 mt-1">Build your first service bundle</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {packages.map((pkg, index) => {
            return (
              <motion.div
                key={pkg.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5 flex items-start justify-between gap-3"
                style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-900">{pkg.name}</div>
                  {pkg.description && <div className="text-xs text-zinc-400 mt-0.5">{pkg.description}</div>}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {pkg.services.map((id) => {
                      const p = products.find((pr) => pr.id === id);
                      return p ? (
                        <span key={id} className="text-[10px] bg-zinc-50 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-100">
                          {p.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  {editing?.id === pkg.id ? (
                    <div className="flex flex-col gap-2 mt-2">
                      {([["Regular", "text"], ["Large", "titan"]] as const).map(([label, key]) => (
                        <label key={key} className="flex items-center gap-2">
                          <span className="w-14 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
                          <span className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">₱</span>
                            <input
                              autoFocus={key === "text"}
                              type="text"
                              inputMode="decimal"
                              value={editing[key]}
                              placeholder={key === "titan" ? "not offered" : ""}
                              onChange={(e) => setEditing({ ...editing, [key]: cleanPrice(e.target.value) })}
                              className="h-9 w-32 pl-6 pr-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5]"
                            />
                          </span>
                        </label>
                      ))}
                      <div className="flex items-center gap-2">
                        <button
                          disabled={toCents(editing.text) <= 0}
                          onClick={() => { onUpdate({ ...pkg, priceCents: toCents(editing.text), titanPriceCents: toCents(editing.titan) }); setEditing(null); }}
                          className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold text-white disabled:opacity-40"
                          style={{ background: "#009eb5" }}
                        ><Check size={14} strokeWidth={2.5} />Save prices</button>
                        <button onClick={() => setEditing(null)} className="h-9 px-2 text-xs font-semibold text-zinc-400 hover:text-zinc-600">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditing({ id: pkg.id, text: pkg.priceCents ? String(pkg.priceCents / 100) : "", titan: pkg.titanPriceCents ? String(pkg.titanPriceCents / 100) : "" })}
                      className={`mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 min-h-8 px-3 py-1 rounded-xl text-xs font-bold transition-colors text-left ${
                        pkg.priceCents ? "bg-[#e0f6fa] text-[#007a8c] hover:bg-[#cfeef5]" : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                      }`}
                      aria-label="Edit prices"
                    >
                      <span>{pkg.priceCents ? formatPeso(pkg.priceCents) : "Set price"}</span>
                      {!!pkg.titanPriceCents && <span className="font-semibold text-[#005f6e]/80">· Large {formatPeso(pkg.titanPriceCents)}</span>}
                      <Pencil size={11} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
                <div className="flex flex-col items-center shrink-0 -ml-1" aria-label="Change order">
                  <button
                    onClick={() => onMove(pkg.id, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-[#009eb5] hover:bg-zinc-50 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  ><ChevronUp size={16} strokeWidth={2.5} /></button>
                  <span className="text-[10px] font-bold text-zinc-300 tabular-nums leading-none">{index + 1}</span>
                  <button
                    onClick={() => onMove(pkg.id, 1)}
                    disabled={index === packages.length - 1}
                    aria-label="Move down"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-[#009eb5] hover:bg-zinc-50 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  ><ChevronDown size={16} strokeWidth={2.5} /></button>
                </div>
                <button
                  onClick={() => onRemove(pkg.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0 mt-0.5"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
