import { useEffect, useRef } from 'react'

type OverlayBridge = {
  setMousePassthrough?: (ignore: boolean) => void
  onClickThrough?: (cb: (enabled: boolean) => void) => void
}

/** Lets header/buttons receive clicks when overlay click-through is enabled. */
export function useOverlayInteraction(cardId = 'card') {
  const clickThroughRef = useRef(false)

  useEffect(() => {
    const overlay = (window as Window & { overlay?: OverlayBridge }).overlay
    if (!overlay?.setMousePassthrough) return

    const card = document.getElementById(cardId)
    if (!card) return

    const syncPassthrough = () => {
      if (!clickThroughRef.current) {
        overlay.setMousePassthrough?.(false)
        return
      }
      overlay.setMousePassthrough?.(!card.matches(':hover'))
    }

    const onEnter = () => overlay.setMousePassthrough?.(false)
    const onLeave = () => syncPassthrough()

    overlay.onClickThrough?.((enabled) => {
      clickThroughRef.current = enabled
      syncPassthrough()
    })

    card.addEventListener('mouseenter', onEnter)
    card.addEventListener('mouseleave', onLeave)
    syncPassthrough()

    return () => {
      card.removeEventListener('mouseenter', onEnter)
      card.removeEventListener('mouseleave', onLeave)
      overlay.setMousePassthrough?.(false)
    }
  }, [cardId])
}
