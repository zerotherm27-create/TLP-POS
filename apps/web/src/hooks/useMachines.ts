import { useState, useEffect, useCallback } from "react";
import type { Machine } from "@tlp/shared";
import { authFetch } from "../lib/supabase";

/** Machines live in Supabase (via /api/machines/*). Polled so every device stays in sync. */
export function useMachines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch("/api/machines/list");
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.machines)) {
        setMachines(data.machines);
        setError(null);
      } else {
        setError(data?.message ?? "Couldn't load machines.");
      }
    } catch {
      setError("Couldn't load machines.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const patchMachine = useCallback((id: string, patch: Partial<Machine>) => {
    setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  return { machines, loaded, machinesError: error, refreshMachines: refresh, patchMachine };
}
