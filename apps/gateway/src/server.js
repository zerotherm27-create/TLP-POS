import http from "node:http";

const PORT = numberFromEnv("GATEWAY_PORT", 8787);
const HOST = process.env.GATEWAY_HOST || "127.0.0.1";
const GATEWAY_ID = process.env.GATEWAY_ID || "z83-local";
const ESP_ACTIVATION_PATH = normalizePath(process.env.ESP_ACTIVATION_PATH || "/activate");
const ESP_TIMEOUT_MS = numberFromEnv("ESP_TIMEOUT_MS", 30000);
const ESP_TEST_TIMEOUT_MS = numberFromEnv("ESP_TEST_TIMEOUT_MS", 5000);
// Washers and dryers need the short 60 ms signal the old CSI Pi sent; 500 credits time but leaves Start dead.
const ESP_PUSH_DELAY_MS = numberFromEnv("ESP_PUSH_DELAY_MS", 60);
const ESP_AUTH_HEADER = process.env.ESP_AUTH_HEADER || "";
const ESP_AUTH_TOKEN = process.env.ESP_AUTH_TOKEN || "";
const LAUNDRODESK_API_BASE = (process.env.LAUNDRODESK_API_BASE || "").replace(/\/$/, "");
const GATEWAY_API_TOKEN = process.env.GATEWAY_API_TOKEN || "";
const GATEWAY_POLL_MS = numberFromEnv("GATEWAY_POLL_MS", 1000);
// The ESP controllers call this address back when the physical Start button is pressed (the old CSI Pi
// received those calls on port 80). 0 = off. To replace the Pi, the Z83 takes over the Pi's IP and uses port 80.
const CALLBACK_PORT = numberFromEnv("GATEWAY_CALLBACK_PORT", 0);
const CALLBACK_HOST = process.env.GATEWAY_CALLBACK_HOST || "0.0.0.0";
// Last token sent to each controller, so a Start callback can be checked against what was really activated.
const sentTokens = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        gatewayId: GATEWAY_ID,
        mode: "ready",
        espActivationPath: ESP_ACTIVATION_PATH,
        completedAt: new Date().toISOString()
      });
    }

    if (req.method === "POST" && url.pathname === "/commands/activate") {
      const body = await readJson(req);
      const problem = validateActivationRequest(body);
      if (problem) {
        return sendJson(res, 400, {
          ok: false,
          status: "failed",
          gatewayId: GATEWAY_ID,
          response: problem,
          completedAt: new Date().toISOString()
        });
      }

      const result = body.mode === "mock"
        ? mockActivate(body)
        : await realActivate(body);

      return sendJson(res, result.ok ? 200 : 502, result);
    }

    sendJson(res, 404, {
      ok: false,
      status: "failed",
      gatewayId: GATEWAY_ID,
      response: "Route not found.",
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      status: "failed",
      gatewayId: GATEWAY_ID,
      response: error instanceof Error ? error.message : "Unknown gateway error.",
      completedAt: new Date().toISOString()
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`LaundroDesk gateway ${GATEWAY_ID} listening on http://${HOST}:${PORT}`);
  console.log(`ESP activation path: ${ESP_ACTIVATION_PATH}`);
  if (LAUNDRODESK_API_BASE && GATEWAY_API_TOKEN) {
    console.log(`Polling ${LAUNDRODESK_API_BASE}/api/gateway/commands/next every ${GATEWAY_POLL_MS}ms`);
    setInterval(() => {
      pollForCommand().catch((error) => {
        console.error("Gateway poll failed:", error instanceof Error ? error.message : error);
      });
    }, GATEWAY_POLL_MS);
  } else {
    console.log("Cloud polling disabled. Set LAUNDRODESK_API_BASE and GATEWAY_API_TOKEN to enable it.");
  }
});

if (CALLBACK_PORT) {
  http.createServer(async (req, res) => {
    const when = new Date().toISOString();
    const from = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    console.log(`${when} callback ${req.method} ${maskToken(req.url)} from ${from}`);
    const match = /^\/api\/remote\/confirm-activation\/([^/]+)\/(\d{1,3}(?:\.\d{1,3}){3})\/?$/.exec((req.url || "").split("?")[0]);
    if (!match) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("not found");
    }
    const espIp = match[2];
    const token = decodeURIComponent(match[1]);
    // Only the controller itself may report its own Start, and only for the token we just sent it.
    const sent = sentTokens.get(espIp);
    if (from !== espIp || (sent && sent !== token)) {
      console.warn(`${when} callback rejected for ${espIp} from ${from}`);
      res.writeHead(403, { "content-type": "text/plain" });
      return res.end("forbidden");
    }
    try {
      await reportMachineStarted(espIp, token);
    } catch (error) {
      console.error("Reporting machine start failed:", error instanceof Error ? error.message : error);
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  }).listen(CALLBACK_PORT, CALLBACK_HOST, () => {
    console.log(`Listening for machine Start callbacks on http://${CALLBACK_HOST}:${CALLBACK_PORT}`);
  });
}

