import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Package } from "lucide-react";
import type { Product, ServicePackage } from "@tlp/shared";
import { formatPeso } from "../../lib/format";

interface Props {
  products: Product[];
  packages: ServicePackage[];
  error?: string | null;
  onCreate: (pkg: ServicePackage) => void;
  onRemove: (id: string) => void;
}

export default function PackageBuilder({ products, packages, error, onCreate, onRemove }: Props) {
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (productId: string) => {
    setSelected((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const create = () => {
    if (!pkgName.trim() || selected.length === 0) return;
    const newPkg: ServicePackage = {
      id: `pkg-${Date.now()}`,
      name: pkgName.trim(),
      description: pkgDesc.trim() || undefined,
      services: selected,
      createdAt: new Date().toISOString(),
    };
    onCreate(newPkg);
    setPkgName("");
    setPkgDesc("");
    setSelected([]);
  };

  const totalForPackage = (serviceIds: string[]) =>
    serviceIds.reduce((sum, id) => {
      const p = products.find((pr) => pr.id === id);
      return sum + (p ? p.priceCents : 0);
    }, 0);

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
            disabled={!pkgName.trim() || selected.length === 0}
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
          {packages.map((pkg) => {
            const total = totalForPackage(pkg.services);
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
                  <div className="text-xs font-semibold text-[#009eb5] mt-1.5">{formatPeso(total)}</div>
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
