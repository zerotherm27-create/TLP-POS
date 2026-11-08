interface Props {
  enabled: boolean;
  onChange: (on: boolean) => void;
}

/** On/off switch for orders sent from LaundroBot. While Off, LaundroBot's "Send to LaundroDesk" is refused and can be retried later. */
export default function OrderImportCard({ enabled, onChange }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 sm:p-5" style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 tracking-tight">Orders from LaundroBot</h2>
          <p className="text-[12px] text-zinc-400 mt-0.5">
            {enabled
              ? "On. Paid machine-wash orders arrive here automatically."
              : "Off. New orders are not accepted. In LaundroBot, use Send to LaundroDesk once this is back On."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Accept orders from LaundroBot"
          onClick={() => onChange(!enabled)}
          className="relative h-7 w-12 shrink-0 rounded-full transition-colors active:scale-[0.97]"
          style={{ background: enabled ? "#009eb5" : "#d4d4d8" }}
        >
          <span
            className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform"
            style={{ transform: enabled ? "translateX(20px)" : "translateX(0)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
          />
        </button>
      </div>
    </div>
  );
}
