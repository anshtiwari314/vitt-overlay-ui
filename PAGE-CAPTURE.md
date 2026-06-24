# Page capture pipeline

Local dev server (`vitt-overlay-server`) replicates AWS on **`localhost:5000`**.  
Overlay WS messages (`client-init`, `chat-with-ai`, etc.) are unchanged. Scrape uses the same `/ws` connection.

## Flow

```text
Server :5000/ws  →  React (existing WS)
                 →  Electron IPC (scrape-start)
                 →  Extension bridge :38771
                 →  Chrome extension (scroll + extract)
                 →  Electron  →  React  →  Server :5000/ws
```

## Run

```bash
cd vitt-overlay-server && npm start          # :5000
cd vitt-overlay-react-client && npm run dev  # :5174
cd vitt-overlay-electron && npm start
```

1. Header **Chrome icon** — launch browser + extension  
2. **Scrape** tab — queue URLs or `POST http://127.0.0.1:5000/api/scrape`

## Scrape WS messages (additive)

| Direction | Type |
|-----------|------|
| Server → React | `scrape_request`, `job_update` |
| React → Server | `request_scrape`, `scrape_status`, `scrape_result`, `scrape_error` |

Captures saved to `captures/`.
