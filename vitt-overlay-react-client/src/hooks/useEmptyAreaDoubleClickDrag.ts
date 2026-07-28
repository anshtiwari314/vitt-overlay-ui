import { useEffect, useRef, type RefObject } from 'react'

export const LIST_DRAG_ARMED_CLASS = 'list-drag-armed'

const CONTENT_SELECTOR = [
  '.transcription-card',
  '.transcription-card *',
  '.chat-message-out',
  '.chat-message-in',
  '.chat-message-with-copy',
  '.chat-message-with-copy *',
  '.prompt-empty',
  '.prompt-empty *',
  '.chat-loading',
  '.chat-loading *',
  '.new-messages-indicator',
  'button',
  'a',
  'input',
  'textarea',
  'select',
].join(', ')

type OverlayDragApi = {
  startWindowDrag?: () => void
  moveWindowDrag?: () => void
  stopWindowDrag?: () => void
}

function getOverlayDragApi(): OverlayDragApi | undefined {
  return (window as Window & { overlay?: OverlayDragApi }).overlay
}

function isEmptyScrollArea(scrollEl: HTMLElement, target: EventTarget | null): boolean {
  if (!target || !(target instanceof Node)) return false
  if (!scrollEl.contains(target)) return false
  if (target !== scrollEl && (target as Element).closest?.(CONTENT_SELECTOR)) return false
  return true
}

/**
 * Double-click empty space in transcript / AI-assist lists arms a drag shield.
 * The next press-and-drag moves the Electron window via IPC (setPosition).
 */
export function useEmptyAreaDoubleClickDrag(containerRef: RefObject<HTMLElement | null>) {
  const armedRef = useRef(false)
  const draggingRef = useRef(false)
  const listContainerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scrollEl = container.querySelector('.content-list, .chat-messages') as HTMLElement | null
    const shield = container.querySelector('.list-drag-shield') as HTMLElement | null
    if (!scrollEl || !shield) return

    listContainerRef.current = container.closest('.list-container') as HTMLElement | null
    const overlay = getOverlayDragApi()

    const setArmed = (armed: boolean) => {
      armedRef.current = armed
      draggingRef.current = false
      container.classList.toggle(LIST_DRAG_ARMED_CLASS, armed)
      listContainerRef.current?.classList.toggle(LIST_DRAG_ARMED_CLASS, armed)
    }

    const disarm = () => setArmed(false)

    const onDoubleClick = (e: MouseEvent) => {
      if (!isEmptyScrollArea(scrollEl, e.target)) return
      setArmed(true)
    }

    const onMouseMove = () => {
      if (!draggingRef.current) return
      overlay?.moveWindowDrag?.()
    }

    const stopDrag = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      window.removeEventListener('mousemove', onMouseMove)
      overlay?.stopWindowDrag?.()
      disarm()
    }

    const onShieldMouseDown = () => {
      if (!armedRef.current) return
      draggingRef.current = true
      overlay?.startWindowDrag?.()
      window.addEventListener('mousemove', onMouseMove)
    }

    const onMouseUp = () => {
      stopDrag()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draggingRef.current) {
          overlay?.stopWindowDrag?.()
          draggingRef.current = false
          window.removeEventListener('mousemove', onMouseMove)
        }
        if (armedRef.current) disarm()
      }
    }

    scrollEl.addEventListener('dblclick', onDoubleClick)
    shield.addEventListener('mousedown', onShieldMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      scrollEl.removeEventListener('dblclick', onDoubleClick)
      shield.removeEventListener('mousedown', onShieldMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
      overlay?.stopWindowDrag?.()
      disarm()
    }
  }, [containerRef])
}
