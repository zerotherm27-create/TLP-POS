import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";

// PIN is checked client-side for UX gating only — not a security boundary.
// Change this to match your store's admin PIN.
const ADMIN_PIN = "1234";

interface Props {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AdminPinModal({ open, onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setPin(""); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open]);

  const submit = () => {
    if (pin === ADMIN_PIN) {
      onSuccess();
      setPin("");
    } else {
      setShake(true);
      setPin("");
      setTimeout(() => { setShake(false); inputRef.current?.focus(); }, 500);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") onCancel();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="pin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            key="pin-modal"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="pointer-events-auto bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#e0f6fa" }}>
                    <ShieldCheck size={16} style={{ color: "#009eb5" }} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900">Admin access</div>
                    <div className="text-[11px] text-zinc-400">Enter PIN to continue</div>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* PIN dots */}
              <div className="flex justify-center gap-3 mb-5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full transition-all duration-150"
                    style={{
                      background: pin.length > i ? "#009eb5" : "#e4e4e7",
                      transform: pin.length > i ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </div>

              {/* Hidden input */}
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(v);
                  if (v.length === 4) setTimeout(() => {
                    if (v === ADMIN_PIN) { onSuccess(); setPin(""); }
                    else { setShake(true); setPin(""); setTimeout(() => { setShake(false); inputRef.current?.focus(); }, 500); }
                  }, 80);
                }}
                onKeyDown={handleKey}
                className="opacity-0 absolute pointer-events-none"
                aria-label="Admin PIN"
              />

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
                  <button
                    key={i}
                    disabled={k === ""}
                    onClick={() => {
                      if (k === "⌫") { setPin((p) => p.slice(0, -1)); return; }
                      if (k === "") return;
                      const next = (pin + k).slice(0, 4);
                      setPin(next);
                      if (next.length === 4) setTimeout(() => {
                        if (next === ADMIN_PIN) { onSuccess(); setPin(""); }
                        else { setShake(true); setPin(""); setTimeout(() => setShake(false), 500); }
                      }, 80);
                    }}
                    className={`h-12 rounded-2xl text-sm font-semibold transition-all active:scale-[0.93] ${
                      k === "" ? "invisible" :
                      k === "⌫" ? "text-zinc-400 bg-zinc-50 hover:bg-zinc-100" :
                      "text-zinc-800 bg-zinc-50 hover:bg-zinc-100"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
