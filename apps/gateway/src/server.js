import http from "node:http";

const PORT = numberFromEnv("GATEWAY_PORT", 8787);
const HOST = process.env.GATEWAY_HOST || "127.0.0.1";
const GATEWAY_ID = process.env.GATEWAY_ID || "z83-local";
const ESP_ACTIVATION_PATH = normalizePath(process.env.ESP_ACTIVATION_PATH || "/commands/activate");
const ESP_TIMEOUT_MS = numberFromEnv("ESP_TIMEOUT_MS", 7000);
const ESP_AUTH_HEADER = process.env.ESP_AUTH_HEADER || "";
const ESP_AUTH_TOKEN = process.env.ESP_AUTH_TOKEN || "";
const LAUNDRODESK_API_BASE = (process.env.LAUNDRODESK_API_BASE || "").replace(/\/$/, "");
const GATEWAY_API_TOKEN = process.env.GATEWAY_API_TOKEN || "";
const GATEWAY_POLL_MS = numberFromEnv("GATEWAY_POLL_MS", 3000);

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
    const headers = {
      "content-type": "application/json"
    };
    if (ESP_AUTH_HEADER && ESP_AUTH_TOKEN) {
      headers[ESP_AUTH_HEADER] = ESP_AUTH_TOKEN;
    }

    const response = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: request.commandId,
        machineId: request.machine.id,
        machineName: request.machine.name,
        machineKind: request.machine.kind,
        productId: request.product.id,
        productName: request.product.name,
        pulse: request.product.pulse,
        pushDelayMs: request.product.pushDelayMs,
        durationMinutes: request.product.durationMinutes
      }),
      signal: controller.signal
    });

    const text = await response.text();
    return {
      commandId: request.commandId,
      ok: response.ok,
      status: response.ok ? "succeeded" : "failed",
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
