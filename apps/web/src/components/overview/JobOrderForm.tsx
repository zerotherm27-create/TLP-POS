import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, CreditCard, Banknote, Smartphone, Check } from "lucide-react";
import type { Product, ServicePackage, PaymentMethod, ExtraRates } from "@tlp/shared";
import { resolveWash, EXTRA_WASH_STEPS, extraChargeCents, packagePriceFor, NO_EXTRA_RATES } from "@tlp/shared";
import { formatPeso } from "../../lib/format";

interface ServiceSelection {
  productId: string;
  quantity: number;
  /** Extra wash minutes (10/20/30). Merged into the matching program before any machine is assigned. */
  extraMinutes?: number;
}

export interface NewOrderPayload {
  customerName: string;
  contactNumber: string;
  notes: string;
  services: ServiceSelection[];
  paymentMethod: PaymentMethod;
  /** Sold as a package: the package price is what the customer pays. */
  packageId?: string;
  /** Machine size: "titan" = the larger W5 + D5 pair (own price). Absent = regular machines. */
  tier?: "titan";
  /** Extra wash minutes per program, e.g. { "p2": 10 }. */
  extras?: Record<string, number>;
}

interface Props {
  products: Product[];
  packages: ServicePackage[];
  extraRates?: ExtraRates;
  /** Saves the order. Resolves when it is stored; rejects with a message if it fails. */
  onCheckout?: (payload: NewOrderPayload) => Promise<void>;
}

const PAYMENT_ICONS = {
  cash: Banknote,
  gcash: Smartphone,
  manual: CreditCard,
};

