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

### Machine control handoff, 2026-11-01 (supersedes the 2026-10-10 notes)

Goal: LaundroDesk starts washers/dryers through the Z83 gateway so the old Raspberry Pi system ("CSI V3") can be retired.

**How it works now (verified live on Washer 1 and Dryer 1)**
- Staff press **Activate** on a machine that has an order waiting. That queues a row in `tlp_machine_commands`. The Z83 gateway
  (`apps/gateway/src/server.js`, polls `/api/gateway/commands/next` every 3 s) sends
  `GET http://<esp-ip>/activate?pulse=N&token=<short numeric>&pushDelay=60`.
- The ESP answers body `1` = accepted, `-1` = rejected (empty or repeated token). A 45-char UUID token plus pushDelay 500 showed nothing on the machine; use a short numeric token and pushDelay 60 (`ESP_PUSH_DELAY_MS`).
- The cycle timer is meant to start only when someone presses the **physical Start** button, not on Activate (`started_at` stays null until then; machine UI shows an Activate panel with states sending/ready/failed).
- Gateway listens on port 80 for the ESP callback and reports it to `POST /api/gateway/machines/started` (needs a matching source IP and token).
  **This callback design is wrong, see below.**
- Pulse rules live in `pulsesFor()` / `WASHER_PULSES` in the gateway. Dryers: pulses = minutes / 10 (10 min tested; 30 and 40 untested).
- LaundroBot order import is paused unless the Vercel env `LAUNDRODESK_IMPORT_ENABLED=true` (503 otherwise). Existing orders were to be erased with SQL by the owner (confirm it was done).

**Machine IPs (all six answered a network scan on 2026-11-01)**
| Machine | ESP IP | Notes |
|---|---|---|
| Dryer 1 / 2 / 3 | .6 / .7 / .8 | only D1 tested live |
| Washer 1 / 2 / 3 | .11 / .12 / .13 | only W1 tested live |
The old app's database also lists Washer 4 `.14`, Dryer 4 `.9`, Titan Dryer 1 `.36` (not seen on the network). Supabase `tlp_machines.esp_ip` was updated for m1 (.11) and m6 (.6) only; m2, m3, m7, m8 still need updating once confirmed.
Network: 192.168.210.0/24, router .1, old Pi .100, Z83 .102 (DHCP, Windows user `tungz`, not admin). The ESP `/details` page shows `activate(pulse, msDelay, interval)`, endpoint 192.168.210.100, remoteToken.

**Washer 1 pulse results from the Z83 (idle machine)**: 1 gives 10 min (no Start LED), 2 gives 5 (no LED), 3, 4, 5, 6, 10 give 35 with the Start LED blinking and the wash runs. Extra pulses while armed are ignored. The machine's own buttons: hot = 5, warm = 35, delicate = 45, add super wash steps 35, 40, 30.

**OPEN PROBLEM 1: automatic 45-minute wash.** The owner requires 45 min to be set automatically from the POS (no staff button presses, no workarounds). The old app got 45 on Washer 1 with `pulse=2`, but the identical request from the Z83 gives 5 with no Start LED.
- Old app (Laravel on the Pi, `app/Http/Controllers/MachinesController.php`) sends a single curl `GET <ip>/activate?pulse=$pulse&token=<customer wash UUID>&pushDelay=60`, nothing before or after. Pulse comes from `WashingService::getPulseCountAttribute` (nsoft: regular 2, quick 1, more_rinse 2, premium 3, additional 4). The request is the same as ours, so the difference is not in the request itself.
- Pi Apache logs only show requests coming in; they cannot show the outgoing pulses. Laravel logs have nothing on activation.
- **Next test, side by side on Washer 1:** with the Pi up, send one 45-minute wash from the old app and note the display and Start LED; then send the same from the POS. Read `http://192.168.210.11/details` before and after each. Also try the cycle of pulses after the machine shows 5/10 (unarmed), and check whether timing or a second request matters.
- `WASHER_PULSES = { 35: 3, 45: 2 }` (updated 2026-11-08): 35 min = Hot (3 pulses), 45 min = Cold (2 pulses = 10 credit). The washer keeps that credit (shows `5`) until staff pick a course, and the button pressed chooses 35 or 45, so staff do NOT press COLD first: after Activate on a 45-minute washer, a pop-up (`ColdPrompt.tsx`, shown by `App.tsx` once the machine has accepted and `startedAt` is set; commit 6a4b4e8) tells them to press COLD, then Start. The Activate panel (`MachineBoard.tsx`) says "After Activate, a reminder will tell you to press COLD" for 45 min and "Check HOT is selected" for 35 min. Committed as 4ddd49a and pulled onto the Z83 (`git pull` in `C:\LaundroDesk`) on 2026-11-08; the gateway was not running at that time and was started with `Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','C:\LaundroDesk\scripts\windows\run-z83-gateway.generated.ps1'`. Not yet confirmed that it auto-starts after a Z83 reboot. Later the same day commit 4514aef (timer starts when the machine accepts Activate; a `-1` reply counts as a refusal; staff press Start right after) was pulled onto the Z83 and the gateway restarted (closed its window, then ran the same Start-Process command). The gateway's window must stay open: closing it stops the gateway. **Auto-start (2026-11-08):** the Startup-folder launcher never ran after a reboot (Task Manager showed it Enabled but "Not measured"), so the gateway now starts from the registry value `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\LaundroDeskGateway` (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\LaundroDesk\scripts\windows\run-z83-gateway.generated.ps1"`) and the old file was renamed to `LaundroDesk Gateway.cmd.off` in the Startup folder (rename it back and delete the Run value to undo). Still needs a reboot test; it only starts after Windows signs in as `tungz`.

