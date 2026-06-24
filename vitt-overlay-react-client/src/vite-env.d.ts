/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BYPASS_LOGIN?: string
  readonly VITE_SERVER_BASE_URL?: string
  readonly VITE_SCRAPE_WS_URL?: string
  readonly VITE_SCRAPE_HTTP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
