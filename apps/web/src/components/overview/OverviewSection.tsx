import MetricsGrid from "./MetricsGrid";
import JobOrderForm from "./JobOrderForm";
import JobQueue from "./JobQueue";
import type { Machine, JobOrder, Sale, Product, ServicePackage } from "@tlp/shared";

interface Props {
  machines: Machine[];
  orders: JobOrder[];
  sales: Sale[];
  products: Product[];
  packages: ServicePackage[];
  isAdmin: boolean;
}

export default function OverviewSection({ machines, orders, sales, products, packages, isAdmin }: Props) {
  const openOrders = orders.filter((o) => o.status !== "completed" && o.status !== "voided").length;

  return (
    <div className="flex flex-col gap-5">
      <MetricsGrid machines={machines} sales={sales} openOrders={openOrders} isAdmin={isAdmin} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* Job order form */}
        <div
          className="bg-white rounded-2xl border border-zinc-100 p-5"
          style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}
        >
          <JobOrderForm products={products} packages={packages} />
        </div>

        {/* Job queue */}
        <div className="flex flex-col gap-0">
          <JobQueue orders={orders} products={products} />
        </div>
      </div>
    </div>
  );
}
