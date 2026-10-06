import type { JobOrder, Product, Sale } from "@tlp/shared";

/** Paid orders count as sales; voided/refunded ones are marked "voided" so totals skip them. */
export function ordersToSales(orders: JobOrder[], products: Product[]): Sale[] {
  return orders
    .filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "refunded" || o.paymentStatus === "voided")
    .map((o) => ({
      id: o.id,
      jobOrderId: o.id,
      branchId: o.branchId,
      operatorId: "",
      paymentMethod: o.paymentMethod ?? "manual",
      paidAt: o.createdAt,
      totalCents: o.services.reduce((sum, line) => {
        const p = products.find((pr) => pr.id === line.productId);
        return sum + (line.priceCents ?? (p?.priceCents ?? 0) * line.quantity);
      }, 0),
      lines: o.services.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      status: o.status === "voided" || o.paymentStatus !== "paid" ? ("voided" as const) : ("paid" as const),
    }));
}

export const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
