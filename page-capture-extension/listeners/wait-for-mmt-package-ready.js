/** Poll until MMT package detail SPA renders price + main tabs. */
export async function waitForMmtPackageReady(tabId, timeoutMs = 60000, pollIntervalMs = 500, onProgress) {
  const startedAt = Date.now();
  let lastProgressAt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    let state = null;
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const priceEl = document.querySelector('.pakageDtlWrap .priceDetail span');
          const priceText = (priceEl?.textContent || '').trim();
          const hasPrice = priceText.length > 0 && /[\d₹]/.test(priceText);

          const mainTabs = document.querySelectorAll('#tabItem .mainTabItem, .mainTab .mainTabItem');
          const tabCount = mainTabs.length;

          const packageWrap = Boolean(document.querySelector('.pakageDtlWrap'));

          return {
            ready: hasPrice && tabCount > 0,
            hasPrice,
            tabCount,
            packageWrap,
            priceText: priceText.slice(0, 32)
          };
        }
      });
      state = injection?.result;
    } catch {
      state = null;
    }

    if (state?.ready) {
      return { ...state, ready: true, waitedMs: Date.now() - startedAt };
    }

    if (onProgress && Date.now() - lastProgressAt >= 2500) {
      lastProgressAt = Date.now();
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      const maxSec = Math.round(timeoutMs / 1000);
      void onProgress(`Waiting for package page (${elapsedSec}s / ${maxSec}s)`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return { ready: false, waitedMs: Date.now() - startedAt };
}
