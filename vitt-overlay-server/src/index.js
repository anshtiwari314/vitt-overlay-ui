import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { detectScrapeMode, mergeJobOptions } from './scrapeJobOptions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

function envBool(key, defaultValue = false) {
  const raw = process.env[key];
  if (raw == null || raw === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

loadEnvFile();

const PORT = Number(process.env.PORT || 5000);
const HOST = '127.0.0.1';
const CAPTURE_DIR = path.join(__dirname, '..', 'capture');
const CAPTURE_TOKEN = process.env.VITT_CAPTURE_TOKEN || 'vitt-local-capture-token';

const LISTING_SCRAPE_URL =
  process.env.VITT_LISTING_SCRAPE_URL ||
  'https://holidayz.makemytrip.com/holidays/india/search?dest=Goa';

const PACKAGE_SCRAPE_URL =
  process.env.VITT_PACKAGE_SCRAPE_URL ||
  'https://holidayz.makemytrip.com/holidays/india/package?depCity=New%20Delhi&dateSearched=02%2F07%2F2026&dest=Goa&destValue=Goa&glp=true&pdo=true&affiliate=MMT&rooms=2%2C0%2C0%2C0%2C%2C%2C&id=21828&listingClassId=12&depDate=2026-07-02&fromCity=New%20Delhi&variantId=NO_MAJOR_COMMUTE_CCCDEC54&room=2%2C0%2C0%2C0%2C%2C%2C&searchDate=2026-07-02&pkgType=FIT';

const TYPE2_LISTING_URL =
  process.env.VITT_TYPE2_LISTING_URL ||
  'https://holidayz.makemytrip.com/holidays/india/search?fromSearchWidget=true&searchDep=Kerala&dest=Kerala&destValue=Kerala&depCity=New%20Delhi&initd=searchwidget_landing_Kerala_notheme&dateSearched=03%2F07%2F2026&glp=true&pdo=true&rooms=2%2C0%2C0%2C0%2C%2C%2C&affiliate=MMT##page_header';

const TYPE3_LISTING_URL =
  process.env.VITT_TYPE3_LISTING_URL || TYPE2_LISTING_URL;

/** Type 1 — listing only (scroll + HTML/text, no URL clicks). */
const TYPE1_LISTING_ONLY = {
  scrapeMode: 'mmt-listing',
  url: LISTING_SCRAPE_URL,
  scrollUntilStable: false,
  waitMs: 3000,
  extractAllListingTabs: envBool('VITT_TYPE1_EXTRACT_ALL_LISTING_TABS', false),
  listingTabName: 'All Packages'
};

/** Type 2 — listing + click-through detail URLs. */
const TYPE2_LISTING_URLS = {
  scrapeMode: 'mmt-listing-urls',
  url: TYPE2_LISTING_URL,
  extractWithFlight: true,
  extractWithoutFlight: true,
  scrollUntilStable: true,
  waitMs: 3000
};

/** Type 3 — find one package on listing + its detail URL(s). */
const TYPE3_LISTING_SEARCH = {
  scrapeMode: 'mmt-listing-search',
  url: TYPE3_LISTING_URL,
  searchPackageName: process.env.VITT_TYPE3_SEARCH_PACKAGE_NAME || 'sabarimala SAcred  jOurney',
  extractWithFlight: true,
  extractWithoutFlight: true,
  scrollUntilStable: true,
  waitMs: 3000,
  extractPackageDetail: envBool('VITT_TYPE3_EXTRACT_PACKAGE_DETAIL', false),
  extractItinerary: true,
  extractPolicies: true,
  extractSummary: true,
  extractHotels: false,
  extractActivities: false,
  extractTransfers: false,
  maxSidebarClicks: 8,
  packageDetailWaitMs: 2500
};

/** Type 4 — package detail page (full content scrape). */
const TYPE4_PACKAGE_DETAIL = {
  scrapeMode: 'mmt-package',
  url: PACKAGE_SCRAPE_URL,
  extractItinerary: true,
  extractPolicies: true,
  extractSummary: true,
  extractHotels: true,
  extractActivities: true,
  extractTransfers: false,
  maxSidebarClicks: 8,
  waitMs: 2500,
  scrollUntilStable: false
};

/** Type 5 — first listing card → detail URL(s) → incremental Type 4 chain. */
const TYPE5_FIRST_PACKAGE = {
  scrapeMode: 'mmt-listing-first-package',
  url: process.env.VITT_TYPE5_LISTING_URL || TYPE3_LISTING_URL,
  scrollUntilStable: true,
  waitMs: 3000,
  minPackageCards: 4,
  listingTabName: 'All Packages',
  extractWithFlight: true,
  extractWithoutFlight: true,
  extractItinerary: true,
  extractPolicies: false,
  extractSummary: false,
  extractHotels: false,
  extractActivities: false,
  extractTransfers: false,
  maxSidebarClicks: 8,
  packageDetailWaitMs: 2500
};

const SCRAPE_START_DELAY_MS = Number(process.env.VITT_SCRAPE_START_DELAY_MS || 5000);

const SCHEDULED_SCRAPE_TYPES = [
  { key: 'req_type_1', label: 'Type 1 (mmt-listing)', config: TYPE1_LISTING_ONLY },
  { key: 'req_type_2', label: 'Type 2 (mmt-listing-urls)', config: TYPE2_LISTING_URLS },
  { key: 'req_type_3', label: 'Type 3 (mmt-listing-search)', config: TYPE3_LISTING_SEARCH },
  { key: 'req_type_4', label: 'Type 4 (mmt-package)', config: TYPE4_PACKAGE_DETAIL },
  { key: 'req_type_5', label: 'Type 5 (mmt-listing-first-package)', config: TYPE5_FIRST_PACKAGE }
];

function enabledScheduledScrapeTypes() {
  return SCHEDULED_SCRAPE_TYPES.filter(({ key }) => envBool(key, false));
}

function printType3Request(jobId, url, options) {
  const payload = { jobId, url, ...options };
  console.log('\n========== TYPE 3 REQUEST ==========');
  console.log(JSON.stringify(payload, null, 2));
  console.log('====================================\n');
}

function extractDestination(url = '') {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get('destValue') ||
      parsed.searchParams.get('dest') ||
      parsed.searchParams.get('searchDep') ||
      ''
    ).trim();
  } catch {
    const match = String(url).match(/[?&]dest(?:Value)?=([^&]+)/i);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }
}