async function reportMachineStarted(espIp, token) {
  if (!LAUNDRODESK_API_BASE || !GATEWAY_API_TOKEN) return;
  const response = await fetch(`${LAUNDRODESK_API_BASE}/api/gateway/machines/started`, {
    method: "POST",
    headers: { ...gatewayHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ espIp, token })
  });
  console.log(`${new Date().toISOString()} machine ${espIp} started -> ${response.status}`);
}

async function pollForCommand() {
  const response = await fetch(`${LAUNDRODESK_API_BASE}/api/gateway/commands/next`, {
    method: "POST",
    headers: gatewayHeaders()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`next command failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const body = await response.json();
  if (!body.command) return;

  // A connection test only reads the controller's status page; it never sends credit or starts a timer.
  if (body.command.type === "test") {
    const tested = await testConnection(body.command);
    await completeCommand(body.command.commandId, tested.ok, tested.response);
    return;
  }

  const result = body.command.mode === "mock"
    ? mockActivate(body.command)
    : await realActivate(body.command);

  await fetch(`${LAUNDRODESK_API_BASE}/api/gateway/commands/complete`, {
    method: "POST",
    headers: {
      ...gatewayHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      commandId: result.commandId,
      ok: result.ok,
      response: result.response
    })
  });

  // No signal exists for the physical Start (the controller's callback arrives ~1 s after the request),
  // so once the machine has accepted a real activation the cycle timer starts; staff press Start right after.
  if (result.ok && body.command.mode !== "mock") {
    try {
      await reportMachineStarted(body.command.machine.espIp);
    } catch (error) {
      console.error("Starting the timer failed:", error instanceof Error ? error.message : error);
    }
  }
}

async function completeCommand(commandId, ok, response) {
  await fetch(`${LAUNDRODESK_API_BASE}/api/gateway/commands/complete`, {
    method: "POST",
    headers: {
      ...gatewayHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify({ commandId, ok, response })
  });
}

// Reads the controller's /details page (the same one used when checking a machine by hand). Sends no credit.
async function testConnection(request) {
  const name = String(request.machine?.name ?? "The machine");
  const espIp = String(request.machine?.espIp ?? "").trim();
  if (!/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(espIp)) {
    return { ok: false, response: `${name} has no valid controller address.` };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESP_TEST_TIMEOUT_MS);
  const started = Date.now();
  try {
    const headers = {};
    if (ESP_AUTH_HEADER && ESP_AUTH_TOKEN) headers[ESP_AUTH_HEADER] = ESP_AUTH_TOKEN;
    const response = await fetch(`http://${espIp}/details`, { method: "GET", headers, signal: controller.signal });
    await response.text().catch(() => "");
    const ms = Date.now() - started;
    console.log(`${new Date().toISOString()} test ${espIp}/details -> ${response.status} in ${ms} ms`);
    return response.ok
      ? { ok: true, response: `${name} is connected.` }
      : { ok: false, response: `${name} replied with HTTP ${response.status}.` };
  } catch (error) {
    console.log(`${new Date().toISOString()} test ${espIp}/details failed: ${error instanceof Error ? error.message : error}`);
    return {
      ok: false,
      response: error instanceof Error && error.name === "AbortError"
        ? `${name} did not answer within ${Math.round(ESP_TEST_TIMEOUT_MS / 1000)} seconds. Check it is switched on.`
        : `Could not reach ${name}. Check it is switched on and on the network.`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function gatewayHeaders() {
  return {
    authorization: `Bearer ${GATEWAY_API_TOKEN}`,
    "x-gateway-id": GATEWAY_ID
  };
}

function mockActivate(request) {
  return {
    commandId: request.commandId,
    ok: true,
    status: "succeeded",
    gatewayId: GATEWAY_ID,
    response: `Mock activation accepted for ${request.machine.name} using ${request.product.name}.`,
    completedAt: new Date().toISOString()
  };
}

async function realActivate(request) {
  const target = buildEspUrl(request.machine.espIp);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESP_TIMEOUT_MS);

  try {
    const headers = {};
    if (ESP_AUTH_HEADER && ESP_AUTH_TOKEN) {
      headers[ESP_AUTH_HEADER] = ESP_AUTH_TOKEN;
    }

    // The ESP firmware takes a plain GET with query params (same contract the old CSI Pi used).
    const url = new URL(target);
    // The ESP refuses a repeated/empty token (-1), so every start needs a fresh one.
    url.searchParams.set("pulse", String(pulsesFor(request)));
    // Keep it short and numeric like the old Pi's DB ids; a 45-char UUID token never reached the machine.
    const token = String(Date.now() % 1000000000);
    url.searchParams.set("token", token);
    url.searchParams.set("pushDelay", String(ESP_PUSH_DELAY_MS));

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    const text = await response.text();
    // The controller answers 200 with body "1" when it accepts and "-1" when it refuses (e.g. a repeated token).
    const accepted = response.ok && text.trim() !== "-1";
    if (accepted) sentTokens.set(request.machine.espIp, token);
    console.log(`${new Date().toISOString()} ESP ${url.toString()} -> ${response.status} ${text.slice(0, 100)}`);
    return {
      commandId: request.commandId,
      ok: accepted,
      status: accepted ? "succeeded" : "failed",
      gatewayId: GATEWAY_ID,
      response: `ESP ${response.status} ${response.statusText}${text ? `: ${text.slice(0, 500)}` : ""}`,
      completedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      commandId: request.commandId,
      ok: false,
      status: "failed",
      gatewayId: GATEWAY_ID,
      response: error instanceof Error ? error.message : "Unknown ESP activation error.",
      completedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
  }
}

// The LG washers count each pulse as 5 credit and run the course currently selected on the machine
// once the credit covers its price (setup prices: Hot 15, Warm 10, Cold 10, Delicates 5).
// Verified 2026-11-08 on Washers 1 and 3: after a power cycle Hot is selected, so 3 pulses run the 35 min
// program; 45 min is the Cold course, which costs 2 pulses but only runs if staff pressed COLD on the washer
// first (otherwise Hot is still selected and 2 pulses just show the 5 credit still missing). The controller
// cannot press course buttons, so the POS tells staff which button to press (MachineBoard).
// Dryers use minutes / 10 until each length is verified on the machine.
const WASHER_PULSES = { 35: 3, 45: 2 };

function pulsesFor(request) {
  const minutes = request.product.durationMinutes;
  if (!Number.isInteger(minutes) || minutes <= 0) return request.product.pulse;
  if (request.machine.kind === "dryer") return Math.max(1, Math.round(minutes / 10));
  return WASHER_PULSES[minutes] ?? request.product.pulse;
}

function maskToken(url) {
  return String(url || "").replace(/(confirm-activation\/)[^/]+/, "$1***");
}

function buildEspUrl(espIp) {
  const base = /^https?:\/\//i.test(espIp) ? espIp : `http://${espIp}`;
  return new URL(ESP_ACTIVATION_PATH, base).toString();
}

function validateActivationRequest(body) {
  if (!body || typeof body !== "object") return "Request body must be a JSON object.";
  if (!isNonEmptyString(body.commandId)) return "commandId is required.";
  if (body.mode !== "mock" && body.mode !== "real") return "mode must be mock or real.";

  const machine = body.machine;
  if (!machine || typeof machine !== "object") return "machine is required.";
  if (!isNonEmptyString(machine.id)) return "machine.id is required.";
  if (!isNonEmptyString(machine.name)) return "machine.name is required.";
  if (!isNonEmptyString(machine.espIp)) return "machine.espIp is required.";
  if (machine.kind !== "washer" && machine.kind !== "dryer") return "machine.kind must be washer or dryer.";

  const product = body.product;
  if (!product || typeof product !== "object") return "product is required.";
  if (!isNonEmptyString(product.id)) return "product.id is required.";
  if (!isNonEmptyString(product.name)) return "product.name is required.";
  if (!Number.isInteger(product.pulse) || product.pulse < 1 || product.pulse > 20) return "product.pulse must be an integer from 1 to 20.";
  if (!Number.isInteger(product.pushDelayMs) || product.pushDelayMs < 0 || product.pushDelayMs > 30000) return "product.pushDelayMs must be an integer from 0 to 30000.";
  if (!Number.isInteger(product.durationMinutes) || product.durationMinutes < 1 || product.durationMinutes > 240) return "product.durationMinutes must be an integer from 1 to 240.";

  return "";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error("Request body is too large.");
  }
  if (!raw.trim()) throw new Error("Request body is required.");
  return JSON.parse(raw);
}

function sendJson(res, statusCode, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data)
  });
  res.end(data);
}

function normalizePath(value) {
  return value.startsWith("/") ? value : `/${value}`;
}

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
