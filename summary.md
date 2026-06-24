# Conversation Summary — Vitt Overlay Page Capture

This document summarizes the design discussions and implementation decisions from our conversation about integrating browser page capture with the Vitt Overlay project and MakeMyTrip-style scrape data.

---

## 1. Starting point

Two related pieces were compared:

| Piece | Location | Purpose |
|-------|----------|---------|
| **Browser extension** | `webpage-capture-widget` (later merged as `page-capture-extension/`) | User-click capture of rendered HTML/text from the current page |
| **Scrape output** | `scrap-data/scrape_goa.json`, `summary_goa.json`, etc. | Structured MakeMyTrip package data (listing + detail with itinerary tabs) |

**Conclusion:** The extension alone does **not** produce `scrape_goa.json` out of the box. It captures raw page content. Structured JSON requires a **parser** plus (for full detail) navigation to package detail pages and tab content.

---

## 2. Extension vs `scrap-data` formats

### `summary_goa.json` (listing level)

Fields: `name`, `duration`, `duration_details`, `features`, `price`, `detail_url`

From a **listing page capture** (e.g. `b5d5c89a-702f-485e-a474-95e32c4e7f1f.json`, Puducherry search):

| Field | Extractable? |
|-------|----------------|
| Destination key (from URL) | Yes |
| `name`, `duration`, `features`, `price` | Yes (~6/6 visible packages) |
| `duration_details` | Partial (split `2N City` lines from features) |
| `detail_url` | No (MMT uses JS navigation, no `/package?id=` in capture) |

**~85% parity** with `summary_goa.json` from one listing capture.

### `scrape_goa.json` (full detail)

Includes `package_options`, `tabs.itinerary.days[]`, `tabs.policies`, `tabs.summary`, etc.

**0% from a listing capture alone** — requires separate **detail page** captures with tabs opened.

---

## 3. Parser design (not yet implemented)

Recommended pipeline:

```text
Extension/capture (html + text)
  → Page router (listing vs detail URL)
  → Listing parser OR Detail parser
  → Merger
  → scrap-data JSON shape
```

- **Listing parser:** regex or DOM on `packageCard` blocks; text line parser also works.
- **Detail parser:** validate page title, split itinerary days (`Day N`, `FLIGHT`, `HOTEL`, etc.), policies/summary sections.
- **Merger:** match listing + detail by name or URL id.

Parser should be **pure** (html/text in → JSON out); rendering is done by the browser/extension.

---

## 4. Container-scoped capture

**Question:** Can the extension extract only a container (`#id` or `.class`)?

- **Current original extension:** No — full page only.
- **Feasible:** Yes — inject script with `document.querySelector(selector)`, capture that subtree’s `innerHTML` / `innerText`.
- **Caveats:** lazy-loaded cards must already be in DOM; prefer `#id` over `.class`; screenshot still captures full viewport.

`injected/scrape-runner.js` supports an optional `selector` for scoped capture.

---

## 5. Automation without clicking the extension

| Approach | User click needed? | Full automation? |
|----------|-------------------|------------------|
| Original popup click | Yes | No |
| Content script auto-capture | No (if page open) | Partial |
| Server-driven + Electron bridge | No | Yes (with Chrome open) |
| Playwright / CDP | No | Yes (headless possible) |

For MMT lazy-loaded listings: **Chrome window should stay open and not minimized** during scrape jobs.

---

## 6. Scroll until stable

Extension can automatically:

1. Scroll to bottom (window or inner container)
2. Wait 3–5 seconds
3. Compare `scrollHeight` or card count (e.g. `[class*="packageCard"]`)
4. Repeat until no growth (optionally require 2 stable rounds)
5. Then extract

This addresses the **6 of 8 packages** gap when cards load below the fold.

---

## 7. Parallel multi-page scraping

- Extension can run **multiple tabs** with a job queue and concurrency limit (default 3).
- Server pushes URLs → queue → workers; second URL waits or runs in parallel depending on cap.
- One tab cannot capture multiple URLs simultaneously; use multiple tabs or sequential navigation.

---

## 8. Architecture evolution

### Initial implementation (superseded)

- Separate `vitt-overlay-server` on port **8765**
- Extension and React Scrape tab connected **directly** to 8765
- Electron only launched Chrome

### Target architecture (implemented)

User requirement:

