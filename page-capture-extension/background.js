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

    version: chrome.runtime.getManifest().version

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



chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
    job.scrapeMode === 'mmt-listing' || /\/holidays\/india\/search\b/i.test(url);

  if (isPackage) {
    return {
      scrapeMode: 'mmt-package',
      waitMs: job.waitMs ?? 2500,
      selector: job.selector || null,
      scrollUntilStable: false,
      extractItinerary: job.extractItinerary !== false,
      extractPolicies: job.extractPolicies !== false,
      extractSummary: job.extractSummary !== false,
      extractHotels: job.extractHotels !== false,
      extractActivities: job.extractActivities !== false,
      extractTransfers: job.extractTransfers !== false,
      maxSidebarClicks: job.maxSidebarClicks ?? 8
    };
  }

  return {
    scrapeMode: isListing ? 'mmt-listing' : 'generic',
    waitMs: job.waitMs ?? 4000,
    selector: job.selector || null,
    scrollUntilStable: job.scrollUntilStable !== false,
    cardSelector: job.cardSelector || '[class*="packageCard"]'
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
  const res = await sendBridgeCommand('ping');
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

  const [{ result: capture }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__vittScrapeResult
  });

  if (!capture) throw new Error('Capture returned empty result');

  const tabInfo = await chrome.tabs.get(tabId);
  capture.url = tabInfo.url || job.url;
  capture.pageType = capture.pageType || scrapeOpts.scrapeMode;
  capture.extractedUrl = tabInfo.url || job.url;
  capture.source = job.source || 'automated';

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

  try {

    await emitStatus(job, 'loading', `Opening ${job.url}`);



    const tab = await chrome.tabs.create({ url: job.url, active: true });

    tabId = tab.id;

    const scrapeOptsPreview = buildScrapeOpts(job);

    const loadTimeout = scrapeOptsPreview.scrapeMode === 'mmt-package' ? 90000 : 45000;

    const loadResult = await waitForTabLoad(tabId, loadTimeout, (message) => {

      void emitStatus(job, 'loading', message);

    });

    if (loadResult?.reason === 'soft-timeout') {

      await emitStatus(job, 'loading', 'Page still loading in background — continuing with visible content');

    }

    await new Promise((r) => setTimeout(r, 1500));



    await emitStatus(job, 'scrolling', 'Preparing page scrape');

    const capture = await extractScrapeFromTab(tabId, job, (message) =>
      emitStatus(job, 'extracting', message)
    );

    sendBridgeEvent({
      type: 'scrape_result',
      jobId: job.jobId,
      source: job.source || 'automated',
      url: capture.extractedUrl,
      extractedUrl: capture.extractedUrl,
      capture
    });

  } catch (error) {

    sendBridgeEvent({

      type: 'scrape_error',

      jobId: job.jobId,

      url: job.url,

      error: error.message || String(error)

    });

  } finally {

    if (tabId != null) {

      try {

        await chrome.tabs.remove(tabId);

      } catch {

        /* tab may already be closed */

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

  void sendBridgeCommand('ping');

  scheduleKeepaliveAlarm();

});


