# Page capture pipeline

Merged from `webpage-capture-widget` + Vitt Overlay automated scrape.

## Two capture modes

| Mode | Trigger | Destination |
|------|---------|---------------|
| **Manual** | Pin extension → click toolbar icon → **Capture and send** | `POST http://127.0.0.1:5000/api/capture` |
| **Automated** | Scrape tab queues URLs (or `POST /api/scrape`) | Extension bridge → scroll + extract → server |

Both save to `captures/`.

## Flow

```text
Manual:
  Browser extension popup  →  vitt-overlay-server :5000/api/capture  →  captures/

Automated:
  Server :5000/ws  →  React  →  Electron IPC  →  WebSocket ws://127.0.0.1:38772  →  Extension
  Extension scrapes  →  Electron  →  React (WS)  →  Server  →  captures/

Every 2 minutes the server auto-queues a hardcoded URL (override with `VITT_SCHEDULED_SCRAPE_URL`).
Requires react + electron + extension all running and connected.
```

## Manual install (signed-in Chrome — recommended)

The **Launch Chrome** button opens a **separate guest profile** (`~/.vitt-chrome-capture`) — not your daily signed-in Chrome. If Chrome is already running, `--load-extension` is ignored and the extension will not appear.

Use **Load unpacked** once in your normal Chrome:

1. Open **your signed-in Chrome**
2. Go to `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `page-capture-extension` folder  
   (In overlay: Scrape tab → **Copy folder path** or **Open folder**)
5. **Pin** Vitt Page Capture (puzzle icon → pin)
6. Click extension → **Capture and send**

Captures post to `http://127.0.0.1:5000/api/capture`. You only need to do this once per Chrome profile.

## Run

```bash
cd vitt-overlay-server && npm start          # :5000 — required for manual + automated
cd vitt-overlay-react-client && npm run dev  # :5174
cd vitt-overlay-electron && npm start
```

1. Header **Chrome icon** — launches Chrome with `page-capture-extension` loaded (`--load-extension`, same effect as README **Load unpacked**).
2. Pin **Vitt Page Capture** in Chrome.
3. Open any page → extension icon → **Capture and send**.
4. **Scrape** tab — queue URLs for automated scroll-and-extract.

## Extension connection settings

| Setting | Default | Purpose |
|---------|---------|---------|
| Vitt overlay server | `http://127.0.0.1:5000` | Manual popup POST target |
| Local pairing token | `vitt-local-capture-token` | Must match server `VITT_CAPTURE_TOKEN` |
| Electron bridge WebSocket | `ws://127.0.0.1:38772` | Automated scrape jobs (instant push) |

## Manual capture API

`POST /api/capture`

Headers: `Content-Type: application/json`, `X-Capture-Token: vitt-local-capture-token`

Body: capture object (`url`, `html`, `text`, `title`, …) — same shape as `webpage-capture-widget`.

Response: `{ ok, deliveryId, file }` — also broadcasts `capture_received` on overlay WebSocket.

## Extension ↔ Electron WebSocket (automated scrape)

| Direction | Message type | Purpose |
|-----------|--------------|---------|
| Electron → Extension | `scrape_job` | Push scrape job instantly (no polling) |
| Electron → Extension | `ping` | Keepalive |
| Extension → Electron | `extension_ready` | Handshake on connect |
| Extension → Electron | `pong` | Keepalive reply |
| Extension → Electron | `job_status`, `scrape_result`, `scrape_error` | Progress and results |

Default bridge: `ws://127.0.0.1:38772` (override with `VITT_EXTENSION_BRIDGE_WS_PORT`).

Overlay → extension custom commands: Electron IPC `extension-send-command` / `overlay.sendExtensionCommand(payload)`.

## Scrape WS messages (additive)

| Direction | Type |
|-----------|------|
| Server → React | `scrape_request`, `job_update`, `capture_received` |
| React → Server | `request_scrape`, `scrape_status`, `scrape_result`, `scrape_error` |

Captures saved to `captures/`.
