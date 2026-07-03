import { useEffect, useState } from 'react'

type OverlayApi = {
  getExtensionBridgeStatus?: () => Promise<{ connected?: boolean }>
  onExtensionBridgeStatus?: (cb: (data: { connected?: boolean }) => void) => () => void
}

function getOverlay(): OverlayApi | undefined {
  return (window as Window & { overlay?: OverlayApi }).overlay
}

/** Extension WebSocket bridge to Electron (Chrome must be open with the extension). */
export function useExtensionBridgeStatus() {
  const [extensionConnected, setExtensionConnected] = useState(false)

  useEffect(() => {
    const overlay = getOverlay()
    if (!overlay?.getExtensionBridgeStatus) return

    const apply = (connected: boolean) => setExtensionConnected(Boolean(connected))

    void overlay.getExtensionBridgeStatus().then((status) => {
      apply(Boolean(status?.connected))
    })

    const unsub = overlay.onExtensionBridgeStatus?.((data) => {
      apply(Boolean(data?.connected))
    })

    return () => unsub?.()
  }, [])

  return extensionConnected
}
