import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, WashingMachine, Wind, Check, X } from "lucide-react";
import type { Product, MachineKind } from "@tlp/shared";
import { formatPeso } from "../../lib/format";

interface Props {
  products: Product[];
  onChange: (products: Product[]) => void;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  machineKind: "washer" as MachineKind,
  durationMinutes: 35,
  pulse: 1,
  pushDelayMs: 500,
  isExtraTime: false,
};

export default function ProductManager({ products, onChange }: Props) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [priceText, setPriceText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const washers = products.filter((p) => p.machineKind === "washer");
  const dryers = products.filter((p) => p.machineKind === "dryer");

  const priceCents = Math.max(0, Math.round((parseFloat(priceText) || 0) * 100));

  const resetForm = () => {
    setPriceText("");
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  };

  const save = () => {
    if (!form.name.trim() || form.durationMinutes < 1) return;
    if (editingId) {
      onChange(products.map((p) => p.id === editingId ? { ...p, ...form, priceCents } : p));
      resetForm();
    } else {
      const newProduct: Product = {
        id: `p-${Date.now()}`,
        ...form,
        priceCents,
      };
      onChange([...products, newProduct]);
      resetForm();
    }
  };

  const startEdit = (p: Product) => {
    setPriceText(p.priceCents ? String(p.priceCents / 100) : "");
    setForm({
      name: p.name,
      description: p.description ?? "",
      machineKind: p.machineKind,
      durationMinutes: p.durationMinutes,
      pulse: p.pulse,
      pushDelayMs: p.pushDelayMs,
      isExtraTime: p.isExtraTime ?? false,
    });
    setEditingId(p.id);
    setConfirmDelete(null);
  };

  const remove = (id: string) => {
    onChange(products.filter((p) => p.id !== id));
    setConfirmDelete(null);
    if (editingId === id) resetForm();
  };

  const inputClass =
    "h-9 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all w-full";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      {/* ── Form ── */}
      <div
        className="bg-white rounded-2xl border border-zinc-100 p-5 h-fit"
        style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}
      >
        <h2 className="text-sm font-semibold text-zinc-700 tracking-tight mb-4">
          {editingId ? "Edit Program" : "Add Program"}
        </h2>

        <div className="flex flex-col gap-4">
          {/* Machine kind toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Machine type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["washer", "dryer"] as MachineKind[]).map((kind) => {
                const active = form.machineKind === kind;
                return (
                  <button
                    key={kind}
                    onClick={() => setForm((f) => ({ ...f, machineKind: kind }))}
                    className={`flex items-center justify-center gap-2 h-9 rounded-xl border text-sm font-medium transition-all ${
                      active
                        ? "border-[#009eb5] bg-[#e0f6fa] text-[#007a8c]"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {kind === "washer" ? <WashingMachine size={14} strokeWidth={1.8} /> : <Wind size={14} strokeWidth={1.8} />}
                    {kind.charAt(0).toUpperCase() + kind.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Program name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 35 min"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Standard wash cycle"
              className={inputClass}
            />
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Duration (minutes) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={999}
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) || 0 }))}
              className={inputClass}
            />
          </div>

          {/* Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Price (₱)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">₱</span>
              <input
                type="text"
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                placeholder="0.00"
                className={`${inputClass} pl-7`}
              />
            </div>
          </div>

          {/* Pulse + Delay row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Pulses</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.pulse}
                onChange={(e) => setForm((f) => ({ ...f, pulse: parseInt(e.target.value) || 1 }))}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Delay (ms)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={form.pushDelayMs}
                onChange={(e) => setForm((f) => ({ ...f, pushDelayMs: parseInt(e.target.value) || 0 }))}
                className={inputClass}
              />
            </div>
          </div>

          {/* Extra time toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm((f) => ({ ...f, isExtraTime: !f.isExtraTime }))}
              className={`w-9 h-5 rounded-full transition-colors relative ${form.isExtraTime ? "bg-[#009eb5]" : "bg-zinc-200"}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isExtraTime ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Extra time / add-on
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!form.name.trim() || form.durationMinutes < 1}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#009eb5" }}
            >
              {editingId ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
              {editingId ? "Save changes" : "Add program"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="h-10 px-3 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Program list ── */}
      <div className="flex flex-col gap-5">
        {[
          { label: "Washers", list: washers, icon: WashingMachine },
          { label: "Dryers", list: dryers, icon: Wind },
        ].map(({ label, list, icon: Icon }) => (
          <div key={label}>
            <div className="flex items-center gap-3 mb-3">
              <Icon size={13} className="text-zinc-400" strokeWidth={1.8} />
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
              <span className="text-[11px] font-semibold text-zinc-300">{list.length}</span>
              <div className="flex-1 h-px bg-zinc-100" />
            </div>

            {list.length === 0 && (
              <p className="text-xs text-zinc-300 px-1">No {label.toLowerCase()} programs yet</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence initial={false}>
                {list.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      className={`bg-white rounded-2xl border px-4 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isEditing ? "border-[#009eb5]" : "border-zinc-100"
                      }`}
                      style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-zinc-900">{p.name}</div>
                          {p.isExtraTime && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                              Add-on
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{p.description}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] font-semibold text-[#007a8c]">{formatPeso(p.priceCents)}</span>
                          <span className="text-zinc-200">·</span>
                          <span className="text-[11px] text-zinc-400">{p.durationMinutes} min</span>
                          <span className="text-zinc-200">·</span>
                          <span className="text-[11px] text-zinc-400">{p.pulse} pulse{p.pulse !== 1 ? "s" : ""}</span>
                          <span className="text-zinc-200">·</span>
                          <span className="text-[11px] text-zinc-400">{p.pushDelayMs}ms</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(p)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-[#009eb5] hover:bg-[#e0f6fa] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        {confirmDelete === p.id ? (
                          <>
                            <button
                              onClick={() => remove(p.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-red-400 hover:bg-red-500 transition-colors"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-zinc-500 transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(p.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
