import type { Machine, JobOrder, Sale, Product, ServicePackage } from "@tlp/shared";

export const mockMachines: Machine[] = [
  { id: "m1", name: "Washer 1", kind: "washer", tier: "giant", branchId: "b1", espIp: "192.168.1.10", publicCode: "W1", status: "running", activeJobOrderId: "jo1", customerName: "Reyna Dela Cruz", remainingMinutes: 24, lastSeenAt: new Date().toISOString(), cycleCount: 43, totalRunMinutes: 1632, lastTubCleanCycle: 0 },
  { id: "m2", name: "Washer 2", kind: "washer", tier: "giant", branchId: "b1", espIp: "192.168.1.11", publicCode: "W2", status: "online", lastSeenAt: new Date().toISOString(), cycleCount: 18, totalRunMinutes: 684, lastTubCleanCycle: 0 },
  { id: "m3", name: "Washer 3", kind: "washer", tier: "titan", branchId: "b1", espIp: "192.168.1.12", publicCode: "W3", status: "running", activeJobOrderId: "jo2", customerName: "Marco Villanueva", remainingMinutes: 8, lastSeenAt: new Date().toISOString(), cycleCount: 53, totalRunMinutes: 2014, lastTubCleanCycle: 0 },
  { id: "m4", name: "Washer 4", kind: "washer", tier: "giant", branchId: "b1", espIp: "192.168.1.13", publicCode: "W4", status: "offline", lastSeenAt: new Date(Date.now() - 12 * 60000).toISOString(), cycleCount: 31, totalRunMinutes: 1178, lastTubCleanCycle: 0 },
  { id: "m5", name: "Washer 5", kind: "washer", tier: "giant", branchId: "b1", espIp: "192.168.1.14", publicCode: "W5", status: "online", lastSeenAt: new Date().toISOString(), cycleCount: 9, totalRunMinutes: 342, lastTubCleanCycle: 0 },
  { id: "m6", name: "Dryer 1", kind: "dryer", tier: "giant", branchId: "b1", espIp: "192.168.1.20", publicCode: "D1", status: "running", activeJobOrderId: "jo3", customerName: "Liza Ortega", remainingMinutes: 35, lastSeenAt: new Date().toISOString(), cycleCount: 61, totalRunMinutes: 2318, lastTubCleanCycle: 10 },
  { id: "m7", name: "Dryer 2", kind: "dryer", tier: "giant", branchId: "b1", espIp: "192.168.1.21", publicCode: "D2", status: "online", lastSeenAt: new Date().toISOString(), cycleCount: 27, totalRunMinutes: 1026, lastTubCleanCycle: 0 },
  { id: "m8", name: "Dryer 3", kind: "dryer", tier: "titan", branchId: "b1", espIp: "192.168.1.22", publicCode: "D3", status: "running", activeJobOrderId: "jo4", customerName: "Benito Ramos", remainingMinutes: 17, lastSeenAt: new Date().toISOString(), cycleCount: 38, totalRunMinutes: 1444, lastTubCleanCycle: 0 },
  { id: "m9", name: "Dryer 4", kind: "dryer", tier: "giant", branchId: "b1", espIp: "192.168.1.23", publicCode: "D4", status: "online", lastSeenAt: new Date().toISOString(), cycleCount: 14, totalRunMinutes: 532, lastTubCleanCycle: 0 },
  { id: "m10", name: "Dryer 5", kind: "dryer", tier: "giant", branchId: "b1", espIp: "192.168.1.24", publicCode: "D5", status: "offline", lastSeenAt: new Date(Date.now() - 45 * 60000).toISOString(), cycleCount: 22, totalRunMinutes: 836, lastTubCleanCycle: 0 },
];

export const mockProducts: Product[] = [
  { id: "p1", machineKind: "washer", name: "10 min", durationMinutes: 10, priceCents: 0, pulse: 1, pushDelayMs: 500 },
  { id: "p2", machineKind: "washer", name: "35 min", durationMinutes: 35, priceCents: 0, pulse: 1, pushDelayMs: 500 },
  { id: "p3", machineKind: "washer", name: "45 min", durationMinutes: 45, priceCents: 0, pulse: 2, pushDelayMs: 500 },
  { id: "p4", machineKind: "dryer", name: "10 min", durationMinutes: 10, priceCents: 0, pulse: 1, pushDelayMs: 500 },
  { id: "p5", machineKind: "dryer", name: "30 min", durationMinutes: 30, priceCents: 0, pulse: 1, pushDelayMs: 500 },
  { id: "p6", machineKind: "dryer", name: "40 min", durationMinutes: 40, priceCents: 0, pulse: 2, pushDelayMs: 500 },
];

