import { useEffect, useState } from "react";

interface Props {
  kg: number;
  onSave: (kg: number) => void;
}

/** Loads from LaundroBot at or above this weight are sent to the larger machines (W5 + D5). */
export default function LargeLoadCard({ kg, onSave }: Props) {
  const [text, setText] = useState(String(kg));
  useEffect(() => { setText(String(kg)); }, [kg]);
  const value = parseFloat(text);
  const valid = Number.isFinite(value) && value >= 1 && value <= 100;
  const changed = valid && value !== kg;

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 sm:p-5" style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}>
      <h2 className="text-sm font-semibold text-zinc-700 tracking-tight">Large loads</h2>
      <p className="text-[12px] text-zinc-400 mt-0.5 mb-3">
        A LaundroBot load at or above this weight is marked Large, and the washer and dryer suggestions use W5 + D5.
      </p>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Large from (kg)</label>
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
            className="w-28 h-10 px-3 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
          />
        </div>
        <button
          disabled={!changed}
          onClick={() => onSave(value)}
          className="h-10 px-5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 active:scale-[0.98] transition-all"
          style={{ background: "#009eb5" }}
        >Save</button>
      </div>
    </div>
  );
}