function printType3DevLog(capture) {
  const devLog = capture?.devLog;
  if (!devLog) return;

  console.log('\n--- TYPE 3 DEV LOG ---');
  console.log(`Search: "${devLog.searchPackageName || ''}"`);
  console.log(`Outcome: ${devLog.outcome || 'unknown'}`);
  if (devLog.totalRounds != null) {
    console.log(`Scroll rounds: ${devLog.totalRounds}, cards in DOM: ${devLog.totalCardsInDom ?? '?'}`);
  }
  if (devLog.rounds?.length) {
    console.log('Scroll rounds:', devLog.rounds.slice(-5));
  }
  if (devLog.events?.length) {
    console.log('Page events:', devLog.events);
  }
  if (devLog.clicks?.length) {
    console.log('Click / intercept attempts:');
    for (const c of devLog.clicks) {
      console.log(`  [${c.label}] ${c.reason} → ${c.url ? c.url.slice(0, 100) : '(no url)'}`);
    }
  }
  if (devLog.background?.events?.length) {
    console.log('Background job timeline:');
    for (const e of devLog.background.events) {
      console.log(`  ${e.ts} ${e.type}`, e.tabId != null ? `tab=${e.tabId}` : '', e.message || e.loadReason || e.reason || '');
    }
  }
  if (devLog.matchedPackage) {
    console.log('Matched package:', devLog.matchedPackage.name, devLog.matchedPackage.detail_url ? 'has URL' : 'NO URL');
  }
  console.log('Note: listing tab always closes with reason job_finished after scrape completes.');
  console.log('Note: detail tab flash + close is normal (URL intercept closes it immediately).');
  console.log('---\n');
}

function printType4Request(jobId, url, options) {
  const payload = { jobId, url, ...options };
  console.log('\n========== TYPE 4 REQUEST ==========');
  console.log(JSON.stringify(payload, null, 2));
  console.log('====================================\n');
}

