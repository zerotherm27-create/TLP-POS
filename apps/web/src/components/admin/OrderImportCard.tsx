import type { OrderImportMode } from "../../hooks/useSettings";

interface Props {
  mode: OrderImportMode;
  onChange: (mode: OrderImportMode) => void;
}

const OPTIONS: { id: OrderImportMode; label: string; note: string }[] = [
  { id: "auto", label: "Automatic", note: "Every paid machine-wash order from LaundroBot arrives here by itself." },
  { id: "manual", label: "Manual", note: "Orders arrive only when someone presses Send to LaundroDesk in LaundroBot." },
  { id: "off", label: "Off", note: "No orders are accepted, not even from the Send button. Turn it on again, then send the missed orders from LaundroBot." },
];

/** How orders sent from LaundroBot are received. A refused order is not saved; LaundroBot's Send button can send it later. */
export default function OrderImportCard({ mode, onChange }: Props) {
  const current = OPTIONS.find((o) => o.id === mode) ?? OPTIONS[2];
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 sm:p-5" style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}>
      <h2 className="text-sm font-semibold text-zinc-700 tracking-tight">Orders from LaundroBot</h2>
      <p className="text-[12px] text-zinc-400 mt-0.5 mb-3">{current.note}</p>
      <div role="radiogroup" aria-label="How orders from LaundroBot are received" className="inline-flex p-1 rounded-xl bg-zinc-100 gap-1">
        {OPTIONS.map((o) => {
          const on = o.id === mode;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => !on && onChange(o.id)}
              className="h-9 px-4 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: on ? (o.id === "off" ? "#71717a" : "#009eb5") : "transparent",
                color: on ? "#fff" : "#52525b",
                boxShadow: on ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
