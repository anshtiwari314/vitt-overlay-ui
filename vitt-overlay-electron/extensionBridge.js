import http from 'node:http';

const BRIDGE_PORT = Number(process.env.VITT_EXTENSION_BRIDGE_PORT || 38771);
const BRIDGE_HOST = process.env.VITT_EXTENSION_BRIDGE_HOST || '127.0.0.1';

/** @type {((payload: object) => void) | null} */
let onExtensionEvent = null;

/** @type {Array<object>} */
const pendingForExtension = [];

/** @type {boolean} */
let extensionConnected = false;

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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

export function setExtensionBridgeListener(listener) {
  onExtensionEvent = listener;
}

export function enqueueExtensionJob(job) {
  pendingForExtension.push(job);
}

export function isExtensionBridgeConnected() {
  return extensionConnected;
}

/** @type {import('node:http').Server | null} */
let server = null;

export function startExtensionBridge() {
  if (server) return server;

  server = http.createServer(async (req, res) => {
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

    if (url.pathname === '/extension/health' && req.method === 'GET') {
      json(res, 200, { ok: true, connected: extensionConnected, pending: pendingForExtension.length });
      return;
    }

    if (url.pathname === '/extension/ping' && req.method === 'POST') {
      extensionConnected = true;
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/extension/poll' && req.method === 'GET') {
      extensionConnected = true;
      const jobs = pendingForExtension.splice(0, pendingForExtension.length);
      json(res, 200, { jobs, concurrency: 3 });
      return;
    }

    if (url.pathname === '/extension/event' && req.method === 'POST') {
      extensionConnected = true;
      try {
        const body = JSON.parse(await readBody(req) || '{}');
        onExtensionEvent?.(body);
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 400, { ok: false, error: e.message });
      }
      return;
    }

    json(res, 404, { error: 'Not found' });
  });

  server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
    console.log(`Extension bridge http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  });

  return server;
}

export function getExtensionBridgeUrl() {
  return `http://${BRIDGE_HOST}:${BRIDGE_PORT}`;
}
