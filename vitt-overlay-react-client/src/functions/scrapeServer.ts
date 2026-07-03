export type ScrapeJobStatus =
  | 'queued'
  | 'loading'
  | 'scrolling'
  | 'extracting'
  | 'running'
  | 'done'
  | 'error'

export type ScrapeJob = {
  jobId: string
  url: string
  status: ScrapeJobStatus
  message: string
  scrollUntilStable?: boolean
  selector?: string | null
  createdAt?: string
  updatedAt?: string
  extractedUrl?: string | null
  error?: string | null
  hasCapture?: boolean
}

export const DEFAULT_SCRAPE_WS =
  (import.meta.env.VITE_SCRAPE_WS_URL?.trim()) || 'ws://127.0.0.1:5000/ws'

export const DEFAULT_SCRAPE_HTTP =
  (import.meta.env.VITE_SCRAPE_HTTP_URL?.trim()) || 'http://127.0.0.1:5000'

export const SCRAPE_QUEUE_EVENT = 'vitt-scrape-queue-request'
export const SCRAPE_JOB_UPDATE_EVENT = 'vitt-scrape-job-update'
export const SCRAPE_EXTENSION_STATUS_EVENT = 'vitt-scrape-extension-status'
export const SCRAPE_LAST_EVENT = 'vitt-scrape-last-event'
