import { useState, useEffect, useCallback } from "react";
import type { Product, ExtraRates } from "@tlp/shared";
import { NO_EXTRA_RATES } from "@tlp/shared";
import { authFetch } from "../lib/supabase";
import { mockProducts } from "../lib/mockData";

const DEFAULT_THRESHOLD = 50;

/**
 * Shared settings stored in Supabase (via /api/settings/*): the product list and the tub-clean limit.
 * Until an admin saves for the first time, the built-in defaults are shown.
 */
export function useSettings() {
  const [products, setProductsState] = useState<Product[]>(mockProducts);
  const [tubCleanThreshold, setThresholdState] = useState(DEFAULT_THRESHOLD);
  const [extraRates, setExtraRatesState] = useState<ExtraRates>(NO_EXTRA_RATES);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch("/api/settings/get");
      const data = await res.json();
      if (res.ok && data.ok) {
        if (Array.isArray(data.settings.products)) setProductsState(data.settings.products);
        if (Number.isInteger(data.settings.tubCleanThreshold)) setThresholdState(data.settings.tubCleanThreshold);
        const r = data.settings.extraRates;
        if (r && Number.isInteger(r.washCentsPer10) && Number.isInteger(r.dryCentsPer10)) setExtraRatesState(r);
        setError(null);
      } else {
        setError(data?.message ?? "Couldn't load settings.");
      }
    } catch {
      setError("Couldn't load settings.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async (key: string, value: unknown) => {
    const res = await authFetch("/api/settings/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data?.message ?? "Couldn't save.");
  };

  const setProducts = async (next: Product[]) => {
    const before = products;
    setProductsState(next); // show instantly, roll back if the save fails
    try {
      await save("products", next);
      setError(null);
    } catch (e) {
      setProductsState(before);
      setError(e instanceof Error ? e.message : "Couldn't save products.");
    }
  };

  const setTubCleanThreshold = async (n: number) => {
    const before = tubCleanThreshold;
    setThresholdState(n);
    try {
      await save("tubCleanThreshold", n);
      setError(null);
    } catch (e) {
      setThresholdState(before);
      setError(e instanceof Error ? e.message : "Couldn't save the limit.");
    }
  };

  const setExtraRates = async (next: ExtraRates) => {
    const before = extraRates;
    setExtraRatesState(next);
    try {
      await save("extraRates", next);
      setError(null);
    } catch (e) {
      setExtraRatesState(before);
      setError(e instanceof Error ? e.message : "Couldn't save the extra-time prices.");
    }
  };

  return { products, tubCleanThreshold, extraRates, settingsError: error, setProducts, setTubCleanThreshold, setExtraRates };
}
