type ExtensionPathInfo = { path?: string; exists?: boolean }

type OverlayInstallApi = {
  getExtensionPath?: () => Promise<ExtensionPathInfo>
  revealExtensionFolder?: () => Promise<{ ok?: boolean; path?: string; error?: string }>
}

function overlayApi(): OverlayInstallApi | undefined {
  return (window as Window & { overlay?: OverlayInstallApi }).overlay
}

export async function fetchExtensionPath(): Promise<string | null> {
  const info = await overlayApi()?.getExtensionPath?.()
  return info?.path || null
}

export async function revealExtensionFolder(): Promise<boolean> {
  const result = await overlayApi()?.revealExtensionFolder?.()
  return Boolean(result?.ok)
}

export async function copyExtensionPath(): Promise<string | null> {
  const extensionPath = await fetchExtensionPath()
  if (!extensionPath) return null
  await navigator.clipboard.writeText(extensionPath)
  return extensionPath
}

export const MANUAL_EXTENSION_STEPS = [
  'Open your signed-in Chrome (the one you use daily).',
  'Go to chrome://extensions',
  'Turn on Developer mode (top-right).',
  'Click Load unpacked.',
  'Select the page-capture-extension folder (copy path below).',
  'Pin Vitt Page Capture from the puzzle icon in the toolbar.',
  'Click the extension → Capture and send on any page.'
] as const

export const LAUNCH_CHROME_CAVEAT =
  'Opens your default Chrome on this machine (Windows, Mac, or Linux) using your existing signed-in profile.'
