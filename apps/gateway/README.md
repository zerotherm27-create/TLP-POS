# LaundroDesk Z83 Gateway

This is the local gateway that runs on the Z83/NUC and receives machine activation commands.

## Run locally

```powershell
npm install
npm run dev:gateway
```

The gateway listens on `http://127.0.0.1:8787` by default.

## Health check

```powershell
Invoke-RestMethod http://localhost:8787/health
```

## Mock activation

Use mock mode before touching a real ESP or real machine:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8787/commands/activate" `
  -ContentType "application/json" `
  -Body '{
    "commandId": "manual-mock-test",
    "machine": { "id": "washer-1", "name": "Washer 1", "espIp": "192.168.210.6", "kind": "washer" },
    "product": { "id": "wash-35", "name": "Wash 35 min", "pulse": 1, "pushDelayMs": 500, "durationMinutes": 35 },
    "mode": "mock"
  }'
```

## Real activation

Real mode forwards the command to the machine ESP:

```text
POST http://<esp-ip><ESP_ACTIVATION_PATH>
```

Defaults:

- `GATEWAY_HOST=127.0.0.1`
- `GATEWAY_PORT=8787`
- `GATEWAY_ID=z83-local`
- `GATEWAY_POLL_MS=3000`
- `ESP_ACTIVATION_PATH=/commands/activate`
- `ESP_TIMEOUT_MS=7000`

## Poll LaundroDesk

Set these on the Z83 to let the gateway receive commands when staff press Start:

```powershell
$env:LAUNDRODESK_API_BASE = "https://desk.thelaundryproject.app"
$env:GATEWAY_API_TOKEN = "<same token configured in Vercel>"
npm run dev:gateway
```

If the ESP firmware uses another route, set `ESP_ACTIVATION_PATH` before starting the gateway.

Optional ESP auth header:

```powershell
$env:ESP_AUTH_HEADER = "X-ESP-Token"
$env:ESP_AUTH_TOKEN = "<secret>"
npm run dev:gateway
```
