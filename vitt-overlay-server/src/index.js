import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || process.env.VITT_PORT || 5000);
const HOST = process.env.VITT_HOST || '127.0.0.1';
const CAPTURE_DIR = process.env.VITT_CAPTURE_DIR || path.join(__dirname, '..', '..', 'captures');

fs.mkdirSync(CAPTURE_DIR, { recursive: true });

/** @type {Set<import('ws').WebSocket>} */
const overlayClients = new Set();

/** @type {Map<string, object>} */
const jobs = new Map();

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcastOverlay(payload) {
  for (const ws of overlayClients) send(ws, payload);
}

function trackClient(ws) {
  overlayClients.add(ws);
  ws.isOverlay = true;
}

function publicJob(job) {
  return {
    jobId: job.jobId,
    url: job.url,
    status: job.status,
    message: job.message || '',
    scrollUntilStable: job.scrollUntilStable !== false,
    selector: job.selector || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    extractedUrl: job.extractedUrl || null,
    error: job.error || null,
    hasCapture: Boolean(job.capture)
  };
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  broadcastOverlay({ type: 'job_update', job: publicJob(job) });
  return job;
}

function dispatchScrapeRequest(job) {
  broadcastOverlay({
    type: 'scrape_request',
    jobId: job.jobId,
    url: job.url,
    scrollUntilStable: job.scrollUntilStable,
    selector: job.selector,
    waitMs: job.waitMs
  });
}

function enqueueScrapeJobs(urls, options = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  const created = [];

  for (const rawUrl of list) {
    const url = String(rawUrl || '').trim();
    if (!url) continue;
    const jobId = randomUUID();
    const job = {
      jobId,
      url,
      status: 'queued',
      message: 'Queued — waiting for overlay',
      scrollUntilStable: options.scrollUntilStable !== false,
      selector: options.selector || null,
      waitMs: options.waitMs || 4000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      capture: null,
      extractedUrl: null,
      error: null
    };
    jobs.set(jobId, job);
    created.push(job);
    broadcastOverlay({ type: 'job_update', job: publicJob(job) });
    dispatchScrapeRequest(job);
  }

  return created.map(publicJob);
}

function persistCapture(job) {
  if (!job?.capture) return;
  const safeName = `${job.updatedAt.replace(/[:.]/g, '-')}_${job.jobId}.json`;
  const file = path.join(CAPTURE_DIR, safeName);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        jobId: job.jobId,
        url: job.url,
        extractedUrl: job.extractedUrl || job.url,
        capturedAt: job.capture.capturedAt || job.updatedAt,
        capture: job.capture
      },
      null,
      2
    )
  );
  return file;
}

/** Stub overlay handlers — replicate AWS server enough for local dev. Do not remove message types. */
function handleOverlayMessage(ws, msg) {
  trackClient(ws);

  switch (msg.type) {
    case 'client-init':
      send(ws, {
        type: 'client-init-ack',
        ok: true,
        message: 'Connected to local vitt-overlay-server',
        jobs: [...jobs.values()].map(publicJob)
      });
      break;

    case 'chat-with-ai':
      send(ws, {
        type: 'chat-with-ai-response',
        ai_chat: '[local server stub] Chat received.',
        content: [],
        res_timestamp: new Date().toISOString()
      });
      break;

    case 'data-info-update-req':
      send(ws, { type: 'data-info-update-ack', ok: true });
      break;

    case 'room-update':
      send(ws, { type: 'room-update-ack', ok: true, roomId: msg.roomId });
      break;

    case 'recall-buffer':
      send(ws, { type: 'recall-buffer-ack', ok: true });
      break;

    case 'generate-filler':
      send(ws, {
        type: 'generate-filler-response',
        content: ['[local server stub] Suggestion placeholder.'],
        res_timestamp: new Date().toISOString()
      });
      break;

    default:
      break;
  }
}

function handleScrapeMessage(ws, msg) {
  trackClient(ws);

  switch (msg.type) {
    case 'request_scrape': {
      const created = enqueueScrapeJobs(msg.urls || [msg.url], {
        scrollUntilStable: msg.scrollUntilStable,
        selector: msg.selector,
        waitMs: msg.waitMs
      });
      send(ws, { type: 'scrape_queued', jobs: created });
      break;
    }

    case 'scrape_status':
      updateJob(msg.jobId, {
        status: msg.status || 'running',
        message: msg.message || '',
        extractedUrl: msg.url || msg.extractedUrl || undefined
      });
      break;

    case 'scrape_result': {
      const job = jobs.get(msg.jobId);
      if (!job) break;
      job.status = 'done';
      job.message = 'Capture complete';
      job.extractedUrl = msg.url || msg.extractedUrl || job.url;
      job.capture = msg.capture || null;
      job.error = null;
      job.updatedAt = new Date().toISOString();
      persistCapture(job);
      broadcastOverlay({ type: 'job_update', job: publicJob(job) });
      break;
    }

    case 'scrape_error':
      updateJob(msg.jobId, {
        status: 'error',
        message: msg.error || 'Scrape failed',
        error: msg.error || 'Scrape failed',
        extractedUrl: msg.url || undefined
      });
      break;

    default:
      break;
  }
}

function handleMessage(ws, msg) {
  if (!msg || typeof msg !== 'object') return;

  const overlayTypes = new Set([
    'client-init',
    'chat-with-ai',
    'data-info-update-req',
    'room-update',
    'recall-buffer',
    'generate-filler'
  ]);

  const scrapeTypes = new Set([
    'request_scrape',
    'scrape_status',
    'scrape_result',
    'scrape_error'
  ]);

  if (overlayTypes.has(msg.type)) handleOverlayMessage(ws, msg);
  if (scrapeTypes.has(msg.type)) handleScrapeMessage(ws, msg);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (url.pathname === '/health') {
    json(res, 200, { ok: true, overlayClients: overlayClients.size, jobs: jobs.size });
    return;
  }

  if (url.pathname === '/api/jobs' && req.method === 'GET') {
    json(res, 200, { jobs: [...jobs.values()].map(publicJob) });
    return;
  }

  if (url.pathname === '/api/scrape' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req) || '{}');
      const jobsCreated = enqueueScrapeJobs(body.urls || [], body);
      json(res, 202, { ok: true, jobs: jobsCreated });
    } catch (e) {
      json(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  if (url.pathname === '/login-post' && req.method === 'POST') {
    json(res, 200, { ok: true, token: 'local-dev-token', message: 'Local login stub' });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      handleMessage(ws, JSON.parse(String(raw)));
    } catch (e) {
      send(ws, { type: 'error', error: e.message });
    }
  });
  ws.on('close', () => overlayClients.delete(ws));
});

server.listen(PORT, HOST, () => {
  console.log(`vitt-overlay-server (local AWS replica) http://${HOST}:${PORT}`);
  console.log(`WebSocket ws://${HOST}:${PORT}/ws`);
  console.log(`Captures: ${CAPTURE_DIR}`);
});
