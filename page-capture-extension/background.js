import {
  initListenerController,
  handleListenerTabUpdated,
  handleListenerTabRemoved,
  handleListenerPriceChange
} from './listeners/listener-controller.js';
import { initDiyPlannerHandler, handleSaveItineraryId } from './listeners/diy-planner-handler.js';

const DEFAULT_BRIDGE_WS = 'ws://127.0.0.1:38772';

const DEFAULT_CONCURRENCY = 3;

const OFFSCREEN_URL = 'offscreen.html';
const KEEPALIVE_ALARM_SEC = 5;



let bridgeWsUrl = DEFAULT_BRIDGE_WS;

let concurrency = DEFAULT_CONCURRENCY;



/** @type {Array<object>} */

const queue = [];

let activeWorkers = 0;

/** Tabs opened by automated scrape jobs — skip passive URL listeners on these. */
const extensionOpenedTabIds = new Set();

function markExtensionOpenedTab(tabId) {
  if (tabId != null) extensionOpenedTabIds.add(tabId);
}

function isExtensionOpenedTab(tabId) {
  return extensionOpenedTabIds.has(tabId);
}

function normalizeBridgeWsUrl(input) {

  let url = (input || DEFAULT_BRIDGE_WS).trim().replace(/\/$/, '');

  if (url.startsWith('http://')) url = `ws://${url.slice(7)}`;

  if (url.startsWith('https://')) url = `wss://${url.slice(8)}`;

  if (!url.startsWith('ws')) url = DEFAULT_BRIDGE_WS;

  return url.replace(':38771', ':38772');

}



async function loadSettings() {

  const saved = await chrome.storage.local.get({

    bridgeUrl: DEFAULT_BRIDGE_WS,

    concurrency: DEFAULT_CONCURRENCY

  });

  bridgeWsUrl = normalizeBridgeWsUrl(saved.bridgeUrl);

  concurrency = saved.concurrency || DEFAULT_CONCURRENCY;

}



function setConnectionStatus(connected) {

  void chrome.storage.local.set({

    connectionStatus: connected ? 'connected' : 'disconnected',

    lastConnectedAt: connected ? new Date().toISOString() : undefined,

    bridgeUrl: bridgeWsUrl

  });

}



async function ensureOffscreenDocument() {

  const existing = await chrome.runtime.getContexts({

    contextTypes: ['OFFSCREEN_DOCUMENT'],

    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]

  });

  if (existing.length > 0) return;

  const createOptions = {
    url: OFFSCREEN_URL,
    justification: 'Maintain WebSocket connection to Vitt Overlay Electron bridge on localhost'
  };

  try {
    await chrome.offscreen.createDocument({
      ...createOptions,
      reasons: ['LOCAL_NETWORK']
    });
  } catch {
    await chrome.offscreen.createDocument({
      ...createOptions,
      reasons: ['WORKERS']
    });
  }
}



async function sendBridgeCommand(type, extra = {}) {

  await ensureOffscreenDocument();

  return chrome.runtime.sendMessage({ channel: 'bridge', type, ...extra });

}



async function startBridge() {

  await loadSettings();

  await sendBridgeCommand('connect', {

    url: bridgeWsUrl,

    version: chrome.runtime.getManifest().version,

    timeoutMs: 10000

  });

}



function sendBridgeEvent(payload) {
  return sendBridgeCommand('send', { payload });
}

async function emitStatus(job, status, message) {

  sendBridgeEvent({

    type: 'job_status',

    jobId: job.jobId,

    url: job.url,

    status,

    message

  });

}



function handleBridgeMessage(msg) {

  if (msg.type === 'scrape_job') {

    const { type: _type, concurrency: batchConcurrency, ...job } = msg;

    if (job.jobId && job.url) {

      enqueueJobs([job], batchConcurrency);

    }

  }

}



const pendingInterceptors = new Map();

