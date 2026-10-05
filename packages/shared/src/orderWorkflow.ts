import type { JobOrder, FulfillmentStage, OrderSource } from "./index.js";

export function getFulfillmentStageLabel(stage: FulfillmentStage): string {
  const labels: Record<FulfillmentStage, string> = {
    queued: "Queued",
    washing: "Washing",
    drying: "Drying",
    ready: "Ready for pickup",
    completed: "Completed",
    voided: "Voided",
  };
  return labels[stage] ?? stage;
}

export function getOrderSourceLabel(source: OrderSource): string {
  const labels: Record<OrderSource, string> = {
    tlp_pos: "TLP POS",
    laundrobot: "LaundroBot",
  };
  return labels[source] ?? source;
}

export function isImportedOrder(order: Pick<JobOrder, "source">): boolean {
  return order.source === "laundrobot";
}
