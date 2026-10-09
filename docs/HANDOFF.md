# LaundroDesk handoff

LaundroDesk is the staff app for The Laundry Project's laundromat (formerly "TLP POS"). Orders come from **LaundroBot**
(a separate repo, `laundrobot`) and staff assign them to washers and dryers here.

## Where things run
| Part | Where |
|---|---|
| This app (React/Vite in `apps/web`, API in `api/`) | Vercel project `tlp-pos`, `desk.thelaundryproject.app`. **Pushing to `main` deploys to production.** |
| Database and logins | Supabase project `yvvivalchvmbcylikdxc` (Auth + Postgres). Tables are in `supabase/migrations`. |
| LaundroBot backend | Railway (auto-deploys from the `laundrobot` repo `main`) |

Repo: `github.com/zerotherm27-create/TLP-POS`. Shared types and pure logic: `packages/shared`.

## Environment variables (names only, never commit values)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LAUNDROBOT_IMPORT_TOKEN`, `GATEWAY_API_TOKEN`, `BRANCH_ID` (defaults to `b1`).
The web app also needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
`ORDERS_API_TOKEN` in `.env.example` is not used by any code.

## Commands
- `npm install` then `npm test` (shared logic plus API helpers, about 58 tests).
- Type-check the web app: `cd apps/web && npx tsc --noEmit -p .`

## How an order flows
1. A customer books and pays in LaundroBot (walk-ins too).
2. LaundroBot's backend POSTs it to `/api/orders/import` with a bearer token (`api/orders/import.js`, mapping in `api/_laundrobot.js`).
   Only machine-wash orders are sent. They map to the package named exactly **FULL - CARE EXPRESS** (35-min wash then 30-min dry per bag).
   Large bags (or 10 kg and up) use the larger machines W5 and D5. "+10 Mins" add-ons merge into the 45/40-minute programs.
   Orders arrive already paid, with the booking number (for example `BKG-000287`) as the order number.
3. Staff open the order and assign a washer and its matching dryer (W1 with D1, never crossed). Logic: `packages/shared/src/insights.ts`.
4. Machine state and cycle timers live in `tlp_machines` (`api/machines/*`, `api/_machines.js`).

## Roles
Role comes from the Supabase account's `app_metadata.role` (`admin` or `staff`), checked on the server in `api/_auth.js`.
Staff can assign, start, rework and reassign. Only admins can void orders, open the Admin Panel, change prices and packages,
take a machine offline, or create an order by hand (`/api/orders/create`, for testing).

## Physical machine control gateway
The **Start** button queues a command for the local Z83 gateway and starts the timer in LaundroDesk. The gateway then forwards
the selected program to the ESP controller on the machine.
What exists: per-program `pulse` and `pushDelayMs` settings, the `MachineCommand` and `GatewayActivationRequest/Result` types in
`packages/shared/src/index.ts`, `espIp` on machines, a local Z83 gateway app (`apps/gateway`), and one Windows test script
(`scripts/windows/test-z83-esp-activate.ps1`).
Run the local Z83 gateway with `npm run dev:gateway`. It listens on `http://127.0.0.1:8787`, exposes `GET /health`, accepts
`POST /commands/activate`, and can poll `/api/gateway/commands/next` using `GATEWAY_API_TOKEN`. Use `-Mode mock` in
`scripts/windows/test-z83-esp-activate.ps1` before any live machine test.

## Things to know
- Every API route checks the caller; the browser only holds the public anon key. All tables have row level security on and no policies (server access only).
- Security headers and an enforced Content Security Policy are in `vercel.json`. A new outside service (analytics, a font host, another API) must be added there or it will be blocked.
- Two people can edit one order at once; writes go through `changeOrder` in `api/_supabase.js`, which retries on a conflict. Use it for any new order write.
- The package name "FULL - CARE EXPRESS" must not be renamed, or LaundroBot orders stop mapping.
