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
  const wrapRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggleMenu = () => setOpen((prev) => !prev)

  const applyPreset = (p: typeof WINDOW_SIZE_PRESETS[0]) => {
    overlay?.resizeWindow?.({ widthPct: p.widthPct, heightPct: p.heightPct, width: p.width, height: p.height })
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`win-resize-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`btn-icon${open ? ' active' : ''}`}
        onClick={toggleMenu}
        onMouseDown={(e) => e.stopPropagation()}
        title="Overlay size"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Maximize2 size={18} />
      </button>
      {open && (
        <div className="win-resize-menu" role="menu">
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
              role="menuitem"
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
            role="menuitem"
            onClick={() => {
              overlay?.toggleFullscreen?.()
              setOpen(false)
            }}
          >
            <span>Fullscreen</span>
            <span className="dim">toggle</span>
          </button>
        </div>
      )}
    </div>
  )
}