export default function JobOrderForm({ products, packages, extraRates = NO_EXTRA_RATES, onCheckout }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<ServiceSelection[]>([]);
  const [pkgId, setPkgId] = useState<string | null>(null);
  const [tier, setTier] = useState<"giant" | "titan">("giant");
  const [showCustom, setShowCustom] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async () => {
    if (saving || !onCheckout) return;
    setSaving(true);
    setError(null);
    try {
      await onCheckout({ customerName: customerName.trim(), contactNumber: contactNumber.trim(), notes: notes.trim(), services: selections, paymentMethod, ...(tier === "titan" ? { tier: "titan" as const } : {}), ...(pkgId ? { packageId: pkgId, extras: Object.fromEntries(selections.filter((x) => (x.extraMinutes ?? 0) > 0).map((x) => [x.productId, x.extraMinutes as number])) } : {}) });
      setCustomerName("");
      setContactNumber("");
      setNotes("");
      setSelections([]);
      setPkgId(null);
      setTier("giant");
      setShowCustom(false);
      setPaymentMethod("cash");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the order. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const washers = products.filter((p) => p.machineKind === "washer" && !p.isExtraTime);
  const dryers = products.filter((p) => p.machineKind === "dryer" && !p.isExtraTime);

  const toggleService = (productId: string) => {
    setPkgId(null); // picking single programs makes it a custom order
    setSelections((prev) => {
      const exists = prev.find((s) => s.productId === productId);
      if (exists) return prev.filter((s) => s.productId !== productId);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const selectedPkg = packages.find((p) => p.id === pkgId) ?? null;

  const applyPackage = (pkg: ServicePackage) => {
    if (pkgId === pkg.id) { setPkgId(null); setSelections([]); return; } // tap again to deselect
    if (!packagePriceFor(pkg, tier)) return; // can't sell a package that has no price for this size
    setPkgId(pkg.id);
    setSelections(pkg.services.map((id) => ({ productId: id, quantity: 1 })));
  };

  // Switching machine size: a package with no price for the new size is dropped.
  const changeTier = (next: "giant" | "titan") => {
    setTier(next);
    if (selectedPkg && !packagePriceFor(selectedPkg, next)) { setPkgId(null); setSelections([]); }
  };
  const offersLarge = packages.some((p) => (p.titanPriceCents ?? 0) > 0);

  const setExtra = (productId: string, extraMinutes: number) =>
    setSelections((prev) => prev.map((sel) => (sel.productId === productId ? { ...sel, extraMinutes } : sel)));

  // Package orders cost the package price plus any extra wash minutes; custom orders add up the programs.
  const total = selectedPkg
    ? packagePriceFor(selectedPkg, tier) +
      selections.reduce((sum, sel) => {
        const extra = sel.extraMinutes ?? 0;
        const r = resolveWash(products, sel.productId, extra);
        return sum + (extra > 0 && (r.merged || r.lines.length > 1) ? extraChargeCents(extraRates, "washer", extra, tier) : 0);
      }, 0)
    : selections.reduce((sum, sel) => {
        const resolved = resolveWash(products, sel.productId, sel.extraMinutes ?? 0);
        return sum + resolved.lines.reduce((t, p) => t + p.priceCents, 0) * sel.quantity;
      }, 0);

  const washSelections = selections
    .map((sel) => ({ sel, product: products.find((p) => p.id === sel.productId) }))
    .filter((x): x is { sel: ServiceSelection; product: Product } => !!x.product && x.product.machineKind === "washer" && !x.product.isExtraTime);

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

      {/* Machine size: the larger titan pair (W5 + D5) has its own price */}
      {offersLarge && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Machine size</label>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-zinc-100">
            {([["giant", "Regular"], ["titan", "Large (W5 + D5)"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => changeTier(key)}
                aria-pressed={tier === key}
                className={`h-11 rounded-xl text-sm font-semibold transition-all ${tier === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Packages: everything is sold as a package */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Package</label>
        {packages.length === 0 ? (
          <p className="text-sm text-zinc-400 bg-zinc-50 rounded-xl px-3.5 py-3">No packages yet. An admin can create them in Admin → Packages.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {packages.map((pkg) => {
              const active = pkgId === pkg.id;
              const price = packagePriceFor(pkg, tier);
              const noPrice = !price;
              return (
                <button
                  key={pkg.id}
                  onClick={() => applyPackage(pkg)}
                  disabled={noPrice}
                  aria-pressed={active}
                  className={`flex items-start justify-between gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                    active
                      ? "bg-[#007a8c] border-[#007a8c] text-white shadow-md"
                      : noPrice
                        ? "bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed"
                        : "bg-[#e0f6fa] border-[#9fd2df] text-[#005f6e] hover:border-[#009eb5]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-bold leading-tight">
                      {active && <Check size={14} strokeWidth={3} />}
                      {pkg.name}
                    </span>
                    {pkg.description && (
                      <span className={`block text-[11px] font-normal leading-snug mt-1 ${active ? "text-white/80" : noPrice ? "text-zinc-400" : "text-[#007a8c]"}`}>{pkg.description}</span>
                    )}
                    {noPrice && <span className="block text-[11px] font-semibold text-amber-600 mt-1">{tier === "titan" ? "Not offered for large machines" : "No price set — add it in Admin → Packages"}</span>}
                  </span>
                  {!noPrice && <span className="text-base font-bold tabular-nums shrink-0">{formatPeso(price)}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Single programs (not how you normally sell) */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowCustom((v) => !v)}
          className="self-start text-[12px] font-semibold text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          {showCustom ? "Hide custom order" : "Custom order (single programs)…"}
        </button>
        {showCustom && <div className="grid grid-cols-2 gap-2">
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
        </div>}
      </div>

      {/* Extra wash: chosen now, so the washer is started with the combined program */}
      {washSelections.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Extra wash (optional)</label>
          {washSelections.map(({ sel, product }) => {
            const extra = sel.extraMinutes ?? 0;
            const resolved = resolveWash(products, product.id, extra);
            return (
              <div key={product.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3 flex flex-col gap-2">
                <div className="text-sm font-semibold text-zinc-700">{product.name} wash</div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, ...EXTRA_WASH_STEPS].map((m) => (
                    <button
                      key={m}
                      onClick={() => setExtra(product.id, m)}
                      className={`h-9 px-4 rounded-xl border text-[12px] font-semibold transition-colors ${
                        extra === m ? "border-[#007a8c] bg-[#007a8c] text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-[#009eb5]"
                      }`}
                    >
                      {m === 0 ? "None" : `+${m} min`}
                    </button>
                  ))}
                </div>
                {extra > 0 && resolved.merged && (
                  <p className="text-[11px] text-[#007a8c]">Runs as the <strong>{resolved.lines[0].name}</strong> wash program ({product.name} + {extra} min).</p>
                )}
                {extra > 0 && !resolved.merged && resolved.notice && <p className="text-[11px] text-amber-600">{resolved.notice}</p>}
                {extra > 0 && (resolved.merged || resolved.lines.length > 1) && (
                  extraChargeCents(extraRates, "washer", 10, tier) > 0
                    ? <p className="text-[11px] text-zinc-500">Extra wash: <strong>{formatPeso(extraChargeCents(extraRates, "washer", extra, tier))}</strong> added to the total.</p>
                    : pkgId && <p className="text-[11px] text-amber-600">No extra wash price is set yet, so nothing is added. Set it in Admin → Packages.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

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
                className="flex-1 h-9 px-5 rounded-xl text-sm font-semibold text-zinc-900 bg-white active:scale-[0.97] transition-all ml-1 disabled:opacity-60"
                onClick={checkout}
                disabled={saving}
              >
                {saving ? "Saving…" : "Checkout"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
