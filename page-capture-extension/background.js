const DEFAULT_BRIDGE = 'http://127.0.0.1:38771';
const DEFAULT_CONCURRENCY = 3;

let bridgeUrl = DEFAULT_BRIDGE;
let concurrency = DEFAULT_CONCURRENCY;
let pollTimer = null;

/** @type {Array<object>} */
const queue = [];
let activeWorkers = 0;

async function loadSettings() {
  const saved = await chrome.storage.local.get({
    bridgeUrl: DEFAULT_BRIDGE,
    concurrency: DEFAULT_CONCURRENCY
  });
  bridgeUrl = (saved.bridgeUrl || DEFAULT_BRIDGE).replace(/\/$/, '');
  concurrency = saved.concurrency || DEFAULT_CONCURRENCY;
}

async function postEvent(payload) {
  await fetch(`${bridgeUrl}/extension/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function emitStatus(job, status, message) {
  await postEvent({
    type: 'job_status',
    jobId: job.jobId,
    url: job.url,
    status,
    message
  });
}

function waitForTabLoad(tabId, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Page load timeout'));
    }, timeoutMs);

    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function runScrapeJob(job) {
  let tabId = null;
  try {
    await emitStatus(job, 'loading', `Opening ${job.url}`);

    const tab = await chrome.tabs.create({ url: job.url, active: true });
    tabId = tab.id;
    await waitForTabLoad(tabId);
    await new Promise((r) => setTimeout(r, 1500));

    await emitStatus(job, 'scrolling', 'Scrolling until content is stable');

    const scrapeOpts = {
      waitMs: job.waitMs || 4000,
      selector: job.selector || null,
      scrollUntilStable: job.scrollUntilStable !== false
    };

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (opts) => {
        document.documentElement.setAttribute('data-vitt-scrape-opts', JSON.stringify(opts));
      },
      args: [scrapeOpts]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['injected/scrape-runner.js']
    });

    await emitStatus(job, 'extracting', 'Extracting page data');

    const [{ result: capture }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__vittScrapeResult
    });

    if (!capture) throw new Error('Capture returned empty result');

    const tabInfo = await chrome.tabs.get(tabId);
    capture.url = tabInfo.url || job.url;
    capture.extractedUrl = tabInfo.url || job.url;

    await postEvent({
      type: 'scrape_result',
      jobId: job.jobId,
      url: capture.extractedUrl,
      extractedUrl: capture.extractedUrl,
      capture
    });
  } catch (error) {
    await postEvent({
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

async function pollBridge() {
  try {
    await fetch(`${bridgeUrl}/extension/ping`, { method: 'POST' });
    const res = await fetch(`${bridgeUrl}/extension/poll`);
    const data = await res.json();
    if (Array.isArray(data.jobs) && data.jobs.length) {
      enqueueJobs(data.jobs, data.concurrency);
    }
    chrome.storage.local.set({
      lastConnectedAt: new Date().toISOString(),
      connectionStatus: 'connected'
    });
  } catch {
    chrome.storage.local.set({ connectionStatus: 'disconnected' });
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollBridge();
  pollTimer = setInterval(pollBridge, 2000);
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  startPolling();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadSettings();
  startPolling();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.bridgeUrl) {
    bridgeUrl = (changes.bridgeUrl.newValue || DEFAULT_BRIDGE).replace(/\/$/, '');
    startPolling();
  }
  if (changes.concurrency) {
    concurrency = changes.concurrency.newValue || DEFAULT_CONCURRENCY;
  }
});

loadSettings().then(startPolling);

chrome.alarms.create('keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') pollBridge();
});