function printType4DevLog(capture) {
  const devLog = capture?.devLog;
  if (!devLog) return;

  console.log('\n--- TYPE 4 DEV LOG ---');
  console.log(`URL: ${devLog.url || capture?.url || ''}`);
  console.log(`Outcome: ${devLog.outcome || 'unknown'}`);
  if (devLog.durationMs != null) {
    console.log(`Duration: ${(devLog.durationMs / 1000).toFixed(1)}s`);
  }
  if (devLog.options) {
    console.log('Extract options:', devLog.options);
  }
  if (devLog.mainTabs) {
    console.log('Main tabs:', devLog.mainTabs);
  }
  if (devLog.counts) {
    console.log(
      `Sidebars in DOM — hotels: ${devLog.counts.hotels ?? 0}, activities: ${devLog.counts.activities ?? 0}, transfers: ${devLog.counts.transfers ?? 0}`
    );
  }
  if (devLog.captured) {
    console.log(
      `Sidebars captured — hotels: ${devLog.captured.hotels ?? 0}, activities: ${devLog.captured.activities ?? 0}, transfers: ${devLog.captured.transfers ?? 0}`
    );
  }
  if (devLog.events?.length) {
    console.log('Extraction timeline:');
    for (const e of devLog.events) {
      const extra = [
        e.tab != null ? `tab=${e.tab}` : '',
        e.kind != null ? `kind=${e.kind}` : '',
        e.index != null ? `#${e.index}` : '',
        e.preview ? `"${String(e.preview).slice(0, 60)}"` : '',
        e.textLen != null ? `text=${e.textLen}` : '',
        e.found != null ? `found=${e.found}` : '',
        e.error || e.reason || ''
      ]
        .filter(Boolean)
        .join(' ');
      console.log(`  ${e.ts} ${e.type}${extra ? ` — ${extra}` : ''}`);
    }
  }
  if (devLog.background?.events?.length) {
    console.log('Background job timeline:');
    for (const e of devLog.background.events) {
      console.log(`  ${e.ts} ${e.type}`, e.tabId != null ? `tab=${e.tabId}` : '', e.message || e.loadReason || e.reason || '');
    }
  }
  if (capture?.errors?.length) {
    console.log('Errors:', capture.errors);
  }
  console.log('---\n');
}

function printType4Response(jobId, pageType, capture, meta = {}) {
  const devLog = capture?.devLog;
  const sections = Object.keys(capture?.sections || {});
  const sidebarCounts = {
    hotels: capture?.sidebars?.hotels?.length ?? 0,
    activities: capture?.sidebars?.activities?.length ?? 0,
    transfers: capture?.sidebars?.transfers?.length ?? 0
  };

  console.log('\n========== TYPE 4 RESPONSE ==========');
  console.log(JSON.stringify({
    jobId,
    pageType,
    resultPhase: meta.resultPhase || null,
    flight_type: capture?.flight_type || null,
    url: capture?.url,
    title: capture?.title,
    htmlLen: capture?.html?.length ?? 0,
    durationMs: devLog?.durationMs,
    outcome: devLog?.outcome,
    sectionsCaptured: sections,
    sidebarCounts,
    errors: capture?.errors || []
  }, null, 2));
  printType4DevLog(capture);
  console.log('=====================================\n');
}

function printType5ListingResponse(jobId, capture, listingUrl) {
  const pkg =
    capture?.listingPackages?.[0] ||
    capture?.devLog?.matchedPackage ||
    null;
  const hasUrl = Boolean(
    pkg?.detail_url ||
    (pkg?.package_options || []).some((opt) => opt.detail_url)
  );

  console.log('\n========== TYPE 5 RESPONSE (listing) ==========');
  console.log(JSON.stringify({
    jobId,
    pageType: capture?.pageType || 'mmt-listing-first-package',
    resultPhase: 'listing',
    destination: extractDestination(listingUrl || capture?.url || ''),
    firstPackage: pkg,
    hasDetailUrl: hasUrl,
    cardCount: capture?.cardCount,
    package_options: (pkg?.package_options || []).map((opt) => ({
      option_label: opt.option_label,
      detail_url: opt.detail_url || '',
      status: opt.status,
      flight_type: opt.flight_type
    }))
  }, null, 2));
  printType3DevLog(capture);
  console.log('===============================================\n');
}

