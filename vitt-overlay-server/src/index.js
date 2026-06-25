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

function onWsMessage(ws, msg) {
  if (!msg?.type) return;

  switch (msg.type) {
    case 'client-init':
      wsSend(ws, { type: 'client-init-ack', ok: true, jobs: [] });
      break;

    case 'request_scrape': {
      const urls = msg.urls || (msg.url ? [msg.url] : []);
      const baseOpts = {
        scrollUntilStable: msg.scrollUntilStable,
        selector: msg.selector,
        waitMs: msg.waitMs,
        scrapeMode: msg.scrapeMode,
        extractItinerary: msg.extractItinerary,
        extractPolicies: msg.extractPolicies,
        extractSummary: msg.extractSummary,
        extractHotels: msg.extractHotels,
        extractActivities: msg.extractActivities,
        extractTransfers: msg.extractTransfers,
        maxSidebarClicks: msg.maxSidebarClicks
      };
      for (const raw of urls) {
        const url = String(raw || '').trim();
        if (url) sendScrapeRequest(url, baseOpts);
      }
      break;
    }

    case 'scrape_status':
      if (jobs.has(msg.jobId)) {
        jobs.get(msg.jobId).status = msg.status;
      }
      broadcast({
        type: 'job_update',
        job: {
          jobId: msg.jobId,
          url: msg.url,
          status: msg.status,
          message: msg.message || ''
        }
      });
      break;

    case 'scrape_result': {
      const pageType = msg.pageType || msg.capture?.pageType || detectScrapeMode(msg.url);
      saveJsonToCapture({
        jobId: msg.jobId,
        source: msg.source || 'automated',
        pageType,
        url: jobs.get(msg.jobId)?.url || msg.url,
        extractedUrl: msg.extractedUrl || msg.url,
        filtered: msg.filtered || null,
        capture: msg.capture
      });
      broadcast({
        type: 'job_update',
        job: { jobId: msg.jobId, url: msg.url, status: 'done', hasCapture: true, pageType }
      });
      break;
    }

    case 'scrape_error':
      broadcast({
        type: 'job_update',
        job: { jobId: msg.jobId, url: msg.url, status: 'error', error: msg.error }
      });
      break;

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
  sendScrapeRequest(LISTING_SCRAPE_URL, { scrapeMode: 'mmt-listing' });
  sendScrapeRequest(PACKAGE_SCRAPE_URL, { scrapeMode: 'mmt-package', ...PACKAGE_EXTRACT_DEFAULTS });
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
