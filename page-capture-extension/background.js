const DEFAULT_BRIDGE_WS = 'ws://127.0.0.1:38772';

const DEFAULT_CONCURRENCY = 3;

const OFFSCREEN_URL = 'offscreen.html';
const KEEPALIVE_ALARM_SEC = 5;



let bridgeWsUrl = DEFAULT_BRIDGE_WS;

let concurrency = DEFAULT_CONCURRENCY;



/** @type {Array<object>} */

const queue = [];

let activeWorkers = 0;



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

function devLog(tag, detail = {}) {
  console.log('[vitt-dev]', tag, JSON.stringify({ ts: new Date().toISOString(), ...detail }));
}

function deliverInterceptResult(openerTabId, url, reason) {
  devLog('intercept_result', { openerTabId, reason, url: url ? url.slice(0, 120) : null });
  chrome.tabs.sendMessage(openerTabId, { channel: 'intercept_result', url: url || null, reason }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.channel === 'intercept_next_tab') {
    const tabId = sender.tab?.id;
    if (tabId) {
      devLog('intercept_armed', { openerTabId: tabId, timeoutMs: msg.timeout || 3000 });
      pendingInterceptors.set(tabId, {
        timeout: setTimeout(() => {
          if (pendingInterceptors.has(tabId)) {
            pendingInterceptors.delete(tabId);
            devLog('intercept_timeout', { openerTabId: tabId });
            deliverInterceptResult(tabId, null, 'timeout');
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

  if (msg?.channel !== 'bridge') return;

  if (msg.type === 'status') {
    setConnectionStatus(Boolean(msg.connected));
    return;
  }

  if (msg.type === 'message' && msg.payload) {
    handleBridgeMessage(msg.payload);
  }
});



chrome.tabs.onCreated.addListener((tab) => {
  const openerId = tab.openerTabId;
  if (openerId && pendingInterceptors.has(openerId)) {
    devLog('intercept_tab_created', { openerTabId: openerId, detailTabId: tab.id, pendingUrl: tab.pendingUrl || tab.url || null });
    const interceptor = pendingInterceptors.get(openerId);
    pendingInterceptors.delete(openerId);
    clearTimeout(interceptor.timeout);

    const finish = (url, reason) => {
      devLog('intercept_detail_tab_close', { openerTabId: openerId, detailTabId: tab.id, reason, url: url ? url.slice(0, 120) : null });
      deliverInterceptResult(openerId, url, url ? 'ok' : reason || 'empty');
      chrome.tabs.remove(tab.id).catch(() => {});
    };

    const u = tab.pendingUrl || tab.url;
    if (u && u !== 'about:blank' && !u.startsWith('chrome://')) {
      finish(u, 'immediate-url');
    } else {
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
        finish(null, 'tab-update-timeout');
      }, 3000);
    }
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
    const [{ result: capture }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__vittScrapeResult
    });
    if (capture) {
      if (capture.error) throw new Error(capture.error);
      return capture;
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
  const loadTimeout = 45000;
  const loadResult = await waitForTabLoad(tab.id, loadTimeout, (message) => {
    if (onProgress) void onProgress(message);
  });
  await new Promise((r) => setTimeout(r, 1500));
  return { tabId: tab.id, loadResult };
}

async function discoverListingCollectionTabs(job, onProgress) {
  let tabId = null;
  try {
    if (onProgress) await onProgress('Discovering listing collection tabs');
    const opened = await openListingPageTab(job, onProgress, { active: true });
    tabId = opened.tabId;

    const discoverOpts = { ...buildScrapeOpts(job), discoverListingTabsOnly: true };
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (opts) => {
        document.documentElement.setAttribute('data-vitt-scrape-opts', JSON.stringify(opts));
      },
      args: [discoverOpts]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['injected/scrape-runner.js']
    });

    const capture = await waitForPageScrapeResult(tabId, 90000);
    return capture?.listingTabCatalog || [];
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

async function scrapeListingCollectionTab(job, tabInfo, onProgress) {
  let tabId = null;
  try {
    if (onProgress) await onProgress(`Scraping tab: ${tabInfo.name}`);
    const opened = await openListingPageTab({ ...job, url: job.url }, onProgress);
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

async function runMultiTabListingScrape(job, jobDevLog, onProgress) {
  const catalog = await discoverListingCollectionTabs(job, onProgress);
  if (!catalog.length) {
    throw new Error('No listing collection tabs found (#collectionList .tabsWrapper)');
  }

  jobDevLog.events.push({
    type: 'listing_tabs_discovered',
    count: catalog.length,
    tabs: catalog.map((t) => ({ name: t.name, packCount: t.packCount }))
  });

  if (onProgress) {
    await onProgress(`Scraping ${catalog.length} listing tabs in parallel`);
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
    }
  }

  if (!Object.keys(listingTabs).length) {
    throw new Error(
      listingTabErrors[0]?.error || 'All listing tab scrapes failed'
    );
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
    title: firstSuccess?.title || '',
    canonicalUrl: firstSuccess?.canonicalUrl || null,
    language: firstSuccess?.language || null,
    selector: job.selector || null,
    scrollUntilStable: job.scrollUntilStable !== false,
    html: primary.html,
    text: primary.text,
    links: primary.links,
    images: primary.images,
    cardCount: primary.cardCount,
    listingPackages: primary.listingPackages,
    listingTabCatalog: catalog,
    listingTabs,
    listingTabErrors: listingTabErrors.length ? listingTabErrors : undefined
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
function collectPackageDetailTargets(listingPkg, job) {
  if (!listingPkg) return [];

  const targets = [];
  const seen = new Set();

  const add = (detail_url, option_label, flight_type) => {
    const url = String(detail_url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    targets.push({
      detail_url: url,
      option_label: option_label || flight_type || 'package',
      flight_type: flight_type || 'default',
      variant: flight_type || 'default'
    });
  };

  for (const opt of listingPkg.package_options || []) {
    if (!opt.detail_url || opt.status === 'sold out') continue;
    const label = String(opt.option_label || '').toLowerCase();
    const isWithFlight = label.includes('with flight');
    const isWithoutFlight = label.includes('without flight');
    if (isWithFlight && job.extractWithFlight === false) continue;
    if (isWithoutFlight && job.extractWithoutFlight === false) continue;
    const flight_type =
      opt.flight_type ||
      (isWithFlight ? 'withFlight' : isWithoutFlight ? 'withoutFlight' : 'default');
    add(opt.detail_url, opt.option_label, flight_type);
  }

  if (!targets.length && listingPkg.detail_url) {
    add(listingPkg.detail_url, listingPkg.name || 'package', listingPkg.flight_type || 'default');
  }

  return targets;
}

async function runPackageDetailScrape(parentJob, target, onProgress) {
  let tabId = null;
  try {
    const packageJob = {
      ...parentJob,
      url: target.detail_url,
      scrapeMode: 'mmt-package',
      waitMs: parentJob.packageDetailWaitMs ?? 2500,
      flightType: target.flight_type || target.variant || 'default'
    };

    if (onProgress) {
      await onProgress(`Opening package detail (${target.variant}): ${target.option_label}`);
    }

    const tab = await chrome.tabs.create({ url: target.detail_url, active: false });
    tabId = tab.id;

    await waitForTabLoad(tabId, 180000, (message) => {
      if (onProgress) void onProgress(message);
    });
    await new Promise((r) => setTimeout(r, 1500));

    return await extractScrapeFromTab(tabId, packageJob, onProgress);
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

async function attachPackageDetailsFromListingSearch(job, capture, jobDevLog, onProgress) {
  if (job.extractPackageDetail !== true || job.scrapeMode !== 'mmt-listing-search') {
    return capture;
  }

  const listingPkg = resolveFirstListingPackage(capture);
  const targets = collectPackageDetailTargets(listingPkg, job);

  capture.extractPackageDetail = true;

  if (!targets.length) {
    capture.packageDetails = [];
    capture.packageDetailError = 'No package detail URLs found on matched listing card';
    jobDevLog.events.push({ type: 'package_detail_skipped', reason: 'no_urls' });
    return capture;
  }

  jobDevLog.events.push({
    type: 'package_detail_targets',
    count: targets.length,
    targets: targets.map((t) => ({ variant: t.variant, detail_url: t.detail_url.slice(0, 120) }))
  });

  if (onProgress) {
    await onProgress(`Extracting ${targets.length} package detail page(s)`);
  }

  const packageDetails = [];
  for (const target of targets) {
    try {
      const detailCapture = await runPackageDetailScrape(job, target, onProgress);
      packageDetails.push({
        option_label: target.option_label,
        variant: target.variant,
        detail_url: target.detail_url,
        capture: detailCapture
      });
      jobDevLog.events.push({
        type: 'package_detail_done',
        variant: target.variant,
        detail_url: target.detail_url.slice(0, 120)
      });
    } catch (error) {
      packageDetails.push({
        option_label: target.option_label,
        variant: target.variant,
        detail_url: target.detail_url,
        error: error.message || String(error)
      });
      jobDevLog.events.push({
        type: 'package_detail_error',
        variant: target.variant,
        error: error.message || String(error)
      });
    }
  }

  capture.packageDetails = packageDetails;
  return capture;
}

/** Type 5: send each Type 4 result to backend as soon as it completes (listing already sent). */
async function streamPackageDetailsFromFirstListing(job, capture, jobDevLog, onProgress, listingUrl) {
  normalizeFirstListingCapture(capture);
  const listingPkg = resolveFirstListingPackage(capture);
  const targets = collectPackageDetailTargets(listingPkg, job);

  if (!targets.length) {
    jobDevLog.events.push({ type: 'package_detail_skipped', reason: 'no_urls' });
    sendBridgeEvent({
      type: 'scrape_error',
      jobId: job.jobId,
      url: listingUrl,
      error: 'No package detail URLs found for first listing card'
    });
    return capture;
  }

  jobDevLog.events.push({
    type: 'package_detail_targets',
    count: targets.length,
    targets: targets.map((t) => ({ flight_type: t.flight_type, detail_url: t.detail_url.slice(0, 120) }))
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
        const detailCapture = await runPackageDetailScrape(job, target, onProgress);
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
  const jobDevLog = { jobId: job.jobId, events: [] };
  const note = (type, detail = {}) => {
    jobDevLog.events.push({ ts: new Date().toISOString(), type, ...detail });
    devLog(`job_${type}`, { jobId: job.jobId, ...detail });
  };

  try {

    note('started', { url: job.url, scrapeMode: job.scrapeMode, extractAllListingTabs: job.extractAllListingTabs === true });
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
    note('listing_tab_opened', { tabId });

    const loadTimeout =
      scrapeOptsPreview.scrapeMode === 'mmt-package' ||
      scrapeOptsPreview.scrapeMode === 'mmt-listing-urls' ||
      scrapeOptsPreview.scrapeMode === 'mmt-listing-search' ||
      scrapeOptsPreview.scrapeMode === 'mmt-listing-first-package'
        ? 180000
        : 45000;

    const loadResult = await waitForTabLoad(tabId, loadTimeout, (message) => {

      void emitStatus(job, 'loading', message);

    });

    note('listing_tab_loaded', { tabId, loadReason: loadResult?.reason || 'unknown' });

    if (loadResult?.reason === 'soft-timeout') {

      await emitStatus(job, 'loading', 'Page still loading in background — continuing with visible content');

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

      try {
        note('listing_tab_closing', { tabId, reason: 'type5_listing_done_opening_package_detail' });
        await chrome.tabs.remove(tabId);
        tabId = null;
      } catch (e) {
        note('listing_tab_close_failed', { tabId, error: e?.message || String(e) });
      }

      await streamPackageDetailsFromFirstListing(
        job,
        capture,
        jobDevLog,
        (message) => emitStatus(job, 'extracting', message),
        job.url
      );
      note('job_complete', { ok: true });
      return;
    }

    if (job.scrapeMode === 'mmt-listing-search' && job.extractPackageDetail === true) {
      try {
        note('listing_tab_closing', { tabId, reason: 'type3_listing_done_opening_package_detail' });
        await chrome.tabs.remove(tabId);
        tabId = null;
      } catch (e) {
        note('listing_tab_close_failed', { tabId, error: e?.message || String(e) });
      }
      await attachPackageDetailsFromListingSearch(
        job,
        capture,
        jobDevLog,
        (message) => emitStatus(job, 'extracting', message)
      );
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

    note('error', { message: error.message || String(error) });
    sendBridgeEvent({

      type: 'scrape_error',

      jobId: job.jobId,

      url: job.url,

      error: error.message || String(error)

    });

  } finally {

    if (tabId != null) {

      try {
        note('listing_tab_closing', { tabId, reason: 'job_finished' });
        await chrome.tabs.remove(tabId);

      } catch (e) {

        note('listing_tab_close_failed', { tabId, error: e?.message || String(e) });

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



void startBridge().then(scheduleKeepaliveAlarm);



chrome.alarms.onAlarm.addListener((alarm) => {

  if (alarm.name !== 'keepalive') return;

  void sendBridgeCommand('ping', { timeoutMs: 8000 });

  scheduleKeepaliveAlarm();

});