function printType3Response(jobId, pageType, capture, listingUrl) {
  const pkg = capture?.listingPackages?.[0] || null;
  const hasUrl = Boolean(
    pkg?.detail_url ||
    (pkg?.package_options || []).some((opt) => opt.detail_url)
  );
  const urls = {
    detail_url: pkg?.detail_url || '',
    package_options: (pkg?.package_options || []).map((opt) => ({
      option_label: opt.option_label,
      detail_url: opt.detail_url || '',
      status: opt.status
    }))
  };

  console.log('\n========== TYPE 3 RESPONSE ==========');
  console.log(JSON.stringify({
    jobId,
    pageType,
    found: Boolean(pkg) && hasUrl,
    destination: extractDestination(listingUrl || capture?.url || ''),
    urls,
    package: pkg
  }, null, 2));
  printType3DevLog(capture);
  if (capture?.packageDetails?.length) {
    for (const pd of capture.packageDetails) {
      console.log(`\n--- TYPE 4 DEV LOG (chained from Type 3: ${pd.variant || pd.option_label}) ---`);
      if (pd.error) {
        console.log('Error:', pd.error);
      } else if (pd.capture) {
        printType4DevLog(pd.capture);
      }
    }
  }
  console.log('=====================================\n');
}

fs.mkdirSync(CAPTURE_DIR, { recursive: true });

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

/** @type {Map<string, { url: string, status?: string, pageType?: string }>} */
const jobs = new Map();

