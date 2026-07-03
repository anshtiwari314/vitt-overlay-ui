import { useCallback, useEffect, useState } from 'react'
import type { ScrapeJob } from '../functions/scrapeServer'
import {
  SCRAPE_EXTENSION_STATUS_EVENT,
  SCRAPE_JOB_UPDATE_EVENT,
  SCRAPE_LAST_EVENT,
  SCRAPE_QUEUE_EVENT
} from '../functions/scrapeServer'
import { launchBrowserMessage, launchOverlayBrowser } from '../functions/overlayBrowser'
import { copyExtensionPath, fetchExtensionPath, revealExtensionFolder } from '../functions/extensionInstall'

type OverlayApi = {
  getExtensionBridgeStatus?: () => Promise<{ connected?: boolean }>
  onExtensionBridgeStatus?: (cb: (data: { connected?: boolean }) => void) => () => void
}

type ScrapeMonitorState = {
  connected: boolean
  extensionConnected: boolean
  jobs: ScrapeJob[]
  lastEvent: string | null
  launchMessage: string | null
  extensionPath: string | null
  pathCopied: boolean
}

function getOverlay(): OverlayApi | undefined {
  return (window as Window & { overlay?: OverlayApi }).overlay
}

export function useScrapeMonitor(serverConnected: boolean) {
  const [state, setState] = useState<ScrapeMonitorState>({
    connected: false,
    extensionConnected: false,
    jobs: [],
    lastEvent: null,
    launchMessage: null,
    extensionPath: null,
    pathCopied: false
  })

  useEffect(() => {
    void fetchExtensionPath().then((p) => {
      if (p) setState((prev) => ({ ...prev, extensionPath: p }))
    })
  }, [])

  useEffect(() => {
    setState((prev) => ({ ...prev, connected: serverConnected }))
  }, [serverConnected])

  // Extension pill: fetch Electron's stored variable on load, then listen for IPC pushes.
  useEffect(() => {
    const overlay = getOverlay()
    if (!overlay?.getExtensionBridgeStatus) return

    const applyExtensionConnected = (connected: boolean) => {
      setState((prev) => ({ ...prev, extensionConnected: connected }))
      window.dispatchEvent(
        new CustomEvent(SCRAPE_EXTENSION_STATUS_EVENT, { detail: { connected } })
      )
    }

    void overlay.getExtensionBridgeStatus().then((status) => {
      applyExtensionConnected(Boolean(status?.connected))
    })

    const unsubStatus = overlay.onExtensionBridgeStatus?.((data) => {
      applyExtensionConnected(Boolean(data?.connected))
    })

    return () => unsubStatus?.()
  }, [])

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

    const onLast = (event: Event) => {
      const text = (event as CustomEvent<string>).detail
      if (text) setState((prev) => ({ ...prev, lastEvent: text }))
    }

    window.addEventListener(SCRAPE_JOB_UPDATE_EVENT, onJob)
    window.addEventListener(SCRAPE_LAST_EVENT, onLast)

    return () => {
      window.removeEventListener(SCRAPE_JOB_UPDATE_EVENT, onJob)
      window.removeEventListener(SCRAPE_LAST_EVENT, onLast)
    }
  }, [])

  const launchBrowser = useCallback(async () => {
    try {
      const result = await launchOverlayBrowser()
      setState((prev) => ({
        ...prev,
        launchMessage: launchBrowserMessage(result)
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

  const copyPath = useCallback(async () => {
    const p = await copyExtensionPath()
    if (p) {
      setState((prev) => ({ ...prev, extensionPath: p, pathCopied: true }))
      window.setTimeout(() => setState((prev) => ({ ...prev, pathCopied: false })), 2000)
    }
  }, [])

  const openExtensionFolder = useCallback(async () => {
    await revealExtensionFolder()
  }, [])

  return { ...state, launchBrowser, queueUrls, copyPath, openExtensionFolder }
}
