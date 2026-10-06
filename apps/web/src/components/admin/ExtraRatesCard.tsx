import { useEffect, useState } from "react";
import type { ExtraRates } from "@tlp/shared";
import { formatPeso } from "../../lib/format";

interface Props {
  rates: ExtraRates;
  onSave: (rates: ExtraRates) => void;
}

const toCents = (text: string) => Math.max(0, Math.round((parseFloat(text) || 0) * 100));
const clean = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
const asText = (cents: number) => (cents ? String(cents / 100) : "");

/** Flat price of each extra 10 minutes of wash or dry, added on top of a package price. */
export default function ExtraRatesCard({ rates, onSave }: Props) {
  const [wash, setWash] = useState(asText(rates.washCentsPer10));
  const [dry, setDry] = useState(asText(rates.dryCentsPer10));
  useEffect(() => { setWash(asText(rates.washCentsPer10)); setDry(asText(rates.dryCentsPer10)); }, [rates.washCentsPer10, rates.dryCentsPer10]);

  const changed = toCents(wash) !== rates.washCentsPer10 || toCents(dry) !== rates.dryCentsPer10;
  const notSet = rates.washCentsPer10 === 0 && rates.dryCentsPer10 === 0;

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">₱</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => set(clean(e.target.value))}
          placeholder="0.00"
          className="w-full h-10 pl-7 pr-3 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#009eb5]/30 focus:border-[#009eb5] transition-all"
        />
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 sm:p-5" style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 tracking-tight">Extra time prices</h2>
          <p className="text-[12px] text-zinc-400 mt-0.5">Charged for each extra 10 minutes, on top of the package price.</p>
        </div>
        {notSet && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">Not set</span>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {field("Extra wash · per 10 min", wash, setWash)}
        {field("Extra dry · per 10 min", dry, setDry)}
        <button
          disabled={!changed}
          onClick={() => onSave({ washCentsPer10: toCents(wash), dryCentsPer10: toCents(dry) })}
          className="h-10 px-5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 active:scale-[0.98] transition-all"
          style={{ background: "#009eb5" }}
        >Save</button>
      </div>
      {!notSet && (
        <p className="text-[11px] text-zinc-400 mt-3">
          Example: +30 min wash = {formatPeso(rates.washCentsPer10 * 3)}, +20 min dry = {formatPeso(rates.dryCentsPer10 * 2)}.
        </p>
      )}
    </div>
  );
}