function captureFileName() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}.json`;
}

function wsSend(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg) {
  for (const ws of clients) wsSend(ws, msg);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function saveJsonToCapture(data) {
  const file = path.join(CAPTURE_DIR, captureFileName());
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log('saved →', file);
  return file;
}

function sendScrapeRequest(url, options = {}) {
  const jobId = randomUUID();
  const merged = mergeJobOptions(url, options);
  const pageType = merged.scrapeMode;

  jobs.set(jobId, { url, status: 'queued', pageType });

  const msg = {
    type: 'scrape_request',
    jobId,
    url,
    ...merged
  };

  broadcast(msg);
  console.log('[scrape_request]', pageType, url.slice(0, 80), jobId);
  if (pageType === 'mmt-listing-search') {
    printType3Request(jobId, url, merged);
  }
  if (pageType === 'mmt-listing-first-package') {
    console.log('\n========== TYPE 5 REQUEST ==========');
    console.log(JSON.stringify({ jobId, url, ...merged }, null, 2));
    console.log('====================================\n');
  }
  if (pageType === 'mmt-package') {
    printType4Request(jobId, url, merged);
  }
  return jobId;
}

/** Scrape payload from React WS message (nested scrape-data or legacy flat). */
function scrapeDataFromMessage(msg) {
  return msg?.['scrape-data'] || msg?.scrapeData || msg;
}

function onWsMessage(ws, msg) {
  const routeType = msg?.route_type || msg?.type;
  if (!routeType) return;

  switch (routeType) {
    case 'client-init':
      wsSend(ws, { type: 'client-init-ack', ok: true, jobs: [] });
      break;

    // case 'request_scrape': {
    //   const scrapeData = scrapeDataFromMessage(msg);
    //   const urls = scrapeData.urls || (scrapeData.url ? [scrapeData.url] : msg.urls || (msg.url ? [msg.url] : []));
    //   const baseOpts = {
    //     scrollUntilStable: scrapeData.scrollUntilStable ?? msg.scrollUntilStable,
    //     selector: scrapeData.selector ?? msg.selector,
    //     waitMs: scrapeData.waitMs ?? msg.waitMs,
    //     scrapeMode: scrapeData.scrapeMode ?? msg.scrapeMode,
    //     extractWithFlight: scrapeData.extractWithFlight ?? msg.extractWithFlight,
    //     extractWithoutFlight: scrapeData.extractWithoutFlight ?? msg.extractWithoutFlight,
    //     searchPackageName: scrapeData.searchPackageName ?? msg.searchPackageName,
    //     extractItinerary: scrapeData.extractItinerary ?? msg.extractItinerary,
    //     extractPolicies: scrapeData.extractPolicies ?? msg.extractPolicies,
    //     extractSummary: scrapeData.extractSummary ?? msg.extractSummary,
    //     extractHotels: scrapeData.extractHotels ?? msg.extractHotels,
    //     extractActivities: scrapeData.extractActivities ?? msg.extractActivities,
    //     extractTransfers: scrapeData.extractTransfers ?? msg.extractTransfers,
    //     maxSidebarClicks: scrapeData.maxSidebarClicks ?? msg.maxSidebarClicks
    //   };
    //   for (const raw of urls) {
    //     const url = String(raw || '').trim();
    //     if (url) sendScrapeRequest(url, baseOpts);
    //   }
    //   break;
    // }

    case 'scrape_status': {
      const scrapeData = scrapeDataFromMessage(msg);
      const jobId = scrapeData.jobId ?? msg.jobId;
      const url = scrapeData.url ?? msg.url;
      const status = scrapeData.status ?? msg.status;
      const message = scrapeData.message ?? msg.message ?? '';
      if (jobs.has(jobId)) {
        jobs.get(jobId).status = status;
      }
      if (jobs.get(jobId)?.pageType === 'mmt-listing-search' ||
        jobs.get(jobId)?.pageType === 'mmt-listing-first-package' ||
        jobs.get(jobId)?.pageType === 'mmt-package') {
        console.log('[vitt-dev] status', jobId, status, message || '');
      }
      broadcast({
        type: 'job_update',
        job: {
          jobId,
          url,
          status: scrapeData.status ?? msg.status,
          message: scrapeData.message ?? msg.message ?? ''
        }
      });
      break;
    }

    case 'scrape_result': {
      const scrapeData = scrapeDataFromMessage(msg);
      const jobId = scrapeData.jobId ?? msg.jobId;
      const url = scrapeData.url ?? msg.url;
      const extractedUrl = scrapeData.extractedUrl ?? msg.extractedUrl ?? url;
      const capture = scrapeData.capture ?? msg.capture;
      const resultPhase = scrapeData.resultPhase ?? msg.resultPhase ?? null;
      const pageType =
        scrapeData.pageType || capture?.pageType || detectScrapeMode(url);
      const listingUrl = jobs.get(jobId)?.url || url;
      saveJsonToCapture({
        userid: msg.userid || null,
        sessionid: msg.sessionid || null,
        roomId: msg.roomId || null,
        clientSource: msg.source || null,
        'scrape-data': {
          jobId,
          resultPhase,
          source: scrapeData.source || capture?.source || 'automated',
          pageType,
          url: listingUrl,
          extractedUrl,
          capture
        }
      });
      if (pageType === 'mmt-listing-first-package' && (resultPhase === 'listing' || !resultPhase)) {
        printType5ListingResponse(jobId, capture, listingUrl);
      }
      if (pageType === 'mmt-listing-search') {
        printType3Response(jobId, pageType, capture, listingUrl);
      }
      if (pageType === 'mmt-package') {
        printType4Response(jobId, pageType, capture, { resultPhase });
      }
      const jobStatus =
        resultPhase === 'listing' && pageType === 'mmt-listing-first-package'
          ? 'listing_done'
          : resultPhase === 'package_detail'
            ? 'package_detail_done'
            : 'done';
      broadcast({
        type: 'job_update',
        job: {
          jobId,
          url,
          status: jobStatus,
          resultPhase,
          flight_type: capture?.flight_type || null,
          hasCapture: true,
          pageType
        }
      });
      break;
    }

    case 'scrape_error': {
      const scrapeData = scrapeDataFromMessage(msg);
      const jobId = scrapeData.jobId ?? msg.jobId;
      const url = scrapeData.url ?? msg.url;
      const error = scrapeData.error ?? msg.error;
      console.log('[vitt-dev] scrape_error', jobId, error);
      broadcast({
        type: 'job_update',
        job: { jobId, url, status: 'error', error }
      });
      break;
    }

    case 'chat-with-ai':
      wsSend(ws, {
        type: 'chat-with-ai-response',
        ai_chat: '[local stub]',
        content: [],
        res_timestamp: new Date().toISOString()
      });
      break;

    case 'generate-filler':
      wsSend(ws, {
        type: 'generate-filler-response',
        content: ['[local stub]'],
        res_timestamp: new Date().toISOString()
      });
      break;

    default:
      break;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Capture-Token'
    });
    res.end();
    return;
  }

  // if (url.pathname === '/api/capture' && req.method === 'POST') {
  //   ...
  // }

  // if (url.pathname === '/api/scrape' && req.method === 'POST') {
  //   try {
  //     const body = JSON.parse(await readBody(req) || '{}');
  //     const urls = body.urls || (body.url ? [body.url] : []);
  //     const ids = urls.map((u) => sendScrapeRequest(String(u).trim(), body));
  //     json(202, { ok: true, jobIds: ids });
  //   } catch (e) {
  //     json(400, { error: e.message });
  //   }
  //   return;
  // }

  if (url.pathname === '/api/scrape/test-type1' && req.method === 'GET') {
    const jobId = sendScrapeRequest(TYPE1_LISTING_ONLY.url, TYPE1_LISTING_ONLY);
    json(202, { ok: true, jobIds: [jobId], mode: 'mmt-listing' });
    return;
  }

  if (url.pathname === '/api/scrape/test-type2' && req.method === 'GET') {
    const jobId = sendScrapeRequest(TYPE2_LISTING_URLS.url, TYPE2_LISTING_URLS);
    json(202, { ok: true, jobIds: [jobId], mode: 'mmt-listing-urls' });
    return;
  }

  if (url.pathname === '/api/scrape/test-type3' && req.method === 'GET') {
    const jobId = sendScrapeRequest(TYPE3_LISTING_SEARCH.url, TYPE3_LISTING_SEARCH);
    json(202, { ok: true, jobIds: [jobId], mode: 'mmt-listing-search' });
    return;
  }

  if (url.pathname === '/api/scrape/test-type4' && req.method === 'GET') {
    const jobId = sendScrapeRequest(TYPE4_PACKAGE_DETAIL.url, TYPE4_PACKAGE_DETAIL);
    json(202, { ok: true, jobIds: [jobId], mode: 'mmt-package' });
    return;
  }

  if (url.pathname === '/api/scrape/test-type5' && req.method === 'GET') {
    const jobId = sendScrapeRequest(TYPE5_FIRST_PACKAGE.url, TYPE5_FIRST_PACKAGE);
    json(202, { ok: true, jobIds: [jobId], mode: 'mmt-listing-first-package' });
    return;
  }

  if (url.pathname === '/login-post' && req.method === 'POST') {
    json(200, { ok: true, token: 'local-dev-token' });
    return;
  }

  if (url.pathname === '/health') {
    json(200, { ok: true, clients: clients.size });
    return;
  }

  json(404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('client connected, total:', clients.size);

  ws.on('message', (raw) => {
    try {
      onWsMessage(ws, JSON.parse(String(raw)));
    } catch (e) {
      wsSend(ws, { type: 'error', error: e.message });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('client disconnected, total:', clients.size);
  });
});

function runStartupScrape() {
  if (clients.size === 0) {
    console.log('startup scrape: no client connected, skip (restart server after overlay connects)');
    return;
  }

  const enabled = enabledScheduledScrapeTypes();
  if (enabled.length === 0) {
    console.log('startup scrape: no req_type_* enabled in .env, skip');
    return;
  }

  if (enabled.length > 1) {
    console.log(
      'startup scrape: multiple req_type_* enabled — sending first only:',
      enabled[0].label,
      `(ignored: ${enabled.slice(1).map((t) => t.label).join(', ')})`
    );
  }

  const { label, config } = enabled[0];
  console.log(`startup scrape: sending ${label}`);
  sendScrapeRequest(config.url, config);
}

setTimeout(runStartupScrape, SCRAPE_START_DELAY_MS);

server.listen(PORT, HOST, () => {
  const enabled = enabledScheduledScrapeTypes();
  console.log(`Server  http://${HOST}:${PORT}`);
  console.log(`WebSocket  ws://${HOST}:${PORT}/ws`);
  console.log(`Captures  ${CAPTURE_DIR}`);
  console.log(`Startup scrape  once after ${SCRAPE_START_DELAY_MS / 1000}s (restart server to run again)`);
  console.log('Scheduled scrape types (.env — first enabled wins):');
  for (const { key, label } of SCHEDULED_SCRAPE_TYPES) {
    console.log(`  ${key}=${envBool(key, false) ? 'on' : 'off'}  ${label}`);
  }
  if (enabled.length === 0) {
    console.log('  (none enabled — startup scrape will skip until you set req_type_*=true)');
  }
  console.log('Manual triggers:');
  console.log(`  GET http://${HOST}:${PORT}/api/scrape/test-type1`);
  console.log(`  GET http://${HOST}:${PORT}/api/scrape/test-type2`);
  console.log(`  GET http://${HOST}:${PORT}/api/scrape/test-type3`);
  console.log(`  GET http://${HOST}:${PORT}/api/scrape/test-type4`);
  console.log(`  GET http://${HOST}:${PORT}/api/scrape/test-type5`);
});
