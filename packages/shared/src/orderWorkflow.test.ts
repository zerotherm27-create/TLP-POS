import test from "node:test";
import assert from "node:assert/strict";
import type { JobOrder } from "./index.js";
import { getFulfillmentStageLabel, getOrderSourceLabel, isImportedOrder } from "./orderWorkflow.js";

const baseOrder: JobOrder = {
  id: "jo-test",
  branchId: "branch-tlp-main",
  customerName: "Test Customer",
  services: [{ productId: "wash-35", quantity: 1 }],
  assignments: [],
  status: "queued",
  source: "tlp_pos",
  paymentStatus: "paid",
  fulfillmentStage: "queued",
  createdAt: "2026-05-31T00:00:00.000Z",
  updatedAt: "2026-05-31T00:00:00.000Z"
};

test("labels TLP and LaundroBot order sources", () => {
  assert.equal(getOrderSourceLabel("tlp_pos"), "TLP POS");
  assert.equal(getOrderSourceLabel("laundrobot"), "LaundroBot");
});

test("detects imported orders by source and external id", () => {
  assert.equal(isImportedOrder(baseOrder), false);
  assert.equal(
    isImportedOrder({
      ...baseOrder,
      source: "laundrobot",
      externalOrderId: "lb-24018"
    }),
    true
  );
});

test("labels customer-facing fulfillment stages", () => {
  assert.equal(getFulfillmentStageLabel("queued"), "Queued");
  assert.equal(getFulfillmentStageLabel("washing"), "Washing");
  assert.equal(getFulfillmentStageLabel("drying"), "Drying");
  assert.equal(getFulfillmentStageLabel("ready"), "Ready for pickup");
  assert.equal(getFulfillmentStageLabel("completed"), "Completed");
});

// Keep executable test code away from EOF for local esbuild/tsx file-read stability.
