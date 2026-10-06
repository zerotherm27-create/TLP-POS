import { useEffect, useState } from "react";
import { authFetch } from "../../lib/supabase";
import { formatPeso } from "../../lib/format";

interface MachineStat { id: string; code: string; name: string; kind: "washer" | "dryer"; cycles: number; runMinutes: number; utilizationPct: number }
interface Summary {
  range: "today" | "7d";
  orders: { count: number; loads: number; voided: number };
  sales: { totalCents: number; count: number; byMethod: { cash: number; gcash: number; manual: number; online: number } };
  hours: number[];
  openHour: number;
  closeHour: number;
  busiestHour: number | null;
  topPrograms: { productId: string; name: string; kind?: "washer" | "dryer"; loads: number }[];
  machines: MachineStat[];
  mostUsed: MachineStat | null;
  recap: string;
}

const hour12 = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5" style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}>
      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-zinc-900 tracking-tight mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-zinc-100 p-4 sm:p-5" style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)" }}>
    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{title}</div>
    {children}
  </div>
);

/** Admin-only daily/weekly summary, calculated on the server from saved orders and finished cycles. */
export default function InsightsPanel() {
  const [range, setRange] = useState<"today" | "7d">("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch(`/api/insights/summary?range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) { setSummary(data.summary); setError(null); }
        else setError(data.message ?? "Couldn't load the summary.");
      })
      .catch(() => { if (!cancelled) setError("Couldn't load the summary."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const peak = summary ? Math.max(1, ...summary.hours) : 1;
  // Chart the opening hours; stretch it only if an order came in outside them.
  const firstActive = summary ? summary.hours.findIndex((n) => n > 0) : -1;
  const lastActive = summary ? 23 - [...summary.hours].reverse().findIndex((n) => n > 0) : -1;
  const fromHour = summary ? (firstActive >= 0 ? Math.min(summary.openHour, firstActive) : summary.openHour) : 0;
  const toHour = summary ? (firstActive >= 0 ? Math.max(summary.closeHour - 1, lastActive) : summary.closeHour - 1) : 0;
  const hoursShown = summary ? summary.hours.slice(fromHour, toHour + 1).map((n, i) => ({ n, h: fromHour + i })) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 self-start rounded-xl bg-white border border-zinc-100 p-1">
        {(["today", "7d"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 h-8 rounded-lg text-xs font-semibold transition-all ${range === r ? "bg-[#009eb5] text-white" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            {r === "today" ? "Today" : "Last 7 days"}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      {loading && !summary && <p className="text-sm text-zinc-400">Loading…</p>}

      {summary && (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="rounded-2xl px-4 sm:px-5 py-4 text-sm font-medium leading-relaxed text-[#005f6e]" style={{ background: "#e0f6fa" }}>
            {summary.recap}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Sales" value={formatPeso(summary.sales.totalCents)} sub={`${summary.sales.count} paid`} />
            <Tile label="Orders" value={String(summary.orders.count)} sub={`${summary.orders.loads} loads`} />
            <Tile label="Voided" value={String(summary.orders.voided)} />
            <Tile label="Cash · GCash" value={`${formatPeso(summary.sales.byMethod.cash)}`} sub={`GCash ${formatPeso(summary.sales.byMethod.gcash)}`} />
          </div>

          <Section title="Busy hours (orders per hour)">
            <div className="flex items-end gap-1 h-24">
              {hoursShown.map(({ n, h }) => (
                <div key={h} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${n} order${n === 1 ? "" : "s"}`}>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${n === 0 ? 3 : Math.max(10, (n / peak) * 100)}%`, background: n === 0 ? "#f4f4f5" : h === summary.busiestHour ? "#007a8c" : "#7fd3e0" }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-1.5">
              {hoursShown.map(({ h }) => (
                <div key={h} className="flex-1 text-center text-[9px] text-zinc-400 tabular-nums min-w-0">{h % 3 === 0 ? hour12(h) : ""}</div>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Top programs">
              {summary.topPrograms.length === 0 ? (
                <p className="text-sm text-zinc-300">No loads yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {summary.topPrograms.map((p) => (
                    <li key={p.productId} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700">
                        {p.name} <span className="text-[11px] text-zinc-400 capitalize">· {p.kind ?? ""}</span>
                      </span>
                      <span className="font-bold text-zinc-800 tabular-nums">{p.loads}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Machine usage">
              <ul className="flex flex-col gap-3">
                {summary.machines.map((m) => (
                  <li key={m.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-zinc-700">
                        <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md tabular-nums">{m.code}</span>
                        {m.name}
                      </span>
                      <span className="text-[12px] text-zinc-500 tabular-nums">
                        <strong className="text-zinc-800">{m.cycles}</strong> cycle{m.cycles === 1 ? "" : "s"} · {m.runMinutes} min
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.utilizationPct}%`, background: "#009eb5" }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-300 mt-3">Bar = run time as a share of the {summary.closeHour - summary.openHour}-hour day ({hour12(summary.openHour)}m–{hour12(summary.closeHour)}m).</p>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
