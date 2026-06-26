import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { detectScrapeMode, mergeJobOptions } from './scrapeJobOptions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

/** Type 2 — listing + click-through detail URLs (uncomment in runScheduledScrapes to test). */
const TYPE2_LISTING_URLS = {
  scrapeMode: 'mmt-listing-urls',
  url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Goa',
  extractWithFlight: true,
  extractWithoutFlight: true,
  scrollUntilStable: true,
  waitMs: 3000
};

/** Type 3 — find one package on listing + its detail URL(s) (uncomment in runScheduledScrapes to test). */
const TYPE3_LISTING_SEARCH = {
  scrapeMode: 'mmt-listing-search',
  url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Kolkata',
  searchPackageName: 'kolkata 2 nightful joy journey',
  extractWithFlight: true,
  extractWithoutFlight: false,
  scrollUntilStable: true,
  waitMs: 3000
};

const SCRAPE_EVERY_MS = Number(process.env.VITT_SCHEDULED_SCRAPE_INTERVAL_MS || 2 * 60 * 1000);

/** Default package extract flags (override per request). */
const PACKAGE_EXTRACT_DEFAULTS = {
  extractItinerary: true,
  extractPolicies: true,
  extractSummary: true,
  extractHotels: true,
  extractActivities: true,
  extractTransfers: true,
  maxSidebarClicks: 8,
  waitMs: 2500,
  scrollUntilStable: false
};

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

    case 'request_scrape': {
      const scrapeData = scrapeDataFromMessage(msg);
      const urls = scrapeData.urls || (scrapeData.url ? [scrapeData.url] : msg.urls || (msg.url ? [msg.url] : []));
      const baseOpts = {
        scrollUntilStable: scrapeData.scrollUntilStable ?? msg.scrollUntilStable,
        selector: scrapeData.selector ?? msg.selector,
        waitMs: scrapeData.waitMs ?? msg.waitMs,
        scrapeMode: scrapeData.scrapeMode ?? msg.scrapeMode,
        extractWithFlight: scrapeData.extractWithFlight ?? msg.extractWithFlight,
        extractWithoutFlight: scrapeData.extractWithoutFlight ?? msg.extractWithoutFlight,
        searchPackageName: scrapeData.searchPackageName ?? msg.searchPackageName,
        extractItinerary: scrapeData.extractItinerary ?? msg.extractItinerary,
        extractPolicies: scrapeData.extractPolicies ?? msg.extractPolicies,
        extractSummary: scrapeData.extractSummary ?? msg.extractSummary,
        extractHotels: scrapeData.extractHotels ?? msg.extractHotels,
        extractActivities: scrapeData.extractActivities ?? msg.extractActivities,
        extractTransfers: scrapeData.extractTransfers ?? msg.extractTransfers,
        maxSidebarClicks: scrapeData.maxSidebarClicks ?? msg.maxSidebarClicks
      };
      for (const raw of urls) {
        const url = String(raw || '').trim();
        if (url) sendScrapeRequest(url, baseOpts);
      }
      break;
    }

    case 'scrape_status': {
      const scrapeData = scrapeDataFromMessage(msg);
      const jobId = scrapeData.jobId ?? msg.jobId;
      const url = scrapeData.url ?? msg.url;
      if (jobs.has(jobId)) {
        jobs.get(jobId).status = scrapeData.status ?? msg.status;
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
      const pageType =
        scrapeData.pageType || capture?.pageType || detectScrapeMode(url);
      saveJsonToCapture({
        userid: msg.userid || null,
        sessionid: msg.sessionid || null,
        roomId: msg.roomId || null,
        clientSource: msg.source || null,
        'scrape-data': {
          jobId,
          source: scrapeData.source || capture?.source || 'automated',
          pageType,
          url: jobs.get(jobId)?.url || url,
          extractedUrl,
          filtered: scrapeData.filtered ?? msg.filtered ?? null,
          capture
        }
      });
      broadcast({
        type: 'job_update',
        job: { jobId, url, status: 'done', hasCapture: true, pageType }
      });
      break;
    }

    case 'scrape_error': {
      const scrapeData = scrapeDataFromMessage(msg);
      const jobId = scrapeData.jobId ?? msg.jobId;
      const url = scrapeData.url ?? msg.url;
      const error = scrapeData.error ?? msg.error;
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

  if (url.pathname === '/api/capture' && req.method === 'POST') {
    const token = req.headers['x-capture-token'] || '';
    const a = Buffer.from(String(token));
    const b = Buffer.from(CAPTURE_TOKEN);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      json(401, { error: 'Bad token' });
      return;
    }
    try {
      const capture = JSON.parse(await readBody(req));
      const file = saveJsonToCapture({ source: 'extension-popup', pageType: 'manual', capture });
      broadcast({
        type: 'capture_received',
        url: capture.url,
        title: capture.title || '',
        file: path.basename(file)
      });
      json(201, { ok: true, file: path.basename(file) });
    } catch (e) {
      json(400, { error: e.message });
    }
    return;
  }

  if (url.pathname === '/api/scrape' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req) || '{}');
      const urls = body.urls || (body.url ? [body.url] : []);
      const ids = urls.map((u) => sendScrapeRequest(String(u).trim(), body));
      json(202, { ok: true, jobIds: ids });
    } catch (e) {
      json(400, { error: e.message });
    }
    return;
  }

  // --- REST test shortcuts (uncomment one route to fire on GET, e.g. curl http://127.0.0.1:5000/api/scrape/test-type2) ---
  // if (url.pathname === '/api/scrape/test-type2' && req.method === 'GET') {
  //   const jobId = sendScrapeRequest(TYPE2_LISTING_URLS.url, TYPE2_LISTING_URLS);
  //   json(202, { ok: true, jobIds: [jobId], mode: 'mmt-listing-urls' });
  //   return;
  // }
  // if (url.pathname === '/api/scrape/test-type3' && req.method === 'GET') {
  //   const jobId = sendScrapeRequest(TYPE3_LISTING_SEARCH.url, TYPE3_LISTING_SEARCH);
  //   json(202, { ok: true, jobIds: [jobId], mode: 'mmt-listing-search' });
  //   return;
  // }

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

function runScheduledScrapes() {
  if (clients.size === 0) {
    console.log('timer: no client connected, skip');
    return;
  }

  // --- Type 1 + Type 4 (default timer) — commented out while testing Type 2 / 3 ---
  // sendScrapeRequest(LISTING_SCRAPE_URL, { scrapeMode: 'mmt-listing' });
  // sendScrapeRequest(PACKAGE_SCRAPE_URL, { scrapeMode: 'mmt-package', ...PACKAGE_EXTRACT_DEFAULTS });

  // --- Type 2: listing + package detail URLs ---
  sendScrapeRequest(TYPE2_LISTING_URLS.url, TYPE2_LISTING_URLS);

  // --- Type 3: search one package on listing (uncomment to test instead of Type 2) ---
  // sendScrapeRequest(TYPE3_LISTING_SEARCH.url, TYPE3_LISTING_SEARCH);
}

setInterval(runScheduledScrapes, SCRAPE_EVERY_MS);

server.listen(PORT, HOST, () => {
  console.log(`Server  http://${HOST}:${PORT}`);
  console.log(`WebSocket  ws://${HOST}:${PORT}/ws`);
  console.log(`Captures  ${CAPTURE_DIR}`);
  console.log(`Timer  every ${SCRAPE_EVERY_MS / 1000}s`);
  console.log(`Listing  ${LISTING_SCRAPE_URL}`);
  console.log(`Package  ${PACKAGE_SCRAPE_URL.slice(0, 90)}...`);
});
