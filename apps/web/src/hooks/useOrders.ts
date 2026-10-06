import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../lib/supabase";
import type { JobOrder } from "@tlp/shared";

export function useOrders(branchId: string, fallback: JobOrder[] = []) {
  const [orders, setOrders] = useState<JobOrder[]>(fallback);

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch(`/api/orders/list?branchId=${branchId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch {
      // API not available — keep fallback data
    }
  }, [branchId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const updateOrder = useCallback((updated: JobOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }, []);

  return { orders, refresh, updateOrder };
}
