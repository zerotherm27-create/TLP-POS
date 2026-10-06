export type Role = "admin" | "staff";

export type MachineKind = "washer" | "dryer";

export type MachineStatus = "online" | "offline" | "running";

export type PaymentMethod = "cash" | "gcash" | "manual";

export type JobOrderStatus = "queued" | "assigned" | "in_progress" | "completed" | "voided";

export type OrderSource = "tlp_pos" | "laundrobot";

export type PaymentStatus = "unpaid" | "paid" | "voided" | "refunded";

export type FulfillmentStage = "queued" | "washing" | "drying" | "ready" | "completed" | "voided";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Branch {
  id: string;
  name: string;
  timezone: string;
}

export interface ServicePackage {
  id: string;
  name: string;
  description?: string; // short sub-description shown under the name
  services: string[]; // product IDs
  createdAt: string;
}

export interface Machine {
  id: string;
  name: string;
  kind: MachineKind;
  tier?: "giant" | "titan";
  branchId: string;
  espIp: string;
  macAddress?: string;
  publicCode: string;
  status: MachineStatus;
  activeJobOrderId?: string;
  activeSaleId?: string;
  customerName?: string;
  remainingMinutes?: number;  // total cycle duration (minutes); set at assignment
  startedAt?: string;         // ISO timestamp when machine physically activated; absent = pending
  lastSeenAt?: string;
  cycleCount?: number;
  totalRunMinutes?: number;
  lastTubCleanCycle?: number;
}

export interface Product {
  id: string;
  machineKind: MachineKind;
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  pulse: number;
  pushDelayMs: number;
  isExtraTime?: boolean;
}

export interface SaleLine {
  productId: string;
  machineId?: string;
  quantity: number;
}

export interface ServiceLine {
  lineId: string;        // unique per line; multi-load orders have one line per load
  productId: string;
  quantity: number;      // always 1 after expansion at import
  priceCents?: number;   // set by LaundroBot at booking time; absent for TLP walk-in orders
}

export interface MachineAssignment {
  lineId: string;        // references ServiceLine.lineId
  machineId: string;
  productId: string;
  assignedAt: string;
  startedAt?: string;
  finishedAt?: string; // set by the server when the machine's cycle ends
}

export interface JobOrder {
  id: string;
  branchId: string;
  source: OrderSource;
  orderNumber?: string;
  externalOrderId?: string;
  externalOrderUrl?: string;
  customerName: string;
  contactNumber?: string;
  notes?: string;
  services: ServiceLine[];
  assignments: MachineAssignment[];
  status: JobOrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStage: FulfillmentStage;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  jobOrderId?: string;
  branchId: string;
  operatorId: string;
  paymentMethod: PaymentMethod;
  paidAt: string;
  totalCents: number;
  lines: SaleLine[];
  status: "paid" | "voided";
}

export interface MachineCommand {
  id: string;
  saleId: string;
  machineId: string;
  productId: string;
  operatorId: string;
  gatewayId: string;
  status: "queued" | "approved" | "sent" | "succeeded" | "failed";
  requestedAt: string;
  completedAt?: string;
  espResponse?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  entityType: "sale" | "machine" | "product" | "command" | "user";
  entityId: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean>;
}

export interface GatewayActivationRequest {
  commandId: string;
  machine: Pick<Machine, "id" | "name" | "espIp" | "kind">;
  product: Pick<Product, "id" | "name" | "pulse" | "pushDelayMs" | "durationMinutes">;
  mode: "mock" | "real";
}

export interface GatewayActivationResult {
  commandId: string;
  ok: boolean;
  status: "succeeded" | "failed";
  gatewayId: string;
  response: string;
  completedAt: string;
}

export const formatPeso = (cents: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(cents / 100);

export { getFulfillmentStageLabel, getOrderSourceLabel, isImportedOrder } from "./orderWorkflow.js";
export { rankMachines, rankWasherPairs, planDryers, machineNumber, computeAlerts, loadsSinceClean, isTubDue, ALERT_LIMITS } from "./insights.js";
export type { Alert, AlertKind, MachineSuggestion, WasherPair, DryerChoice, DryerPlan } from "./insights.js";
