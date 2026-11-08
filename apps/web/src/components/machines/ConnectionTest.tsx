import { useEffect, useRef, useState } from "react";
import { Wifi } from "lucide-react";

interface Props {
  machineId: string;
  machineName: string;
  onTest: (machineId: string) => Promise<{ ok: boolean; message: string }>;
}

type State = { kind: "idle" } | { kind: "testing" } | { kind: "done"; ok: boolean; message: string };

/** Asks the Z83 gateway to reach the machine's controller. Sends nothing to the machine, so it is safe at any time. */
export default function ConnectionTest({ machineId, machineName, onTest }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const run = useRef(0); // ignores an answer that arrives after another machine was opened

  useEffect(() => {
    run.current += 1;
    setState({ kind: "idle" });
  }, [machineId]);

  const start = async () => {
    const mine = ++run.current;
    setState({ kind: "testing" });
    try {
      const r = await onTest(machineId);
      if (run.current === mine) setState({ kind: "done", ok: r.ok, message: r.message });
    } catch (e) {
      if (run.current === mine) setState({ kind: "done", ok: false, message: e instanceof Error ? e.message : "Couldn't test the connection." });
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-bold text-zinc-700">Machine connection</div>
        <div
          className="text-[11px] mt-0.5"
          style={{ color: state.kind === "done" ? (state.ok ? "#059669" : "#dc2626") : "#a1a1aa" }}
          role="status"
        >
          {state.kind === "idle" && `Check that ${machineName} can be reached. Nothing is sent to the machine.`}
          {state.kind === "testing" && `Testing ${machineName}…`}
          {state.kind === "done" && state.message}
        </div>
      </div>
      <button
        disabled={state.kind === "testing"}
        onClick={start}
        className="shrink-0 flex items-center gap-2 h-10 px-4 rounded-xl border border-zinc-200 text-zinc-700 text-sm font-bold hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wifi size={14} strokeWidth={2.5} />
        {state.kind === "testing" ? "Testing…" : "Test connection"}
      </button>
    </div>
  );
}
