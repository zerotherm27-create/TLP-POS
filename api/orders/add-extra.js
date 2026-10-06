import { createRequire } from "module";
import { requireUser } from "../_auth.js";
import { extraChargeCents, loadExtraRates, loadProducts } from "../_catalog.js";
import { freeMachinePatch, fromMachineRow } from "../_machines.js";
import { ensurePost, fromJobOrderRow, readJson, sendJson, supabaseRequest, toJobOrderRow } from "../_supabase.js";

const require = createRequire(import.meta.url);
const crypto = require("crypto");
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CYCLE_MINUTES = 600;

/**
 * Extra time (e.g. "+10 Mins Dry") goes on the SAME machine the load is already using, so the laundry never moves.
 * - machine still running this order  -> its cycle is extended by the add-on minutes
 * - machine already finished and free -> it is reserved again for this order (timer waits for Start)
 * - machine used by someone else / offline -> refused, nothing changes
 */
export default async function handler(req, res) {
  try {
    if (!ensurePost(req, res)) return;
    if (!(await requireUser(req, res))) return; // staff and admin

    const { orderId, lineId, productId } = await readJson(req);
    if (!ID_RE.test(String(orderId ?? "")) || !ID_RE.test(String(productId ?? "")) || !/^[0-9a-f-]{36}$/.test(String(lineId ?? ""))) {
      sendJson(res, 400, { ok: false, message: "orderId, lineId and productId are required." });
      return;
    }

    const products = await loadProducts();
    const addon = products.find((p) => p.id === productId);
    if (!addon || !(addon.durationMinutes > 0) || addon.durationMinutes > 60) {
      sendJson(res, 400, { ok: false, message: "Pick how much extra time to add (up to 60 min)." });
      return;
    }

    const safeOrder = encodeURIComponent(orderId);
    const rows = await supabaseRequest(`tlp_job_orders?id=eq.${safeOrder}&limit=1`);
    if (!rows?.length) {
      sendJson(res, 404, { ok: false, message: "Order not found." });
      return;
    }
    const order = fromJobOrderRow(rows[0]);
    if (order.status === "completed" || order.status === "voided") {
      sendJson(res, 400, { ok: false, message: "This order is closed." });
      return;
    }
    if (order.services.length >= 30) {
      sendJson(res, 400, { ok: false, message: "Too many loads in one order." });
      return;
    }

    const base = order.assignments.find((a) => a.lineId === lineId);
    if (!base) {
      sendJson(res, 400, { ok: false, message: "That load isn't on a machine yet." });
      return;
    }

    const safeMachine = encodeURIComponent(base.machineId);
    const machineRows = await supabaseRequest(`tlp_machines?id=eq.${safeMachine}&limit=1`);
    const machine = machineRows?.[0];
    if (!machine) {
      sendJson(res, 404, { ok: false, message: "Machine not found." });
      return;
    }
    if (machine.kind !== addon.machineKind) {
      sendJson(res, 400, { ok: false, message: `That add-on is for a ${addon.machineKind}, but this load is on a ${machine.kind}.` });
      return;
    }

    const now = new Date().toISOString();
    const minutes = Math.round(addon.durationMinutes);
    const rates = await loadExtraRates();
    const rate = machine.kind === "washer" ? rates.washCentsPer10 : rates.dryCentsPer10;
    // Extra time is priced per 10 minutes at the admin rate; if no rate is set, fall back to the program's own price.
    const extraPriceCents = rate > 0 ? extraChargeCents(rates, machine.kind, minutes) : addon.priceCents;
    let updatedMachine;
    let undo;

    if (machine.status === "running" && machine.active_job_order_id === orderId) {
      // Still running this order's load: just add the minutes to the cycle.
      const newTotal = (machine.remaining_minutes ?? 0) + minutes;
      if (newTotal > MAX_CYCLE_MINUTES) {
        sendJson(res, 400, { ok: false, message: "That would make the cycle too long." });
        return;
      }
      const changed = await supabaseRequest(
        `tlp_machines?id=eq.${safeMachine}&status=eq.running&active_job_order_id=eq.${safeOrder}&remaining_minutes=eq.${machine.remaining_minutes ?? 0}`,
        { method: "PATCH", body: JSON.stringify({ remaining_minutes: newTotal }), headers: { Prefer: "return=representation" } }
      );
      if (!changed?.length) {
        sendJson(res, 409, { ok: false, message: `${machine.public_code} just changed. Please try again.` });
        return;
      }
      updatedMachine = changed[0];
      undo = { remaining_minutes: machine.remaining_minutes };
    } else if (machine.status === "online") {
      // Cycle already finished and nobody else took the machine: reserve it again for this order.
      const claimed = await supabaseRequest(`tlp_machines?id=eq.${safeMachine}&status=eq.online`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "running",
          active_job_order_id: orderId,
          customer_name: order.customerName,
          remaining_minutes: minutes,
          started_at: null,
          last_seen_at: now,
        }),
        headers: { Prefer: "return=representation" },
      });
      if (!claimed?.length) {
        sendJson(res, 409, { ok: false, message: `${machine.public_code} was just taken. Please try again.` });
        return;
      }
      updatedMachine = claimed[0];
      undo = freeMachinePatch();
    } else {
      const why = machine.status === "offline" ? "is offline" : "is being used by another order";
      sendJson(res, 409, {
        ok: false,
        message: `${machine.public_code} ${why}, so the extra time can't go on it. Assign another ${machine.kind} and move the laundry instead.`,
      });
      return;
    }

    const newLineId = crypto.randomUUID();
    order.services = [...order.services, { lineId: newLineId, productId: addon.id, quantity: 1, priceCents: extraPriceCents }];
    order.assignments = [...order.assignments, { lineId: newLineId, machineId: machine.id, productId: addon.id, assignedAt: now }];
    order.status = "in_progress";
    order.updatedAt = now;

    try {
      await supabaseRequest(`tlp_job_orders?id=eq.${safeOrder}`, {
        method: "PATCH",
        body: JSON.stringify(toJobOrderRow(order)),
        headers: { Prefer: "return=minimal" },
      });
    } catch (e) {
      // Couldn't save the order: put the machine back how it was.
      await supabaseRequest(`tlp_machines?id=eq.${safeMachine}`, {
        method: "PATCH",
        body: JSON.stringify(undo),
        headers: { Prefer: "return=minimal" },
      });
      throw e;
    }

    sendJson(res, 200, { ok: true, jobOrder: order, machine: fromMachineRow(updatedMachine) });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : "Failed to add the extra time." });
  }
}
