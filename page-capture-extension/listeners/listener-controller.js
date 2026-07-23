import { findListenerForUrl, getListenerById } from './registry.js';
import { waitForMmtPackageReady } from './wait-for-mmt-package-ready.js';

/** @type {{
 *   extractScrapeFromTab: (tabId: number, job: object, onProgress?: (msg: string) => void) => Promise<object>,
 *   ensureBridgeConnected: () => Promise<void>,
 *   sendBridgeEvent: (payload: object) => Promise<{ ok?: boolean } | undefined>,
 *   emitStatus: (job: object, status: string, message: string) => Promise<void>,
 *   devLog: (tag: string, detail?: object) => void,
 *   isExtensionOpenedTab: (tabId: number) => boolean
 * } | null} */
let api = null;

/** @type {Map<number, { listenerId: string, itineraryId: string | null, scraping: boolean, watcherInjected: boolean, generation: number }>} */
const monitoredTabs = new Map();

/** @type {Map<number, ReturnType<typeof setTimeout>>} */
const priceDebounceTimers = new Map();

export function initListenerController(deps) {
  api = deps;
}

export function isMonitoredListenerTab(tabId) {
  return monitoredTabs.has(tabId);
}

function clearPriceDebounce(tabId) {
  const timer = priceDebounceTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    priceDebounceTimers.delete(tabId);
  }
}

function rearmMonitoredTab(tabId, listener, itineraryId) {
  const existing = monitoredTabs.get(tabId);
  const generation = (existing?.generation ?? 0) + 1;

  monitoredTabs.set(tabId, {
    listenerId: listener.id,
    itineraryId,
    scraping: false,
    watcherInjected: false,
    generation
  });

  clearPriceDebounce(tabId);
  return generation;
}

async function injectPriceWatcher(tabId, listener) {
  const state = monitoredTabs.get(tabId);
  if (!state || state.watcherInjected) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [listener.priceWatcherScript]
    });
    state.watcherInjected = true;
    api?.devLog('listener_watcher_injected', { tabId, listenerId: listener.id });
  } catch (error) {
    api?.devLog('listener_watcher_failed', {
      tabId,
      listenerId: listener.id,
      error: error?.message || String(error)
    });
  }
}

async function runListenerScrape(tabId, listener, url, trigger, priceMeta = null, expectedGeneration = null) {
  if (!api) return;

  const state = monitoredTabs.get(tabId);
  if (!state || state.scraping) return;
  if (expectedGeneration != null && state.generation !== expectedGeneration) return;

  state.scraping = true;
  const generation = state.generation;
  const job = listener.buildJob(url, { trigger });

  try {
    api.devLog('listener_scrape_start', {
      tabId,
      listenerId: listener.id,
      trigger,
      jobId: job.jobId,
      url: url.slice(0, 120)
    });

    await api.ensureBridgeConnected();
    await api.emitStatus(job, 'extracting', `Listener scrape (${trigger})`);

    const capture = await api.extractScrapeFromTab(tabId, job, (message) =>
      api.emitStatus(job, 'extracting', message)
    );

    capture.source = job.source;
    const itineraryId = listener.extractItineraryId(url);
    capture.itineraryId = itineraryId;
    capture.listenerMeta = {
      trigger,
      itineraryId,
      price: priceMeta?.price || null,
      slashedPrice: priceMeta?.slashedPrice || null
    };

    await api.sendBridgeEvent({
      type: 'scrape_result',
      jobId: job.jobId,
      resultPhase: 'package_detail',
      source: job.source,
      url,
      extractedUrl: capture.extractedUrl || url,
      itineraryId,
      capture
    });

    api.devLog('listener_scrape_sent', {
      tabId,
      listenerId: listener.id,
      trigger,
      jobId: job.jobId
    });
  } catch (error) {
    api.devLog('listener_scrape_error', {
      tabId,
      listenerId: listener.id,
      trigger,
      error: error?.message || String(error)
    });

    await api.sendBridgeEvent({
      type: 'scrape_error',
      jobId: job.jobId,
      source: job.source,
      url,
      error: error?.message || String(error)
    });
  } finally {
    const current = monitoredTabs.get(tabId);
    if (current && current.generation === generation) {
      current.scraping = false;
    }
  }
}

function schedulePriceChangeScrape(tabId, listener, msg) {
  const debounceMs = listener.priceChangeDebounceMs ?? 3000;
  const expectedGeneration = monitoredTabs.get(tabId)?.generation ?? null;
  clearPriceDebounce(tabId);

  priceDebounceTimers.set(
    tabId,
    setTimeout(() => {
      priceDebounceTimers.delete(tabId);
      const url = msg.url;
      if (!url || !listener.matches(url)) return;
      const state = monitoredTabs.get(tabId);
      if (!state || state.generation !== expectedGeneration) return;
      void runListenerScrape(tabId, listener, url, 'price_change', {
        price: msg.price,
        slashedPrice: msg.slashedPrice
      }, expectedGeneration);
    }, debounceMs)
  );
}

export async function handleListenerTabUpdated(tabId, changeInfo, tab) {
  if (!api) return;

  const url = changeInfo.url || tab.url;
  if (!url || !/^https?:/i.test(url)) return;
  if (api.isExtensionOpenedTab(tabId)) return;

  const listener = findListenerForUrl(url);
  if (!listener) {
    if (monitoredTabs.has(tabId) && changeInfo.url) {
      handleListenerTabRemoved(tabId);
    }
    return;
  }

  if (changeInfo.status === 'loading') {
    if (monitoredTabs.has(tabId)) {
      monitoredTabs.get(tabId).watcherInjected = false;
      clearPriceDebounce(tabId);
    }
    return;
  }

  if (changeInfo.status !== 'complete') return;

  const itineraryId = listener.extractItineraryId(url);
  const isRearm = monitoredTabs.has(tabId);
  const generation = rearmMonitoredTab(tabId, listener, itineraryId);

  api.devLog(isRearm ? 'listener_tab_rearmed' : 'listener_tab_matched', {
    tabId,
    listenerId: listener.id,
    itineraryId,
    generation,
    url: url.slice(0, 120)
  });

  const readyState = await waitForMmtPackageReady(
    tabId,
    listener.packageReadyTimeoutMs ?? 60000,
    listener.packageReadyPollMs ?? 500,
    (message) => api.devLog('listener_package_waiting', { tabId, message })
  );

  api.devLog('listener_package_ready', {
    tabId,
    listenerId: listener.id,
    ready: Boolean(readyState?.ready),
    hasPrice: readyState?.hasPrice,
    tabCount: readyState?.tabCount,
    waitedMs: readyState?.waitedMs
  });

  const state = monitoredTabs.get(tabId);
  if (!state || state.generation !== generation) return;

  await runListenerScrape(tabId, listener, url, 'initial', null, generation);
  await injectPriceWatcher(tabId, listener);
}

export function handleListenerTabRemoved(tabId) {
  monitoredTabs.delete(tabId);
  clearPriceDebounce(tabId);
}

export function handleListenerPriceChange(msg, sender) {
  if (!api || msg?.channel !== 'listener_price_change') return false;

  const tabId = sender.tab?.id;
  if (tabId == null) return false;

  const state = monitoredTabs.get(tabId);
  if (!state) return false;

  const listener = getListenerById(msg.listenerId || state.listenerId);
  if (!listener) return false;

  api.devLog('listener_price_change', {
    tabId,
    listenerId: listener.id,
    reason: msg.reason,
    price: msg.price
  });

  schedulePriceChangeScrape(tabId, listener, msg);
  return true;
}