export const mockJobOrders: JobOrder[] = [
  {
    id: "jo1", branchId: "b1", source: "tlp_pos", orderNumber: "TLP-0081",
    customerName: "Reyna Dela Cruz", contactNumber: "+63 917 384-2019",
    services: [{ productId: "p2", quantity: 1 }],
    assignments: [{ machineId: "m1", productId: "p2", assignedAt: new Date(Date.now() - 26 * 60000).toISOString() }],
    status: "in_progress", paymentStatus: "paid", fulfillmentStage: "washing",
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 26 * 60000).toISOString(),
  },
  {
    id: "jo2", branchId: "b1", source: "tlp_pos", orderNumber: "TLP-0082",
    customerName: "Marco Villanueva", contactNumber: "+63 912 847-3301",
    services: [{ productId: "p3", quantity: 1 }],
    assignments: [{ machineId: "m3", productId: "p3", assignedAt: new Date(Date.now() - 42 * 60000).toISOString() }],
    status: "in_progress", paymentStatus: "paid", fulfillmentStage: "washing",
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 42 * 60000).toISOString(),
  },
  {
    id: "jo3", branchId: "b1", source: "laundrobot", orderNumber: "LB-4471",
    customerName: "Liza Ortega", contactNumber: "+63 918 221-5590",
    services: [{ productId: "p5", quantity: 1, priceCents: 6000 }],
    assignments: [{ machineId: "m6", productId: "p5", assignedAt: new Date(Date.now() - 5 * 60000).toISOString() }],
    status: "in_progress", paymentStatus: "paid", fulfillmentStage: "drying",
    createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: "jo4", branchId: "b1", source: "tlp_pos", orderNumber: "TLP-0083",
    customerName: "Benito Ramos",
    services: [{ productId: "p6", quantity: 1 }],
    assignments: [{ machineId: "m8", productId: "p6", assignedAt: new Date(Date.now() - 18 * 60000).toISOString() }],
    status: "in_progress", paymentStatus: "paid", fulfillmentStage: "drying",
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: "jo5", branchId: "b1", source: "tlp_pos", orderNumber: "TLP-0080",
    customerName: "Carina Fuentes", contactNumber: "+63 919 771-4482",
    services: [{ productId: "p2", quantity: 1 }],
    assignments: [],
    status: "queued", paymentStatus: "paid", fulfillmentStage: "queued",
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
];

export const mockSales: Sale[] = [
  { id: "s1", jobOrderId: "jo1", branchId: "b1", operatorId: "u1", paymentMethod: "gcash", paidAt: new Date(Date.now() - 30 * 60000).toISOString(), totalCents: 0, lines: [{ productId: "p2", machineId: "m1", quantity: 1 }], status: "paid" },
  { id: "s2", jobOrderId: "jo2", branchId: "b1", operatorId: "u1", paymentMethod: "cash", paidAt: new Date(Date.now() - 45 * 60000).toISOString(), totalCents: 0, lines: [{ productId: "p3", machineId: "m3", quantity: 1 }], status: "paid" },
  { id: "s3", jobOrderId: "jo3", branchId: "b1", operatorId: "u1", paymentMethod: "gcash", paidAt: new Date(Date.now() - 60 * 60000).toISOString(), totalCents: 0, lines: [{ productId: "p5", machineId: "m6", quantity: 1 }], status: "paid" },
  { id: "s4", jobOrderId: "jo4", branchId: "b1", operatorId: "u1", paymentMethod: "cash", paidAt: new Date(Date.now() - 20 * 60000).toISOString(), totalCents: 0, lines: [{ productId: "p6", machineId: "m8", quantity: 1 }], status: "paid" },
  { id: "s5", jobOrderId: "jo5", branchId: "b1", operatorId: "u2", paymentMethod: "gcash", paidAt: new Date(Date.now() - 5 * 60000).toISOString(), totalCents: 0, lines: [{ productId: "p2", quantity: 1 }], status: "paid" },
];

export const mockPackages: ServicePackage[] = [
  { id: "pkg1", name: "Wash & Dry Bundle", services: ["p1", "p3"], createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "pkg2", name: "Heavy Clean", services: ["p2", "p4"], createdAt: new Date(Date.now() - 172800000).toISOString() },
];
