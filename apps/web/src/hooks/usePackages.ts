import { useState, useEffect, useCallback } from "react";
import type { ServicePackage } from "@tlp/shared";
import { authFetch } from "../lib/supabase";

/** Packages are stored in Supabase (via /api/packages/*) so every device sees the same list. */
export function usePackages() {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch("/api/packages/list");
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.packages)) {
        setPackages(data.packages);
        setError(null);
      } else {
        setError(data?.message ?? "Couldn't load packages.");
      }
    } catch {
      setError("Couldn't load packages.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const post = async (url: string, body: unknown) => {
    const res = await authFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data?.message ?? "Request failed.");
  };

  const createPackage = async (pkg: ServicePackage) => {
    setPackages((prev) => [pkg, ...prev]); // show instantly, roll back if the save fails
    try {
      await post("/api/packages/save", pkg);
      setError(null);
    } catch (e) {
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
      setError(e instanceof Error ? e.message : "Couldn't save the package.");
    }
  };

  const removePackage = async (id: string) => {
    const before = packages;
    setPackages((prev) => prev.filter((p) => p.id !== id));
    try {
      await post("/api/packages/delete", { id });
      setError(null);
    } catch (e) {
      setPackages(before);
      setError(e instanceof Error ? e.message : "Couldn't delete the package.");
    }
  };

  return { packages, error, createPackage, removePackage };
}
