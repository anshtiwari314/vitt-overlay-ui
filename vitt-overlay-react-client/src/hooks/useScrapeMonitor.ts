import { useCallback, useEffect, useState } from 'react'
import type { ScrapeJob } from '../functions/scrapeServer'
import {
  SCRAPE_EXTENSION_STATUS_EVENT,
  SCRAPE_JOB_UPDATE_EVENT,
  SCRAPE_LAST_EVENT,
  SCRAPE_QUEUE_EVENT
} from '../functions/scrapeServer'

type ScrapeMonitorState = {
  connected: boolean
  extensionConnected: boolean
  jobs: ScrapeJob[]
  lastEvent: string | null
  launchMessage: string | null
}

export function useScrapeMonitor(serverConnected: boolean) {
  const [state, setState] = useState<ScrapeMonitorState>({
    connected: false,
    extensionConnected: false,
    jobs: [],
    lastEvent: null,
    launchMessage: null
  })

  useEffect(() => {
    setState((prev) => ({ ...prev, connected: serverConnected }))
  }, [serverConnected])

  useEffect(() => {
    const onJob = (event: Event) => {
      const job = (event as CustomEvent<ScrapeJob>).detail
      if (!job?.jobId) return
      setState((prev) => {
        const idx = prev.jobs.findIndex((j) => j.jobId === job.jobId)
        const jobs = idx >= 0
          ? prev.jobs.map((j, i) => (i === idx ? { ...j, ...job } : j))
          : [job, ...prev.jobs]
        return { ...prev, jobs }
      })
    }

    const onExtension = (event: Event) => {
      const connected = Boolean((event as CustomEvent<{ connected: boolean }>).detail?.connected)
      setState((prev) => ({ ...prev, extensionConnected: connected }))
    }

    const onLast = (event: Event) => {
      const text = (event as CustomEvent<string>).detail
      if (text) setState((prev) => ({ ...prev, lastEvent: text }))
    }

    window.addEventListener(SCRAPE_JOB_UPDATE_EVENT, onJob)
    window.addEventListener(SCRAPE_EXTENSION_STATUS_EVENT, onExtension)
    window.addEventListener(SCRAPE_LAST_EVENT, onLast)

    const overlay = (window as Window & {
      overlay?: { onScrapeBridgeEvent?: (cb: (d: unknown) => void) => () => void }
    }).overlay

    const unsubBridge = overlay?.onScrapeBridgeEvent?.((payload: unknown) => {
      const msg = payload as { type?: string; connected?: boolean }
      if (msg.type === 'extension_status') {
        window.dispatchEvent(new CustomEvent(SCRAPE_EXTENSION_STATUS_EVENT, { detail: { connected: msg.connected } }))
      }
    })

    return () => {
      window.removeEventListener(SCRAPE_JOB_UPDATE_EVENT, onJob)
      window.removeEventListener(SCRAPE_EXTENSION_STATUS_EVENT, onExtension)
      window.removeEventListener(SCRAPE_LAST_EVENT, onLast)
      unsubBridge?.()
    }
  }, [])

  const launchBrowser = useCallback(async () => {
    try {
      const api = (window as Window & { overlay?: { launchBrowserExtension?: () => Promise<{ ok?: boolean; error?: string }> } }).overlay
      if (!api?.launchBrowserExtension) {
        setState((prev) => ({
          ...prev,
          launchMessage: 'Launch is only available in the Electron app.'
        }))
        return
      }
      const result = await api.launchBrowserExtension()
      setState((prev) => ({
        ...prev,
        launchMessage: result.ok
          ? 'Chrome opened with Vitt Page Capture extension loaded.'
          : (result.error || 'Failed to launch Chrome')
      }))
    } catch (e) {
      setState((prev) => ({
        ...prev,
        launchMessage: e instanceof Error ? e.message : 'Launch failed'
      }))
    }
  }, [])

  const queueUrls = useCallback(async (urls: string[], options?: { concurrency?: number }) => {
    const list = urls.map((u) => u.trim()).filter(Boolean)
    if (!list.length) return

    window.dispatchEvent(new CustomEvent(SCRAPE_QUEUE_EVENT, {
      detail: { urls: list, concurrency: options?.concurrency ?? 3 }
    }))
  }, [])

  return { ...state, launchBrowser, queueUrls }
}