```text
Server (:5000/ws)
  → React (existing overlay WebSocket — do NOT change overlay message types)
  → Electron
  → Extension (scroll + extract)
  → Electron
  → React
  → Server (:5000/ws)
```

- **`vitt-overlay-server`** = local replica of AWS backend on **`localhost:5000`**
- Overlay WS messages **unchanged:** `client-init`, `chat-with-ai`, `data-info-update-req`, `room-update`, `recall-buffer`, `generate-filler` (+ stub responses for local dev)
- **Scrape messages added** on the same `/ws` connection

---

## 9. What was implemented

### `vitt-overlay-server/` (port 5000)

- WebSocket `/ws` — overlay stubs + scrape job queue
- HTTP: `/health`, `/api/scrape`, `/api/jobs`, `/login-post` stub
- Sends `scrape_request` to React clients; receives `scrape_status`, `scrape_result`, `scrape_error`
- Persists captures to `captures/`

### `page-capture-extension/`

- Scroll-until-stable + HTML/text extraction
- Connects to **Electron bridge** (`http://127.0.0.1:38771`), not directly to `:5000`
- Polls for jobs, posts status/results

### `vitt-overlay-electron/`

- `browserCapture.js` — launch Chrome with extension
- `extensionBridge.js` — HTTP bridge for extension ↔ main process
- IPC: `scrape-start`, `onScrapeBridgeEvent`, `launch-browser-extension`

### `vitt-overlay-react-client/`

- **Chrome icon** in header → launch browser + open Scrape tab
- **Scrape tab** — live job flow, queue URLs
- **Additive only** in `App.tsx`: scrape handlers appended to existing `onmessage`; bridge listener forwards results on same WS
- `useScrapeMonitor` uses events (no second WebSocket to 8765)

---

## 10. Scrape WebSocket message types

| Direction | Type | Purpose |
|-----------|------|---------|
| Server → React | `scrape_request` | URL + job options to scrape |
| Server → React | `job_update` | Job status for UI |
| React → Server | `request_scrape` | Queue URLs from Scrape tab |
| React → Server | `scrape_status` | loading / scrolling / extracting |
| React → Server | `scrape_result` | Final capture + **extractedUrl** |
| React → Server | `scrape_error` | Failure |

---

## 11. How to run

```bash
# Terminal 1
cd vitt-overlay-server && npm install && npm start

# Terminal 2
cd vitt-overlay-react-client && npm run dev

# Terminal 3
cd vitt-overlay-electron && npm start
```

1. Click **Chrome icon** in overlay header.
2. Open **Scrape** tab — confirm Server + Extension status.
3. Queue URLs in UI, or:

```bash
curl -X POST http://127.0.0.1:5000/api/scrape \
  -H 'Content-Type: application/json' \
  -d '{"urls":["https://holidayz.makemytrip.com/holidays/india/search?dest=Goa"]}'
```

See also [PAGE-CAPTURE.md](./PAGE-CAPTURE.md) for protocol details.

---

## 12. Not done yet (future work)

- [ ] **MMT parser** — convert captures → `summary_goa.json` / `scrape_goa.json` shape
- [ ] **Container selector UI** in extension/overlay
- [ ] **Auto-start** `vitt-overlay-server` from Electron
- [ ] **Detail page workflow** — server sends listing + detail URLs; tab clicks for itinerary/policies/summary
- [ ] Richer overlay stubs matching production AWS responses (transcript, AI, data_info)

---

## 13. Key files

| Path | Role |
|------|------|
| `requirements.txt` | Original feature requirements |
| `vitt-overlay-server/src/index.js` | Local :5000 server |
| `page-capture-extension/` | Chrome extension |
| `vitt-overlay-electron/extensionBridge.js` | Extension ↔ Electron |
| `vitt-overlay-react-client/src/App.tsx` | Overlay + scrape WS bridge |
| `vitt-overlay-react-client/src/components/ScrapePanel.tsx` | Scrape UI |
| `scrap-data/` | Target JSON format examples |
| `b5d5c89a-702f-485e-a474-95e32c4e7f1f.json` | Sample extension capture (listing) |
| `captures/` | Runtime scrape output from server |

---

## 14. One-line takeaway

**Extension captures raw HTML; parser + server-driven jobs through React/Electron produce structured travel data; `vitt-overlay-server` on `:5000` orchestrates scrape while leaving existing overlay WebSocket behavior intact.**
