import { useEffect, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'

export type OverlayBridge = {
  resizeWindow?: (p: { widthPct?: number; heightPct?: number; width?: number; height?: number }) => void
  toggleFullscreen?: () => void
  getWindowSize?: () => Promise<{ width: number; height: number } | null>
  onWindowResized?: (cb: (size: { width: number; height: number }) => void) => () => void
}

const WINDOW_SIZE_PRESETS: { label: string; widthPct?: number; heightPct?: number; width?: number; height?: number }[] = [
  { label: 'Default', width: 280, height: 380 },
  { label: 'Expanded', width: 430, height: 765 },
  { label: 'Compact', width: 560, height: 765 },
  { label: 'Standard', width: 996, height: 787 },
  { label: 'Large', widthPct: 0.85, heightPct: 0.9 }
]

export default function WindowResizeButton() {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const overlay = (window as unknown as { overlay?: OverlayBridge }).overlay

  useEffect(() => {
    if (overlay?.getWindowSize) {
      overlay.getWindowSize().then(s => setSize(s)).catch(() => {})
    }
    if (overlay?.onWindowResized) {
      const unsubscribe = overlay.onWindowResized((newSize) => setSize(newSize))
      return () => unsubscribe()
    }
  }, [overlay])

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setOpen(false), 150)
  }

  const onClick = () => {
    overlay?.toggleFullscreen?.()
    setOpen(false)
  }

  const applyPreset = (p: typeof WINDOW_SIZE_PRESETS[0]) => {
    overlay?.resizeWindow?.({ widthPct: p.widthPct, heightPct: p.heightPct, width: p.width, height: p.height })
    setOpen(false)
  }

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <div
      className="win-resize-wrap"
      onMouseEnter={() => { cancelClose(); setOpen(true) }}
      onMouseLeave={scheduleClose}
    >
      <button type="button" className="btn-icon" onClick={onClick} title="Resize / Fullscreen">
        <Maximize2 size={18} />
      </button>
      {open && (
        <div
          className="win-resize-menu"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {size && (
            <>
              <div className="win-resize-menu-item" style={{ cursor: 'default', background: 'transparent' }}>
                <span>Current</span>
                <span className="dim">{size.width} × {size.height}</span>
              </div>
              <div className="win-resize-menu-divider" />
            </>
          )}
          {WINDOW_SIZE_PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              className="win-resize-menu-item"
              onClick={() => applyPreset(p)}
            >
              <span>{p.label}</span>
              <span className="dim">
                {p.width && p.height
                  ? `${p.width} × ${p.height}`
                  : `${Math.round((p.widthPct || 0) * 100)}% × ${Math.round((p.heightPct || 0) * 100)}%`}
              </span>
            </button>
          ))}
          <div className="win-resize-menu-divider" />
          <button
            type="button"
            className="win-resize-menu-item"
            onClick={() => { overlay?.toggleFullscreen?.(); setOpen(false) }}
          >
            <span>Fullscreen</span>
            <span className="dim">toggle</span>
          </button>
        </div>
      )}
    </div>
  )
}