**Update 2026-11-08 on Problem 1.** Washers are **LG Giant C commercial front-loaders, model CWG27MDCRB** (programs Hot, Warm, Cold, Delicates, Add Super Wash, Pre-Clean; coin/card/OPL payment type set in the machine's Setup mode). Washer 3 behaves exactly like Washer 1. Tests on W3 (all got controller reply `1`): `pulse=3` gives 35 with Start LED blinking; `pulse=2` gives 5 (no LED) with pushDelay 60 or 30, with `interval=500` (param likely unread), nothing at pushDelay 200; `pulse=4,pushDelay=30` gives 35; once armed at 35, an extra separate request `pulse=1` does nothing. The OLD APP now also gets 5 on every washer for its 45-minute wash, so this is not our code: the washers' own pulse-to-program/price setting differs from before (owner says nothing changed; physical COLD button gives 45 with a blinking LED, WARM gives 35). No public manual explains the pulse mapping; ask LG Business / the dealer for the CWG27MDCRB service manual and Setup-mode steps for coin value and per-program price. Until fixed, 45 min cannot start automatically; 35 min works on all washers.
**Machine IPs, all confirmed 2026-11-08 by switching each on and scanning with Advanced IP Scanner on the Z83:** Dryer 1 `.6`, Dryer 2 `.7` (5C:CF:7F:0F:A3:65), Dryer 3 `.8` (F4:CF:A2:D2:AA:FD), Dryer 4 `.9` (5C:CF:7F:0F:A0:69), Dryer 5 (Titan) `.36` (58:BF:25:DA:E0:D6), Washer 1 `.11`, 2 `.12`, 3 `.13`, 4 `.14`, 5 `.15` (5C:CF:7F:18:B6:7B). In `tlp_machines` m2, m3, m4, m5, m7, m8, m9 (and m10 = `.36`) still had old `192.168.1.x` addresses; the SQL was given to the owner. Confirm with `select id, name, esp_ip from tlp_machines`.
**Z83 access tip:** TeamViewer to the Z83; clicks on the Windows taskbar are blocked, but a PowerShell window the owner opens can be typed into; use `curl.exe -s "http://<ip>/activate?pulse=N&token=<new number>&pushDelay=60"` with a fresh token each time.

**ROOT CAUSE FOUND 2026-11-08 (Problem 1).** The LG washer counts each pulse as a credit of 5 and starts the course that is currently SELECTED on the washer once credit is at least that course's price. Setup prices (read from W3): COS1 Hot = 15 (3 pulses), COS2 Warm = 10 (2), COS3 Cold = 10 (2), COS4 Delicates = 5 (1). This is exactly the old app's pulse mapping (premium/Hot 3, regular/Warm and more_rinse/Cold 2, quick/Delicates 1). After a power cycle the default selected course is Hot (price 15), so 2 pulses = 10 credit shows `5` (shortfall) and no Start LED; 3 pulses pay for Hot and run the 35-min program. Proof on Washer 1: power off/on, press COLD once (display shows its price `10`), then `curl "http://192.168.210.11/activate?pulse=2&token=<new>&pushDelay=60"` gives 45 min with the Start LED blinking. So the pulse count only adds credit; the COURSE (Hot 35 min, Cold 45 min) must be selected on the washer. The old app worked because the washers still had Cold selected from earlier use. The controller cannot press course buttons. To investigate: does the selected course persist after a cycle ends or only until power-off? Does the washer keep the selection when idle? Options: staff presses COLD/HOT before Activate (POS can show a prompt per order), or find whether a Setup option sets the default course. Setup entry (manual MFL71671218, pp. 25-31): press 1st and 3rd buttons together, password default 3000 (digits: 2nd/3rd change, 4th next), Start; 1st, 2nd, Start for `rgPr`; do not press Start on `ALL` (sets every price). Pulse math: pulses = price / 5. **Persistence test (W1):** power cycle, press COLD, wait 5 minutes idle, `pulse=2` gives `5` again, so the COLD selection is lost within 5 minutes idle and the washer returns to Hot. Manual pp. 24-55 (setup chapter) has no option for the default course or per-course cycle times; Add Super Wash (5th button) adds wash/rinse for extra credit (price `SCPr`, type `SPCt`), and needs a button press too. Still unknown: how short the selection window is (try 30 s / 2 min), and whether the selection survives the end of a real cycle. Practical options: POS shows "Press COLD (45) or HOT (35) on the washer, then Activate" per order, or ask LG/dealer about card-reader (serial) selection since the model is the Card/OPL variant.

**OPEN PROBLEM 2: detecting the physical Start.** In the Pi's access log the ESP's callback `GET /api/remote/confirm-activation/<uuid>/<esp-ip>` (User-Agent ESP8266HTTPClient) arrives about 1 second after each activation. It confirms the activation was accepted, it does NOT mean Start was pressed. So the current listener starts the timer about 1 second after Activate, which the owner does not want. Needs a different signal (or poll the machine / have staff confirm). The Z83 also never got the Pi's address (`.100`), so the callback listener has not actually been exercised.

**Old Raspberry Pi (CSI V3), state at end of session**
- Running again at `192.168.210.100`, Laravel app, MariaDB db `csi_v3`; SD card is the only card for it. SSH exists but the `pi` password is unknown (`2708` was tried, wrong).
- The app's web login breaks whenever a root-owned `storage/logs/laravel-YYYY-MM-DD.log` exists (a root job creates it first). Fix used: delete that day's file from the card (done for 2026-11-01). It will come back; a permanent fix means changing the root crontab user or `.env` `LOG_CHANNEL`.
- Card needed an e2fsck repair after the direct write; now boots and works. Two junk `lost+found` inodes (1477822, 1795245) make e2fsck repeat the same "multiply-claimed blocks" message; harmless. An undo file is kept in the scratchpad (`sdcard*.undo`).
- Avoid more card pulls. Mount with `e2fsprogs` `debugfs`/`e2fsck` on the buffered device (`/dev/diskNs2`, not `rdisk`) as root; the raw device failed to write superblock flags. Never touch the 1 TB `disk2`.
- A full read-only copy (app, whole `csi_v3` database, logs) is in the session scratchpad `.../scratchpad/pi/` (`full-app`, `full-db`, `logs`). It may be gone later; copy anything needed.

**Still to do**
1. Solve the 45-minute pulse behavior (above) and update `pulsesFor()`.
2. Replace the callback-based Start detection with something that really follows the physical Start; until then do not use the live POS for real loads.
3. Update `esp_ip` in Supabase for m2, m3, m7, m8; test Washers 2 and 3 and Dryers 2 and 3, and dryer 30/40 pulses.
4. Z83: give it `192.168.210.100` (router DHCP reservation) and Windows Firewall allow for port 80 only if the callback approach stays; test the gateway auto-start after a reboot (Startup folder has `LaundroDesk Gateway.cmd`; generated script holds the gateway token, never print it).
5. Owner SQL to erase old orders and free machines in Supabase (confirm done); set `LAUNDRODESK_IMPORT_ENABLED=true` when imports should resume.
6. Update the memory file `project_esp-machine-control.md`: its pulse rules are outdated.
7. Git: the index on the Mac keeps showing every file as staged-deleted because the disk is almost full (about 370 MB free). Free space, run `git reset -q`, and commit only specific files. `docs/` is currently untracked.

Useful commands for the Z83:

```powershell
Test-NetConnection 192.168.210.11 -Port 80
curl.exe -i http://192.168.210.11/details
Get-Content C:\LaundroDesk\gateway.log -Tail 30
```

## Things to know
- Every API route checks the caller; the browser only holds the public anon key. All tables have row level security on and no policies (server access only).
- Security headers and an enforced Content Security Policy are in `vercel.json`. A new outside service (analytics, a font host, another API) must be added there or it will be blocked.
- Two people can edit one order at once; writes go through `changeOrder` in `api/_supabase.js`, which retries on a conflict. Use it for any new order write.
- The package name "FULL - CARE EXPRESS" must not be renamed, or LaundroBot orders stop mapping.
