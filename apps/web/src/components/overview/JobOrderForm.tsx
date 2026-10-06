import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, CreditCard, Banknote, Smartphone, Check } from "lucide-react";
import type { Product, ServicePackage, PaymentMethod } from "@tlp/shared";
import { formatPeso } from "../../lib/format";

interface ServiceSelection {
  productId: string;
  quantity: number;
}

interface Props {
  products: Product[];
  packages: ServicePackage[];
}

const PAYMENT_ICONS = {
  cash: Banknote,
  gcash: Smartphone,
  manual: CreditCard,
};

export default function JobOrderForm({ products, packages }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<ServiceSelection[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const washers = products.filter((p) => p.machineKind === "washer" && !p.isExtraTime);
  const dryers = products.filter((p) => p.machineKind === "dryer" && !p.isExtraTime);

  const toggleService = (productId: string) => {
    setSelections((prev) => {
      const exists = prev.find((s) => s.productId === productId);
      if (exists) return prev.filter((s) => s.productId !== productId);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  // A package counts as selected while the chosen services match it exactly.
  const isPackageActive = (pkg: ServicePackage) =>
    pkg.services.length > 0 &&
    selections.length === pkg.services.length &&
    pkg.services.every((id) => selections.some((s) => s.productId === id));

  const applyPackage = (pkg: ServicePackage) => {
    if (isPackageActive(pkg)) { setSelections([]); return; } // tap again to deselect
    setSelections(pkg.services.map((id) => ({ productId: id, quantity: 1 })));
  };

  const total = selections.reduce((sum, sel) => {
    const p = products.find((pr) => pr.id === sel.productId);
    return sum + (p ? p.priceCents * sel.quantity : 0);
  }, 0);

  const isSelected = (productId: string) => selections.some((s) => s.productId === productId);

  const canSubmit = customerName.trim() && selections.length > 0;

  return (
    <div className="flex flex-col gap-5 px-5 pt-4 pb-6">
      {/* Customer info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Customer name <span className="text-red-400">*</span>
          </label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Full name"
            className="w-full h-11 sm:h-9 px-3.5 sm:px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Contact
          </label>
          <input
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="+63 9XX XXX XXXX"
            className="w-full h-11 sm:h-9 px-3.5 sm:px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special instructions..."
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all resize-none"
        />
      </div>

      {/* Quick packages */}
      {packages.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Quick packages
          </label>
          <div className="flex flex-wrap gap-2">
            {packages.map((pkg) => {
              const active = isPackageActive(pkg);
              return (
                <button
                  key={pkg.id}
                  onClick={() => applyPackage(pkg)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 border text-xs font-medium active:scale-[0.97] transition-all text-left ${pkg.description ? "rounded-xl" : "rounded-full"} ${
                    active
                      ? "bg-[#007a8c] border-[#007a8c] text-white shadow-md"
                      : "border-[#009eb5]/30 text-[#007a8c] hover:bg-[#009eb5]/8"
                  }`}
                  style={active ? undefined : { background: "#e0f6fa" }}
                >
                  <div className="flex items-center gap-1.5">
                    {active && <Check size={12} strokeWidth={3} />}
                    {pkg.name}
                  </div>
                  {pkg.description && (
                    <div className={`text-[10px] font-normal leading-tight mt-0.5 ${active ? "text-white/80" : "text-[#009eb5]"}`}>{pkg.description}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Service selector */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Services
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[...washers, ...dryers].map((product) => {
            const selected = isSelected(product.id);
            return (
              <motion.button
                key={product.id}
                onClick={() => toggleService(product.id)}
                whileTap={{ scale: 0.97 }}
                className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                  selected
                    ? "border-[#009eb5] bg-[#e0f6fa]"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div
                  className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    selected ? "text-[#007a8c]" : "text-zinc-400"
                  }`}
                >
                  {product.machineKind}
                </div>
                <div className={`text-sm font-semibold leading-tight ${selected ? "text-[#007a8c]" : "text-zinc-700"}`}>
                  {product.name}
                </div>
                <div className={`text-xs mt-1.5 font-medium ${selected ? "text-[#009eb5]" : "text-zinc-400"}`}>
                  {formatPeso(product.priceCents)}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Checkout strip */}
      <AnimatePresence>
        {canSubmit && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="bg-zinc-900 rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <div className="text-white/50 text-[10px] font-medium uppercase tracking-wider">Total</div>
              <div className="text-white text-lg font-bold tracking-tight">{formatPeso(total)}</div>
            </div>
            <div className="flex items-center gap-2">
              {(["cash", "gcash", "manual"] as PaymentMethod[]).map((m) => {
                const Icon = PAYMENT_ICONS[m];
                return (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      paymentMethod === m ? "bg-white text-zinc-900" : "bg-white/10 text-white/50"
                    }`}
                  >
                    <Icon size={15} strokeWidth={2} />
                  </button>
                );
              })}
              <button
                className="flex-1 h-9 px-5 rounded-xl text-sm font-semibold text-zinc-900 bg-white active:scale-[0.97] transition-all ml-1"
                onClick={() => {
                  setCustomerName("");
                  setContactNumber("");
                  setNotes("");
                  setSelections([]);
                  setPaymentMethod("cash");
                }}
              >
                Checkout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
