export type LaunchBrowserResult = { ok?: boolean; error?: string; note?: string; extensionPath?: string }

type OverlayApi = {
  launchBrowserExtension?: () => Promise<LaunchBrowserResult>
}

export async function launchOverlayBrowser(): Promise<LaunchBrowserResult> {
  const api = (window as Window & { overlay?: OverlayApi }).overlay
  if (!api?.launchBrowserExtension) {
    return {
      ok: false,
      error: 'Launch is only available in the Electron app. Run: cd vitt-overlay-electron && npm start'
    }
  }
  return api.launchBrowserExtension()
}

export function launchBrowserMessage(result: LaunchBrowserResult): string {
  if (!result.ok) return result.error || 'Failed to launch Chrome'
  return result.note || 'Opened your default Chrome.'
}