function isPackageDetailUrl(url = '') {
  return /\/holidays\/[^\s"'<>]*package/i.test(String(url || ''));
}

/** Resolve pending intercept once (new tab or same-tab navigation). */
function settleIntercept(openerTabId, url, reason) {
  const interceptor = pendingInterceptors.get(openerTabId);
  if (!interceptor || interceptor.settled) return false;
  interceptor.settled = true;
  pendingInterceptors.delete(openerTabId);
  clearTimeout(interceptor.timeout);
  deliverInterceptResult(openerTabId, url, reason);
  return true;
}

function getActivePendingOpenerTabId() {
  let latestOpener = null;
  let latestArmedAt = 0;
  for (const [openerTabId, interceptor] of pendingInterceptors) {
    if (interceptor.settled) continue;
    const armedAt = interceptor.armedAt || 0;
    if (armedAt >= latestArmedAt) {
      latestArmedAt = armedAt;
      latestOpener = openerTabId;
    }
  }
  return latestOpener;
}

function handleInterceptDetailTab(openerId, tab, reasonPrefix = 'intercept') {
  markExtensionOpenedTab(tab.id);
  const interceptor = pendingInterceptors.get(openerId);
  if (!interceptor || interceptor.settled) return false;

  devLog(`${reasonPrefix}_tab_created`, {
    openerTabId: openerId,
    detailTabId: tab.id,
    pendingUrl: tab.pendingUrl || tab.url || null,
    hasOpenerTabId: Boolean(tab.openerTabId)
  });

  interceptor.settled = true;
  pendingInterceptors.delete(openerId);
  clearTimeout(interceptor.timeout);

  const finish = (url, reason) => {
    devLog('intercept_detail_tab_close', {
      openerTabId: openerId,
      detailTabId: tab.id,
      reason,
      success: Boolean(url),
      url: url ? url.slice(0, 120) : null
    });
    deliverInterceptResult(openerId, url, url ? 'ok' : reason || 'empty');
    chrome.tabs.remove(tab.id).catch(() => {});
  };

  const u = tab.pendingUrl || tab.url;
  if (u && u !== 'about:blank' && !u.startsWith('chrome://')) {
    finish(u, 'immediate-url');
    return true;
  }

  devLog('intercept_waiting_for_url', { detailTabId: tab.id, openerTabId: openerId });
  const listener = (tabId, info, updatedTab) => {
    if (tabId === tab.id) {
      const url = info.url || updatedTab.url || updatedTab.pendingUrl;
      if (url && url !== 'about:blank' && !url.startsWith('chrome://')) {
        chrome.tabs.onUpdated.removeListener(listener);
        finish(url, 'tab-updated');
      }
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
  setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(listener);
    devLog('intercept_tab_update_timeout', { detailTabId: tab.id, openerTabId: openerId });
    finish(null, 'tab-update-timeout');
  }, 3000);
  return true;
}

function devLog(tag, detail = {}) {
  console.log('[vitt-dev]', tag, JSON.stringify({ ts: new Date().toISOString(), ...detail }));
}

/** Type 4 detail tab: close after scrape unless job sets closeDetailTabAfterScrape: false. */
function shouldCloseDetailTabAfterScrape(job) {
  const value = job?.closeDetailTabAfterScrape;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return true;
}

/** Type 1/3/5 listing homepage: close after scrape unless job sets closeHomePageAfterScrape: false. */
function shouldCloseHomePageAfterScrape(job) {
  const value = job?.closeHomePageAfterScrape;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return true;
}

function deliverInterceptResult(openerTabId, url, reason) {
  devLog('intercept_result', {
    openerTabId,
    reason,
    success: Boolean(url),
    url: url ? url.slice(0, 120) : null,
    pendingInterceptors: pendingInterceptors.size
  });
  chrome.tabs.sendMessage(openerTabId, { channel: 'intercept_result', url: url || null, reason }).catch((err) => {
    devLog('intercept_result_delivery_failed', {
      openerTabId,
      reason,
      error: err?.message || String(err)
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (handleSaveItineraryId(msg, sender, sendResponse)) return;

  if (msg?.channel === 'intercept_next_tab') {
    const tabId = sender.tab?.id;
    if (tabId) {
      devLog('intercept_armed', { openerTabId: tabId, timeoutMs: msg.timeout || 3000 });
      pendingInterceptors.set(tabId, {
        settled: false,
        armedAt: Date.now(),
        timeout: setTimeout(() => {
          if (pendingInterceptors.has(tabId)) {
            settleIntercept(tabId, null, 'timeout');
            devLog('intercept_timeout', { openerTabId: tabId });
          }
        }, msg.timeout || 3000)
      });
      sendResponse({ ready: true });
      return false;
    }
    devLog('intercept_arm_failed', { reason: 'no-tab' });
    sendResponse({ ready: false, reason: 'no-tab' });
    return false;
  }

  if (msg?.channel === 'manual_capture') {
    void runManualCaptureOnTab(msg.tabId, { includeScreenshot: Boolean(msg.includeScreenshot) })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }

  if (handleListenerPriceChange(msg, sender)) return;

  if (msg?.channel !== 'bridge') return;

  if (msg.type === 'status') {
    setConnectionStatus(Boolean(msg.connected));
    return;
  }

  if (msg.type === 'message' && msg.payload) {
    handleBridgeMessage(msg.payload);
  }
});



chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void handleListenerTabUpdated(tabId, changeInfo, tab);

  if (pendingInterceptors.has(tabId)) {
    const url = changeInfo.url || tab.url || tab.pendingUrl;
    if (url && isPackageDetailUrl(url)) {
      devLog('intercept_same_tab_nav', { openerTabId: tabId, url: url.slice(0, 120) });
      settleIntercept(tabId, url, 'same-tab-nav');
    }
    return;
  }

  if (pendingInterceptors.size > 0) {
    const url = changeInfo.url || tab.url || tab.pendingUrl;
    if (url && isPackageDetailUrl(url)) {
      const openerTabId = getActivePendingOpenerTabId();
      if (openerTabId && openerTabId !== tabId) {
        devLog('intercept_orphan_tab_updated', {
          openerTabId,
          detailTabId: tabId,
          url: url.slice(0, 120)
        });
        if (settleIntercept(openerTabId, url, 'orphan-tab-updated')) {
          chrome.tabs.remove(tabId).catch(() => {});
        }
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  extensionOpenedTabIds.delete(tabId);
  handleListenerTabRemoved(tabId);
});

chrome.tabs.onCreated.addListener((tab) => {
  const openerId = tab.openerTabId;
  if (openerId && pendingInterceptors.has(openerId)) {
    handleInterceptDetailTab(openerId, tab, 'intercept');
    return;
  }

  if (pendingInterceptors.size > 0) {
    const claimedOpenerId = getActivePendingOpenerTabId();
    const pendingUrl = tab.pendingUrl || tab.url || '';
    if (
      claimedOpenerId &&
      (!openerId || !pendingInterceptors.has(openerId)) &&
      (isPackageDetailUrl(pendingUrl) || pendingUrl === '' || pendingUrl === 'about:blank')
    ) {
      devLog('intercept_orphan_tab_claim', {
        claimedOpenerTabId: claimedOpenerId,
        detailTabId: tab.id,
        pendingUrl: pendingUrl || null,
        hasOpenerTabId: Boolean(openerId)
      });
      handleInterceptDetailTab(claimedOpenerId, tab, 'intercept_orphan');
      return;
    }
  }

  if (openerId) {
    devLog('intercept_tab_created_no_pending', {
      openerTabId: openerId,
      detailTabId: tab.id,
      pendingUrl: tab.pendingUrl || tab.url || null,
      note: 'tab opened while no interceptor armed — click may have opened wrong tab or interceptor expired'
    });
  }
});

function waitForTabLoad(tabId, timeoutMs = 45000, onProgress) {

  return new Promise((resolve, reject) => {

    let settled = false;

    /** @type {ReturnType<typeof setTimeout> | null} */

    let hardTimer = null;

    /** @type {ReturnType<typeof setInterval> | null} */

    let progressTimer = null;

    /** @type {((updatedTabId: number, info: chrome.tabs.TabChangeInfo) => void) | null} */

    let listener = null;



    const finish = (fn) => {

      if (settled) return;

      settled = true;

      if (hardTimer) clearTimeout(hardTimer);

      if (progressTimer) clearInterval(progressTimer);

      if (listener) chrome.tabs.onUpdated.removeListener(listener);

      fn();

    };



    const tryResolveIfReady = (tab, reason) => {

      if (!tab?.url || tab.url.startsWith('chrome://') || tab.url === 'about:blank') return false;

      if (tab.status === 'complete') {

        finish(() => resolve({ reason: reason || 'complete' }));

        return true;

      }

      return false;

    };



    chrome.tabs.get(tabId, (tab) => {

      if (chrome.runtime.lastError) {

        reject(new Error(chrome.runtime.lastError.message));

        return;

      }

      if (tryResolveIfReady(tab, 'already-complete')) return;



      const startedAt = Date.now();

      progressTimer = setInterval(() => {

        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);

        onProgress?.(`Waiting for page load (${elapsedSec}s)…`);

        chrome.tabs.get(tabId, (current) => {

          if (chrome.runtime.lastError) return;

          tryResolveIfReady(current, 'complete-during-progress');

        });

      }, 5000);



      hardTimer = setTimeout(() => {

        chrome.tabs.get(tabId, (current) => {

          if (chrome.runtime.lastError) {

            finish(() => reject(new Error('Page load timeout — tab closed')));

            return;

          }

          if (current?.url && !current.url.startsWith('chrome://') && current.url !== 'about:blank') {

            finish(() => resolve({ reason: 'soft-timeout' }));

            return;

          }

          finish(() => reject(new Error('Page load timeout after 45s')));

        });

      }, timeoutMs);



      listener = (updatedTabId, info) => {

        if (updatedTabId !== tabId || info.status !== 'complete') return;

        finish(() => resolve({ reason: 'complete-event' }));

      };

      chrome.tabs.onUpdated.addListener(listener);

    });

  });

}

function isListingScrapeMode(mode) {
  return (
    mode === 'mmt-listing' ||
    mode === 'mmt-listing-urls' ||
    mode === 'mmt-listing-search' ||
    mode === 'mmt-listing-first-package'
  );
}

/** Wait until MMT listing SPA renders #collectionList tabs (poll every 500ms, max timeoutMs / job.waitMs). */
async function waitForMmtListingReady(tabId, timeoutMs = 4000, onProgress, options = {}) {
  const requireCollectionTabs = options.requireCollectionTabs === true;
  const requireCards = options.requireCards === true;
  const startedAt = Date.now();
  let lastProgressAt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    let state = null;
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (needTabs, needCards) => {
          const tabs = document.querySelectorAll(
            '#collectionList .tabsWrapper li, .tabScrollSection .tabsWrapper li'
          );
          const cards = document.querySelectorAll('[class*="packageCard"]');
          const tabCount = tabs.length;
          const cardCount = cards.length;
          let ready = false;
          if (needTabs && needCards) ready = tabCount > 0 && cardCount > 0;
          else if (needTabs) ready = tabCount > 0;
          else ready = tabCount > 0 || cardCount > 0;
          return { tabCount, cardCount, ready };
        },
        args: [requireCollectionTabs, requireCards]
      });
      state = injection?.result;
    } catch {
      state = null;
    }

    if (state?.ready) {
      return state;
    }

    if (onProgress && Date.now() - lastProgressAt >= 2500) {
      lastProgressAt = Date.now();
      void onProgress(
        requireCollectionTabs
          ? `Waiting for collection tabs (${Math.round((Date.now() - startedAt) / 1000)}s / ${Math.round(timeoutMs / 1000)}s)`
          : `Waiting for listing content (${Math.round((Date.now() - startedAt) / 1000)}s)`
      );
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return null;
}

function buildScrapeOpts(job) {
  const url = job.url || '';
  const isPackage =
    job.scrapeMode === 'mmt-package' || /\/holidays\/india\/package\b/i.test(url);
  const isListing =
    job.scrapeMode === 'mmt-listing' ||
    job.scrapeMode === 'mmt-listing-urls' ||
    job.scrapeMode === 'mmt-listing-search' ||
    job.scrapeMode === 'mmt-listing-first-package' ||
    /\/holidays\/india\/search\b/i.test(url);

  if (isPackage) {
    return {
      scrapeMode: 'mmt-package',
      waitMs: job.waitMs ?? 2500,
      selector: job.selector || null,
      scrollUntilStable: false,
      flightType: job.flightType || null,
      extractItinerary: job.extractItinerary !== false,
      extractPolicies: job.extractPolicies !== false,
      extractSummary: job.extractSummary !== false,
      extractHotels: job.extractHotels !== false,
      extractActivities: job.extractActivities !== false,
      extractTransfers: job.extractTransfers !== false,
      maxSidebarClicks: job.maxSidebarClicks ?? 8
    };
  }

  const scrapeMode =
    job.scrapeMode ||
    (isListing ? 'mmt-listing' : 'generic');

  return {
    scrapeMode,
    waitMs: job.waitMs ?? 4000,
    selector: job.selector || null,
    scrollUntilStable: job.scrollUntilStable !== false,
    cardSelector: job.cardSelector || '[class*="packageCard"]',
    extractWithFlight: job.extractWithFlight !== false,
    extractWithoutFlight: job.extractWithoutFlight !== false,
    searchPackageName: job.searchPackageName || '',
    minPackageCards: job.minPackageCards ?? 4,
    listingTabName:
      job.listingTabName ||
      (scrapeMode === 'mmt-listing' ? 'All Packages' : null),
    discoverListingTabsOnly: job.discoverListingTabsOnly === true,
    extractAllListingTabs: job.extractAllListingTabs === true,
    extractPackageDetail: job.extractPackageDetail === true,
    packageDetailWaitMs: job.packageDetailWaitMs ?? null
  };
}

function buildManualCaptureJob(url) {
  return {
    jobId: crypto.randomUUID(),
    url,
    source: 'extension-popup'
  };
}

async function ensureBridgeConnected() {
  await startBridge();
  const res = await sendBridgeCommand('ping', { timeoutMs: 10000 });
  if (!res?.ok) {
    throw new Error(
      'Vitt Overlay bridge offline. Launch the overlay app and open Chrome from it first.'
    );
  }
}

function detectPageTypeFromUrl(url = '') {
  if (/\/holidays\/india\/package\b/i.test(url)) return 'mmt-package';
  if (/\/holidays\/india\/search\b/i.test(url)) return 'mmt-listing';
  return 'manual';
}

function buildManualScrapeOpts(url) {
  return {
    scrapeMode: detectPageTypeFromUrl(url),
    immediate: true,
    scrollUntilStable: false,
    selector: null
  };
}

async function captureImmediateFromTab(tabId, job) {
  const scrapeOpts = buildManualScrapeOpts(job.url || '');

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (opts) => {
      document.documentElement.setAttribute('data-vitt-scrape-opts', JSON.stringify(opts));
    },
    args: [scrapeOpts]
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['injected/immediate-capture.js']
  });

  const [{ result: capture }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__vittScrapeResult
  });

  if (!capture) throw new Error('Capture returned empty result');

  const tabInfo = await chrome.tabs.get(tabId);
  capture.url = tabInfo.url || job.url;
  capture.pageType = capture.pageType || scrapeOpts.scrapeMode;
  capture.extractedUrl = tabInfo.url || job.url;
  capture.source = job.source || 'extension-popup';
  capture.captureMode = 'immediate';

  return capture;
}

