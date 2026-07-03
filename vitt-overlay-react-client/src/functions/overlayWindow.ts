type OverlayWindowApi = {
  quitApp?: () => void
  minimizeApp?: () => void
}

type ElectronApi = {
  ipcRenderer?: { send: (channel: string, payload: unknown) => void }
}

function getOverlay(): OverlayWindowApi | undefined {
  return (window as Window & { overlay?: OverlayWindowApi }).overlay
}

function getElectronIpc(): ElectronApi['ipcRenderer'] | undefined {
  return (window as Window & { electronAPI?: ElectronApi }).electronAPI?.ipcRenderer
}

export function quitOverlayWindow(): boolean {
  const overlay = getOverlay()
  if (overlay?.quitApp) {
    overlay.quitApp()
    return true
  }
  const ipc = getElectronIpc()
  if (ipc) {
    ipc.send('close-app', undefined)
    return true
  }
  return false
}

export function minimizeOverlayWindow(): boolean {
  const overlay = getOverlay()
  if (overlay?.minimizeApp) {
    overlay.minimizeApp()
    return true
  }
  const ipc = getElectronIpc()
  if (ipc) {
    ipc.send('minimize-app', undefined)
    return true
  }
  return false
}