async function waitForPageScrapeResult(tabId, timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.__vittScrapeResult
      });
      const capture = injection?.result;
      if (capture) {
        if (capture.error) throw new Error(capture.error);
        return capture;
      }
    } catch (err) {
      if (err?.message && !/Cannot access|No tab with id|Frame with ID/.test(err.message)) {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Capture timed out after ${Math.round(timeoutMs / 1000)}s waiting for page scrape`);
}

async function extractScrapeFromTab(tabId, job, onProgress) {
  const scrapeOpts = buildScrapeOpts(job);

  if (onProgress) {
    await onProgress(
      scrapeOpts.scrapeMode === 'mmt-package'
        ? 'Extracting package tabs and sidebars (may take a few minutes)'
        : 'Scrolling and extracting page'
    );
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (opts) => {
      delete window.__vittScrapeResult;
      document.documentElement.setAttribute('data-vitt-scrape-opts', JSON.stringify(opts));
    },
    args: [scrapeOpts]
  });

  const scriptFiles =
    scrapeOpts.scrapeMode === 'mmt-package'
      ? ['injected/mmt-package-scraper.js']
      : ['injected/scrape-runner.js'];

  await chrome.scripting.executeScript({
    target: { tabId },
    files: scriptFiles
  });

  devLog('scrape_script_injected', { tabId, scrapeMode: scrapeOpts.scrapeMode });

  const loadTimeout =
    scrapeOpts.scrapeMode === 'mmt-package' ||
    scrapeOpts.scrapeMode === 'mmt-listing-urls' ||
    scrapeOpts.scrapeMode === 'mmt-listing-search' ||
    scrapeOpts.scrapeMode === 'mmt-listing-first-package'
      ? 180000
      : scrapeOpts.scrapeMode === 'mmt-listing'
        ? Math.min(180000, (job.waitMs ?? 4000) * 8 + 20000)
        : 90000;

  if (scrapeOpts.scrapeMode === 'mmt-package' && onProgress) {
    await onProgress('Type 4: extracting itinerary / policies / summary + sidebars (see server dev log)');
  }

  const capture = await waitForPageScrapeResult(tabId, loadTimeout);

  if (!capture) throw new Error('Capture returned empty result');

  const tabInfo = await chrome.tabs.get(tabId);
  capture.url = tabInfo.url || job.url;
  capture.pageType = capture.pageType || scrapeOpts.scrapeMode;
  capture.extractedUrl = tabInfo.url || job.url;
  capture.source = job.source || 'automated';

  return capture;
}

async function openListingPageTab(job, onProgress, { active = false } = {}) {
  const tab = await chrome.tabs.create({ url: job.url, active });
  markExtensionOpenedTab(tab.id);
  const loadTimeout = isListingScrapeMode(job.scrapeMode) ? 180000 : 45000;
  await waitForTabLoad(tab.id, loadTimeout, (message) => {
    if (onProgress) void onProgress(message);
  });
  const readyMs = job.waitMs ?? 4000;
  const needCollectionTabs =
    job.extractAllListingTabs === true ||
    job.scrapeMode === 'mmt-listing-first-package' ||
    job.discoverListingTabsOnly === true;
  const needListingHydration =
    needCollectionTabs ||
    job.scrapeMode === 'mmt-listing' ||
    isListingScrapeMode(job.scrapeMode);
  if (needListingHydration) {
    await waitForMmtListingReady(
      tab.id,
      readyMs,
      onProgress,
      { requireCollectionTabs: needCollectionTabs }
    );
  }
  await new Promise((r) => setTimeout(r, 1500));
  return { tabId: tab.id };
}

/** Read #collectionList tab names from an already-open listing tab (background already waited waitMs). */
async function discoverCatalogOnTab(tabId, job, onProgress) {
  const readyMs = job.waitMs ?? 4000;
  await waitForMmtListingReady(tabId, readyMs, onProgress, { requireCollectionTabs: true });

  const discoverOpts = { ...buildScrapeOpts(job), discoverListingTabsOnly: true };
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (opts) => {
      delete window.__vittScrapeResult;
      document.documentElement.setAttribute('data-vitt-scrape-opts', JSON.stringify(opts));
    },
    args: [discoverOpts]
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['injected/scrape-runner.js']
  });

  const discoverTimeout = Math.max(readyMs * 4, 30000);
  const capture = await waitForPageScrapeResult(tabId, discoverTimeout);
  return capture?.listingTabCatalog || [];
}

async function scrapeListingCollectionTab(job, tabInfo, onProgress) {
  let tabId = null;
  try {
    if (onProgress) void onProgress(`Scraping tab: ${tabInfo.name}`);
    const opened = await openListingPageTab(job, onProgress, { active: false });
    tabId = opened.tabId;
    const subJob = { ...job, listingTabName: tabInfo.name, extractAllListingTabs: false };
    return await extractScrapeFromTab(tabId, subJob, onProgress);
  } finally {
    if (tabId != null) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        /* ignore */
      }
    }
  }
}

async function runMultiTabListingScrape(job, jobDevLog, onProgress) {
  let discoverTabId = null;
  let catalog = [];

  try {
    if (onProgress) await onProgress('Opening listing page to discover collection tabs');
    const opened = await openListingPageTab(job, onProgress, { active: true });
    discoverTabId = opened.tabId;
    try {
      catalog = await discoverCatalogOnTab(discoverTabId, job, onProgress);
    } catch (discoverErr) {
      jobDevLog.events.push({
        type: 'listing_tabs_discover_error',
        error: discoverErr?.message || String(discoverErr)
      });
      catalog = [];
    }
  } finally {
    if (discoverTabId != null && shouldCloseHomePageAfterScrape(job)) {
      try {
        await chrome.tabs.remove(discoverTabId);
      } catch {
        /* ignore */
      }
    } else if (discoverTabId != null) {
      jobDevLog.events.push({
        type: 'homepage_kept_open',
        tabId: discoverTabId,
        reason: 'closeHomePageAfterScrape_false'
      });
    }
  }

  if (!catalog.length) {
    const tabName = job.listingTabName || 'All Packages';
    jobDevLog.events.push({ type: 'listing_tabs_discover_empty', fallback: tabName });
    catalog = [{ name: tabName, packCount: '' }];
    if (onProgress) {
      await onProgress(`No collection tabs discovered — scraping "${tabName}" only`);
    }
  } else {
    jobDevLog.events.push({
      type: 'listing_tabs_discovered',
      count: catalog.length,
      tabs: catalog.map((t) => ({ name: t.name, packCount: t.packCount }))
    });
    if (onProgress) {
      await onProgress(`Found ${catalog.length} collection tabs — scraping in parallel`);
    }
  }

  const settled = await Promise.allSettled(
    catalog.map((tabInfo) => scrapeListingCollectionTab(job, tabInfo, onProgress))
  );

  const listingTabs = {};
  const listingTabErrors = [];

  for (let i = 0; i < catalog.length; i += 1) {
    const tabInfo = catalog[i];
    const result = settled[i];
    if (result.status === 'fulfilled') {
      listingTabs[tabInfo.name] = buildListingTabCaptureEntry(tabInfo, result.value);
    } else {
      listingTabErrors.push({
        name: tabInfo.name,
        error: result.reason?.message || String(result.reason)
      });
      jobDevLog.events.push({
        type: 'listing_tab_scrape_error',
        name: tabInfo.name,
        error: result.reason?.message || String(result.reason)
      });
    }
  }

  if (!Object.keys(listingTabs).length) {
    throw new Error(listingTabErrors[0]?.error || 'All listing tab scrapes failed');
  }

  const primaryName =
    catalog.find((t) => normalizeListingTabKey(t.name) === normalizeListingTabKey('All Packages'))?.name ||
    catalog[0].name;
  const primary = listingTabs[primaryName] || listingTabs[Object.keys(listingTabs)[0]];
  const firstSuccess = settled.find((r) => r.status === 'fulfilled')?.value;

  return {
    schemaVersion: 2,
    pageType: 'mmt-listing',
    extractAllListingTabs: true,
    capturedAt: new Date().toISOString(),
    url: job.url,
    extractedUrl: job.url,
    title: firstSuccess?.title || primary.text?.slice(0, 200) || '',
    canonicalUrl: firstSuccess?.canonicalUrl || null,
    language: firstSuccess?.language || null,
    selector: job.selector || null,
    scrollUntilStable: job.scrollUntilStable !== false,
    html: primary.html,
    text: primary.text,
    links: primary.links,
    images: primary.images,
    cardCount: primary.cardCount,
    listingTabCatalog: catalog,
    listingTabs,
    listingPackages: primary.listingPackages || [],
    listingTabErrors: listingTabErrors.length ? listingTabErrors : undefined
  };
}

function buildListingTabCaptureEntry(tabInfo, capture) {
  return {
    name: tabInfo.name,
    packCount: tabInfo.packCount || '',
    html: capture.html || '',
    text: capture.text || '',
    listingPackages: capture.listingPackages || [],
    cardCount: capture.cardCount || 0,
    capturedAt: capture.capturedAt || new Date().toISOString(),
    links: capture.links || [],
    images: capture.images || []
  };
}

/** Wrap flat Type 1 capture so listingTabs["All Packages"] is always present. */
function wrapSingleTabListingCapture(capture, tabName = 'All Packages') {
  if (!capture || capture.listingTabs) return capture;

  const name = String(tabName || capture.listingTabName || 'All Packages').trim() || 'All Packages';
  const tabInfo = { name, packCount: '' };
  const entry = buildListingTabCaptureEntry(tabInfo, capture);

  return {
    ...capture,
    extractAllListingTabs: capture.extractAllListingTabs === true,
    listingTabName: name,
    listingTabCatalog: capture.listingTabCatalog || [{ name, packCount: entry.packCount || '' }],
    listingTabs: { [name]: entry },
    html: entry.html,
    text: entry.text,
    links: entry.links,
    images: entry.images,
    cardCount: entry.cardCount,
    listingPackages: entry.listingPackages
  };
}

function normalizeListingTabKey(value = '') {
  return String(value).trim().toLowerCase();
}

/** Resolve first listing package from capture (listingPackages or devLog fallback). */
function resolveFirstListingPackage(capture) {
  const fromList = capture?.listingPackages?.[0];
  if (fromList?.name) return fromList;
  const matched = capture?.devLog?.matchedPackage;
  if (matched?.name) return matched;
  return null;
}

/** Ensure listingPackages[0] exists when devLog already captured the first card. */
function normalizeFirstListingCapture(capture) {
  const pkg = resolveFirstListingPackage(capture);
  if (!pkg) return capture;
  if (!Array.isArray(capture.listingPackages)) capture.listingPackages = [];
  if (!capture.listingPackages.length) capture.listingPackages.push(pkg);
  return capture;
}

function isType5ListingJob(job, scrapeOpts, capture) {
  return (
    job?.scrapeMode === 'mmt-listing-first-package' ||
    scrapeOpts?.scrapeMode === 'mmt-listing-first-package' ||
    capture?.pageType === 'mmt-listing-first-package'
  );
}

/** Collect package detail URLs from listing result (both variants when present). */
function collectPackageDetailTargets(listingPkg, job, diagnostics = null) {
  if (!listingPkg) {
    if (diagnostics) {
      diagnostics.failurePhase = 'no_listing_package';
      diagnostics.skippedOptions.push({ reason: 'no_listing_package', detail: 'resolveFirstListingPackage returned null' });
    }
    return [];
  }

  const targets = [];
  const seen = new Set();

  const add = (detail_url, option_label, flight_type, source) => {
    const url = String(detail_url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    targets.push({
      detail_url: url,
      option_label: option_label || flight_type || 'package',
      flight_type: flight_type || 'default',
      variant: flight_type || 'default',
      source
    });
    if (diagnostics) {
      diagnostics.acceptedTargets.push({
        source,
        flight_type: flight_type || 'default',
        option_label: option_label || flight_type || 'package',
        detail_url: url.slice(0, 160)
      });
    }
  };

  const packageOptions = listingPkg.package_options || [];
  if (diagnostics) diagnostics.packageOptionCount = packageOptions.length;

  for (const opt of packageOptions) {
    const label = String(opt.option_label || '').toLowerCase();
    const isWithFlight = label.includes('with flight') || opt.flight_type === 'withFlight';
    const isWithoutFlight = label.includes('without flight') || opt.flight_type === 'withoutFlight';

    if (!opt.detail_url) {
      if (diagnostics) {
        diagnostics.skippedOptions.push({
          reason: 'missing_detail_url',
          option_label: opt.option_label,
          status: opt.status,
          flight_type: opt.flight_type
        });
      }
      continue;
    }
    if (opt.status === 'sold out') {
      if (diagnostics) {
        diagnostics.skippedOptions.push({
          reason: 'sold_out',
          option_label: opt.option_label,
          flight_type: opt.flight_type
        });
      }
      continue;
    }
    if (isWithFlight && job.extractWithFlight === false) {
      if (diagnostics) {
        diagnostics.skippedOptions.push({
          reason: 'extractWithFlight_disabled',
          option_label: opt.option_label,
          detail_url: opt.detail_url.slice(0, 160)
        });
      }
      continue;
    }
    if (isWithoutFlight && job.extractWithoutFlight === false) {
      if (diagnostics) {
        diagnostics.skippedOptions.push({
          reason: 'extractWithoutFlight_disabled',
          option_label: opt.option_label,
          detail_url: opt.detail_url.slice(0, 160)
        });
      }
      continue;
    }
    const flight_type =
      opt.flight_type ||
      (isWithFlight ? 'withFlight' : isWithoutFlight ? 'withoutFlight' : 'default');
    add(opt.detail_url, opt.option_label, flight_type, 'package_option');
  }

  if (!targets.length && listingPkg.detail_url) {
    add(listingPkg.detail_url, listingPkg.name || 'package', listingPkg.flight_type || 'default', 'listing_detail_url');
  } else if (!targets.length && !listingPkg.detail_url && diagnostics) {
    diagnostics.skippedOptions.push({
      reason: 'no_listing_detail_url',
      detail: 'package_options empty and listingPkg.detail_url missing'
    });
  }

  if (diagnostics) {
    diagnostics.targetCount = targets.length;
    if (!targets.length) {
      diagnostics.failurePhase = diagnostics.failurePhase || 'no_detail_urls_after_filter';
    }
  }

  return targets;
}

/** Build a structured diagnostic snapshot for Type 3 → Type 4 chain failures. */
function buildType3ChainDiagnostics(job, capture, listingPkg, targetDiagnostics) {
  const pageDevLog = capture?.devLog || {};
  return {
    phase: 'type3_to_type4_chain',
    jobId: job.jobId,
    scrapeMode: job.scrapeMode,
    searchPackageName: job.searchPackageName || null,
    extractPackageDetail: job.extractPackageDetail === true,
    extractWithFlight: job.extractWithFlight,
    extractWithoutFlight: job.extractWithoutFlight,
    waitMs: job.waitMs ?? null,
    pageOutcome: pageDevLog.outcome || 'unknown',
    cardCount: capture?.cardCount ?? null,
    totalCardsInDom: pageDevLog.totalCardsInDom ?? null,
    totalRounds: pageDevLog.totalRounds ?? null,
    packageResolved: Boolean(listingPkg),
    packageName: listingPkg?.name || null,
    packageDuration: listingPkg?.duration || null,
    listingDetailUrl: listingPkg?.detail_url || null,
    packageOptions: (listingPkg?.package_options || []).map((opt) => ({
      option_label: opt.option_label,
      detail_url: opt.detail_url ? opt.detail_url.slice(0, 160) : '',
      status: opt.status,
      flight_type: opt.flight_type
    })),
    targetCollection: targetDiagnostics,
    pageEvents: pageDevLog.events || [],
    clickAttempts: pageDevLog.clicks || [],
    likelyCause: inferType3ChainFailureCause(listingPkg, targetDiagnostics, pageDevLog)
  };
}

function inferType3ChainFailureCause(listingPkg, targetDiagnostics, pageDevLog) {
  if (!listingPkg) {
    const outcome = pageDevLog.outcome || 'unknown';
    if (outcome === 'not_found') return 'package_title_not_matched_on_listing_page';
    return 'listing_package_not_resolved_from_capture';
  }
  if ((pageDevLog.clicks || []).some((c) => c.reason === 'intercept_not_ready')) {
    return 'tab_intercept_not_ready_background_worker';
  }
  if ((pageDevLog.clicks || []).some((c) => c.reason === 'click_timeout' || c.reason === 'timeout')) {
    return 'tab_intercept_timed_out_click_did_not_open_detail_tab';
  }
  if ((pageDevLog.events || []).some((e) => e.type === 'title_match_no_price_box')) {
    return 'matched_package_but_price_box_selector_missing';
  }
  const skipped = targetDiagnostics?.skippedOptions || [];
  if (skipped.some((s) => s.reason === 'sold_out')) {
    return 'matched_variant_sold_out';
  }
  if (skipped.some((s) => s.reason === 'extractWithFlight_disabled' || s.reason === 'extractWithoutFlight_disabled')) {
    return 'detail_url_exists_but_filtered_by_extractWithFlight_extractWithoutFlight_flags';
  }
  if ((listingPkg.package_options || []).length === 0 && !listingPkg.detail_url) {
    return 'price_box_and_variant_clicks_did_not_capture_urls';
  }
  return 'unknown_review_clickAttempts_and_pageEvents';
}

function logType3ChainDiagnostics(job, capture, listingPkg, targetDiagnostics, context) {
  const diagnostics = buildType3ChainDiagnostics(job, capture, listingPkg, targetDiagnostics);
  devLog('type3_chain_diagnostics', { context, ...diagnostics });
  console.log('\n[vitt-dev] ========== TYPE 3 → TYPE 4 CHAIN DIAGNOSTICS ==========');
  console.log(JSON.stringify(diagnostics, null, 2));
  console.log('[vitt-dev] ========================================================\n');
  return diagnostics;
}

async function runPackageDetailScrape(parentJob, target, onProgress) {
  let tabId = null;
  const keepDetailTabOpen = !shouldCloseDetailTabAfterScrape(parentJob);
  try {
    const packageJob = {
      ...parentJob,
      url: target.detail_url,
      scrapeMode: 'mmt-package',
      waitMs: parentJob.packageDetailWaitMs ?? 2500,
      flightType: target.flight_type || target.variant || 'default',
      closeDetailTabAfterScrape: keepDetailTabOpen ? false : true
    };

    if (onProgress) {
      await onProgress(`Opening package detail (${target.variant}): ${target.option_label}`);
    }

    const tab = await chrome.tabs.create({ url: target.detail_url, active: false });
    tabId = tab.id;
    markExtensionOpenedTab(tabId);

    await waitForTabLoad(tabId, 180000, (message) => {
      if (onProgress) void onProgress(message);
    });
    await new Promise((r) => setTimeout(r, 1500));

    return await extractScrapeFromTab(tabId, packageJob, onProgress).then((capture) => {
      if (target.flight_type && !capture.flight_type) {
        capture.flight_type = target.flight_type;
      }
      return capture;
    });
  } finally {
    if (tabId != null) {
      if (keepDetailTabOpen) {
        devLog('detail_tab_kept_open', {
          tabId,
          detail_url: target.detail_url?.slice(0, 120),
          closeDetailTabAfterScrape: parentJob?.closeDetailTabAfterScrape,
          parentScrapeMode: parentJob?.scrapeMode || null
        });
      } else {
        try {
          devLog('detail_tab_closing', {
            tabId,
            detail_url: target.detail_url?.slice(0, 120),
            closeDetailTabAfterScrape: parentJob?.closeDetailTabAfterScrape,
            parentScrapeMode: parentJob?.scrapeMode || null
          });
          await chrome.tabs.remove(tabId);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/** Type 3 / Type 5: send each Type 4 result to backend as soon as it completes (listing already sent). */
async function streamPackageDetailsFromListing(job, capture, jobDevLog, onProgress, listingUrl) {
  normalizeFirstListingCapture(capture);
  const listingPkg = resolveFirstListingPackage(capture);
  const targetDiagnostics = {
    failurePhase: null,
    packageOptionCount: 0,
    targetCount: 0,
    acceptedTargets: [],
    skippedOptions: []
  };
  const targets = collectPackageDetailTargets(listingPkg, job, targetDiagnostics);

  if (!targets.length) {
    const chainDiagnostics = logType3ChainDiagnostics(
      job,
      capture,
      listingPkg,
      targetDiagnostics,
      'no_detail_urls_before_type4'
    );
    jobDevLog.events.push({
      type: 'package_detail_skipped',
      reason: 'no_urls',
      likelyCause: chainDiagnostics.likelyCause,
      failurePhase: targetDiagnostics.failurePhase,
      packageName: listingPkg?.name || null,
      pageOutcome: capture?.devLog?.outcome || null,
      clickAttemptCount: (capture?.devLog?.clicks || []).length,
      skippedOptionCount: targetDiagnostics.skippedOptions.length
    });
    sendBridgeEvent({
      type: 'scrape_error',
      jobId: job.jobId,
      url: listingUrl,
      error: 'No package detail URLs found for first listing card',
      diagnostics: chainDiagnostics,
      capture: {
        pageType: capture?.pageType,
        cardCount: capture?.cardCount,
        listingPackages: capture?.listingPackages,
        devLog: capture?.devLog
      }
    });
    return capture;
  }

  devLog('type4_chain_starting', {
    jobId: job.jobId,
    targetCount: targets.length,
    targets: targets.map((t) => ({
      flight_type: t.flight_type,
      source: t.source,
      detail_url: t.detail_url.slice(0, 120)
    }))
  });

  jobDevLog.events.push({
    type: 'package_detail_targets',
    count: targets.length,
    closeDetailTabAfterScrape: job.closeDetailTabAfterScrape,
    willCloseDetailTabs: shouldCloseDetailTabAfterScrape(job),
    targets: targets.map((t) => ({
      flight_type: t.flight_type,
      source: t.source,
      detail_url: t.detail_url.slice(0, 120)
    }))
  });

  if (onProgress) {
    await onProgress(`Extracting ${targets.length} package detail page(s) in parallel`);
  }

  await Promise.allSettled(
    targets.map(async (target) => {
      try {
        if (onProgress) {
          void onProgress(`Type 4 (${target.flight_type}): ${target.detail_url.slice(0, 80)}…`);
        }
        devLog('type4_scrape_start', {
          jobId: job.jobId,
          flight_type: target.flight_type,
          source: target.source,
          detail_url: target.detail_url.slice(0, 120)
        });
        const detailCapture = await runPackageDetailScrape(job, target, onProgress);
        devLog('type4_scrape_done', {
          jobId: job.jobId,
          flight_type: target.flight_type,
          pageType: detailCapture?.pageType,
          hasError: Boolean(detailCapture?.error),
          htmlLen: detailCapture?.html?.length || 0
        });
        await sendBridgeEvent({
          type: 'scrape_result',
          jobId: job.jobId,
          resultPhase: 'package_detail',
          source: job.source || 'automated',
          url: listingUrl,
          extractedUrl: target.detail_url,
          capture: detailCapture
        });
        jobDevLog.events.push({
          type: 'package_detail_sent',
          flight_type: target.flight_type,
          detail_url: target.detail_url.slice(0, 120)
        });
      } catch (error) {
        await sendBridgeEvent({
          type: 'scrape_result',
          jobId: job.jobId,
          resultPhase: 'package_detail',
          source: job.source || 'automated',
          url: listingUrl,
          extractedUrl: target.detail_url,
          capture: {
            schemaVersion: 2,
            pageType: 'mmt-package',
            flight_type: target.flight_type,
            url: target.detail_url,
            extractedUrl: target.detail_url,
            html: '',
            error: error.message || String(error)
          }
        });
        jobDevLog.events.push({
          type: 'package_detail_error',
          flight_type: target.flight_type,
          error: error.message || String(error)
        });
      }
    })
  );

  return capture;
}

async function runManualCaptureOnTab(tabId, options = {}) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || '';
  if (!/^https?:/i.test(url)) {
    throw new Error('Chrome internal pages cannot be captured. Open a normal website first.');
  }

  await ensureBridgeConnected();

  const job = buildManualCaptureJob(url);

  await emitStatus(job, 'capturing', 'Capturing current page');

  const capture = await captureImmediateFromTab(tabId, job);

  if (options.includeScreenshot) {
    try {
      capture.visibleScreenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 80
      });
    } catch {
      /* optional */
    }
  }

  const sent = await sendBridgeEvent({
    type: 'scrape_result',
    jobId: job.jobId,
    source: 'extension-popup',
    url: capture.extractedUrl,
    extractedUrl: capture.extractedUrl,
    capture
  });
  if (!sent?.ok) {
    throw new Error('Failed to send capture to Vitt Overlay bridge');
  }

  return { jobId: job.jobId, url: capture.extractedUrl, title: capture.title || tab.title || '' };
}

async function runScrapeJob(job) {

  let tabId = null;
  let jobErrored = false;
  const jobStartedAt = Date.now();
  const jobDevLog = { jobId: job.jobId, events: [] };
  const note = (type, detail = {}) => {
    jobDevLog.events.push({
      ts: new Date().toISOString(),
      type,
      elapsedMs: Date.now() - jobStartedAt,
      ...detail
    });
    devLog(`job_${type}`, { jobId: job.jobId, elapsedMs: Date.now() - jobStartedAt, ...detail });
  };

  try {

    note('started', {
      url: job.url,
      scrapeMode: job.scrapeMode,
      extractAllListingTabs: job.extractAllListingTabs === true,
      closeDetailTabAfterScrape: job.closeDetailTabAfterScrape
    });
    await emitStatus(job, 'loading', `Opening ${job.url}`);

    const scrapeOptsPreview = buildScrapeOpts(job);
    const isMultiTabListing =
      scrapeOptsPreview.scrapeMode === 'mmt-listing' && job.extractAllListingTabs === true;

    if (isMultiTabListing) {
      await emitStatus(job, 'scrolling', 'Discovering listing collection tabs');
      const capture = await runMultiTabListingScrape(job, jobDevLog, (message) =>
        emitStatus(job, 'extracting', message)
      );
      capture.devLog = { ...(capture.devLog || {}), background: jobDevLog };
      note('scrape_script_done', {
        pageType: capture.pageType,
        listingTabCount: Object.keys(capture.listingTabs || {}).length,
        listingPackageCount: capture.listingPackages?.length || 0
      });
      sendBridgeEvent({
        type: 'scrape_result',
        jobId: job.jobId,
        source: job.source || 'automated',
        url: job.url,
        extractedUrl: job.url,
        capture
      });
      note('result_sent', { ok: true });
      return;
    }

    const tab = await chrome.tabs.create({ url: job.url, active: true });

    tabId = tab.id;
    markExtensionOpenedTab(tabId);
    note('listing_tab_opened', { tabId });

    const loadTimeout =
      scrapeOptsPreview.scrapeMode === 'mmt-package' ||
      scrapeOptsPreview.scrapeMode === 'mmt-listing-urls' ||
      scrapeOptsPreview.scrapeMode === 'mmt-listing-search' ||
      scrapeOptsPreview.scrapeMode === 'mmt-listing-first-package' ||
      scrapeOptsPreview.scrapeMode === 'mmt-listing'
        ? 180000
        : 45000;

    const loadResult = await waitForTabLoad(tabId, loadTimeout, (message) => {

      void emitStatus(job, 'loading', message);

    });

    note('listing_tab_loaded', { tabId, loadReason: loadResult?.reason || 'unknown' });

    if (loadResult?.reason === 'soft-timeout') {

      await emitStatus(job, 'loading', 'Page still loading in background — continuing with visible content');

    }

    if (isListingScrapeMode(scrapeOptsPreview.scrapeMode)) {
      const readyMs = job.waitMs ?? 4000;
      const needCollectionTabs =
        scrapeOptsPreview.scrapeMode === 'mmt-listing-first-package' ||
        job.extractAllListingTabs === true;
      note('listing_page_hydrating', { timeoutMs: readyMs, requireCollectionTabs: needCollectionTabs });
      const readyState = await waitForMmtListingReady(tabId, readyMs, (message) => {
        void emitStatus(job, 'loading', message);
      }, { requireCollectionTabs: needCollectionTabs });
      note('listing_page_ready', {
        tabCount: readyState?.tabCount ?? 0,
        cardCount: readyState?.cardCount ?? 0,
        hydrated: Boolean(readyState?.ready),
        elapsedMs: readyState ? undefined : readyMs
      });
    }

    await new Promise((r) => setTimeout(r, 1500));

    await emitStatus(job, 'scrolling', 'Preparing page scrape');

    const capture = await extractScrapeFromTab(tabId, job, (message) =>
      emitStatus(job, 'extracting', message)
    );

    normalizeFirstListingCapture(capture);

    if (isType5ListingJob(job, scrapeOptsPreview, capture)) {
      if (!job.scrapeMode) job.scrapeMode = 'mmt-listing-first-package';
      capture.devLog = { ...(capture.devLog || {}), background: jobDevLog };
      note('scrape_script_done', {
        pageType: capture.pageType,
        listingPackageCount: capture.listingPackages?.length || 0,
        hasDetailUrl: Boolean(resolveFirstListingPackage(capture)?.detail_url),
        packageOptions: resolveFirstListingPackage(capture)?.package_options?.length || 0
      });

      await sendBridgeEvent({
        type: 'scrape_result',
        jobId: job.jobId,
        resultPhase: 'listing',
        source: job.source || 'automated',
        url: job.url,
        extractedUrl: capture.extractedUrl || job.url,
        capture
      });
      note('listing_result_sent', { ok: true });

      if (shouldCloseHomePageAfterScrape(job)) {
        try {
          note('listing_tab_closing', { tabId, reason: 'type5_listing_done_opening_package_detail' });
          await chrome.tabs.remove(tabId);
        } catch (e) {
          note('listing_tab_close_failed', { tabId, error: e?.message || String(e) });
        }
      } else {
        note('homepage_kept_open', { tabId, reason: 'closeHomePageAfterScrape_false' });
      }
      tabId = null;

      await streamPackageDetailsFromListing(
        job,
        capture,
        jobDevLog,
        (message) => emitStatus(job, 'extracting', message),
        job.url
      );
      note('job_complete', { ok: true });
      return;
    }

    if (job.scrapeMode === 'mmt-listing-search') {
      normalizeFirstListingCapture(capture);
      capture.devLog = { ...(capture.devLog || {}), background: jobDevLog };
      const listingPkg = resolveFirstListingPackage(capture);
      note('scrape_script_done', {
        pageType: capture.pageType,
        listingPackageCount: capture.listingPackages?.length || 0,
        hasDetailUrl: Boolean(listingPkg?.detail_url),
        packageOptions: listingPkg?.package_options?.length || 0,
        extractPackageDetail: job.extractPackageDetail === true,
        pageOutcome: capture.devLog?.outcome || null,
        searchPackageName: job.searchPackageName || null,
        matchedPackageName: listingPkg?.name || null,
        clickAttemptCount: (capture.devLog?.clicks || []).length
      });

      if (!listingPkg) {
        logType3ChainDiagnostics(job, capture, null, { skippedOptions: [{ reason: 'no_listing_package' }] }, 'listing_scrape_no_package');
      } else if (!listingPkg.detail_url && !(listingPkg.package_options || []).some((o) => o.detail_url)) {
        logType3ChainDiagnostics(
          job,
          capture,
          listingPkg,
          { skippedOptions: [{ reason: 'no_urls_in_listing_capture' }] },
          'listing_scrape_no_urls_in_page'
        );
      }

      // Type 3: listing is internal only (find URLs) — do not send listing scrape_result to backend.
      note('listing_result_skipped', { reason: 'type3_detail_only' });

      if (shouldCloseHomePageAfterScrape(job)) {
        try {
          note('listing_tab_closing', { tabId, reason: 'type3_listing_done' });
          await chrome.tabs.remove(tabId);
        } catch (e) {
          note('listing_tab_close_failed', { tabId, error: e?.message || String(e) });
        }
      } else {
        note('homepage_kept_open', { tabId, reason: 'closeHomePageAfterScrape_false' });
      }
      tabId = null;

      if (job.extractPackageDetail === true) {
        note('type4_chain_start', {
          matchedPackage: listingPkg?.name || null,
          hasDetailUrl: Boolean(listingPkg?.detail_url),
          packageOptionCount: listingPkg?.package_options?.length || 0
        });
        await streamPackageDetailsFromListing(
          job,
          capture,
          jobDevLog,
          (message) => emitStatus(job, 'extracting', message),
          job.url
        );
      } else {
        jobDevLog.events.push({ type: 'package_detail_skipped', reason: 'extractPackageDetail_false' });
      }
      note('job_complete', { ok: true });
      return;
    }

    if (scrapeOptsPreview.scrapeMode === 'mmt-listing' && job.extractAllListingTabs !== true) {
      const tabName = job.listingTabName || scrapeOptsPreview.listingTabName || 'All Packages';
      Object.assign(capture, wrapSingleTabListingCapture(capture, tabName));
    }

    capture.devLog = { ...(capture.devLog || {}), background: jobDevLog };
    note('scrape_script_done', {
      pageType: capture.pageType,
      listingPackageCount: capture.listingPackages?.length || 0,
      hasDetailUrl: Boolean(capture.listingPackages?.[0]?.detail_url),
      packageDetailCount: capture.packageDetails?.length || 0
    });

    sendBridgeEvent({
      type: 'scrape_result',
      jobId: job.jobId,
      source: job.source || 'automated',
      url: capture.extractedUrl,
      extractedUrl: capture.extractedUrl,
      capture
    });
    note('result_sent', { ok: true });

  } catch (error) {

    jobErrored = true;
    note('error', { message: error.message || String(error) });
    sendBridgeEvent({

      type: 'scrape_error',

      jobId: job.jobId,

      url: job.url,

      error: error.message || String(error)

    });

  } finally {

    if (tabId != null) {
      const scrapeMode = buildScrapeOpts(job).scrapeMode;
      const isPackageDetailJob = scrapeMode === 'mmt-package';
      const isListingHomepageJob =
        scrapeMode === 'mmt-listing' ||
        scrapeMode === 'mmt-listing-search' ||
        scrapeMode === 'mmt-listing-first-package';

      let shouldClose;
      if (isPackageDetailJob) {
        shouldClose = shouldCloseDetailTabAfterScrape(job);
      } else if (isListingHomepageJob) {
        shouldClose = shouldCloseHomePageAfterScrape(job);
      } else {
        shouldClose = true;
      }

      if (shouldClose) {
        try {
          note('listing_tab_closing', {
            tabId,
            reason: jobErrored ? 'job_error' : 'job_finished',
            scrapeMode: job.scrapeMode || 'unknown'
          });
          await chrome.tabs.remove(tabId);
        } catch (e) {
          note('listing_tab_close_failed', { tabId, error: e?.message || String(e) });
        }
      } else {
        note('homepage_kept_open', {
          tabId,
          reason: 'closeHomePageAfterScrape_false'
        });
      }
    }

  }

}



function pumpQueue() {

  while (activeWorkers < concurrency && queue.length > 0) {

    const job = queue.shift();

    activeWorkers += 1;

    runScrapeJob(job).finally(() => {

      activeWorkers -= 1;

      pumpQueue();

    });

  }

}



function enqueueJobs(jobs, batchConcurrency) {

  if (typeof batchConcurrency === 'number' && batchConcurrency > 0) {

    concurrency = batchConcurrency;

  }

  for (const job of jobs) queue.push(job);

  pumpQueue();

}



function scheduleKeepaliveAlarm() {

  chrome.alarms.create('keepalive', { delayInMinutes: KEEPALIVE_ALARM_SEC / 60 });

}



chrome.runtime.onInstalled.addListener(async () => {

  await startBridge();

  scheduleKeepaliveAlarm();

});



chrome.runtime.onStartup.addListener(async () => {

  await startBridge();

  scheduleKeepaliveAlarm();

});



chrome.storage.onChanged.addListener((changes, area) => {

  if (area !== 'local') return;

  if (changes.bridgeUrl) {

    bridgeWsUrl = normalizeBridgeWsUrl(changes.bridgeUrl.newValue);

    void startBridge();

  }

  if (changes.concurrency) {

    concurrency = changes.concurrency.newValue || DEFAULT_CONCURRENCY;

  }

});



initListenerController({
  extractScrapeFromTab,
  ensureBridgeConnected,
  sendBridgeEvent,
  emitStatus,
  devLog,
  isExtensionOpenedTab
});

initDiyPlannerHandler({
  ensureBridgeConnected,
  sendBridgeEvent,
  devLog
});

void startBridge().then(scheduleKeepaliveAlarm);



chrome.alarms.onAlarm.addListener((alarm) => {

  if (alarm.name !== 'keepalive') return;

  void sendBridgeCommand('ping', { timeoutMs: 8000 });

  scheduleKeepaliveAlarm();

});


