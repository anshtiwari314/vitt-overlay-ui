import { WebSocketServer, WebSocket } from 'ws';
import { scrapeJobMessage } from './scrapeJobMessage.js';

const BRIDGE_WS_PORT = Number(process.env.VITT_EXTENSION_BRIDGE_WS_PORT || 38772);
const BRIDGE_HOST = process.env.VITT_EXTENSION_BRIDGE_HOST || '127.0.0.1';

/** @type {((payload: object) => void) | null} */
let onExtensionEvent = null;

/** @type {Array<object>} */
const pendingForExtension = [];

/** @type {import('ws').WebSocket | null} */
let extensionSocket = null;

/** @type {WebSocketServer | null} */
let wss = null;

/** @type {ReturnType<typeof setInterval> | null} */
let pingInterval = null;

/** Source of truth: is the Chrome extension connected to this bridge? */
let extensionConnected = false;

/** @type {((connected: boolean) => void) | null} */
let onConnectionChange = null;

export function getExtensionConnected() {
  return extensionConnected;
}

export function setExtensionConnectionChangeListener(listener) {
  onConnectionChange = listener;
}

function setExtensionConnected(connected) {
  const next = Boolean(connected);
  if (extensionConnected === next) return;
  extensionConnected = next;
  console.log('extension bridge connected:', next);
  onConnectionChange?.(extensionConnected);
}

function sendToExtension(payload) {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    extensionSocket.send(JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('sendToExtension', e);
    return false;
  }
}

function flushPendingJobs() {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) return;
  while (pendingForExtension.length > 0) {
    const job = pendingForExtension.shift();
    const sent = sendToExtension(scrapeJobMessage(job));
    if (!sent) {
      pendingForExtension.unshift(job);
      break;
    }
  }
}

export function setExtensionBridgeListener(listener) {
  onExtensionEvent = listener;
}

export function enqueueExtensionJob(job) {
  const sent = sendToExtension(scrapeJobMessage(job));
  if (!sent) {
    pendingForExtension.push(job);
  }
}

/** Push any JSON command to the extension (bidirectional). */
export function sendExtensionCommand(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid payload' };
  }
  const sent = sendToExtension(payload);
  if (!sent) {
    return { ok: false, error: 'Extension not connected' };
  }
  return { ok: true };
}

export function isExtensionBridgeConnected() {
  return extensionSocket != null && extensionSocket.readyState === WebSocket.OPEN;
}

export function startExtensionBridge() {
  if (wss) return wss;

  wss = new WebSocketServer({ host: BRIDGE_HOST, port: BRIDGE_WS_PORT });

  wss.on('connection', (ws, req) => {
    const remote = req.socket.remoteAddress;
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      console.warn('Extension bridge rejected non-local connection from', remote);
      ws.close(1008, 'Local connections only');
      return;
    }

    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      try {
        extensionSocket.close(1000, 'Replaced by new connection');
      } catch {
        /* ignore */
      }
    }

    extensionSocket = ws;
    console.log('Extension connected via WebSocket');
    setExtensionConnected(true);
    flushPendingJobs();

    ws.on('message', (raw) => {
      try {
        const body = JSON.parse(String(raw));
        if (body.type === 'pong' || body.type === 'extension_ping') return;
        if (body.type === 'extension_ready') {
          setExtensionConnected(true);
          flushPendingJobs();
          return;
        }
        onExtensionEvent?.(body);
      } catch (e) {
        console.error('extensionBridge ws message', e);
      }
    });

    ws.on('close', (code, reason) => {
      if (extensionSocket === ws) {
        extensionSocket = null;
        console.log('Extension WebSocket disconnected', code, reason?.toString?.() || '');
        setExtensionConnected(false);
      }
    });

    ws.on('error', (err) => {
      console.error('extensionBridge ws client error', err);
    });
  });

  wss.on('listening', () => {
    console.log(`Extension bridge ws://${BRIDGE_HOST}:${BRIDGE_WS_PORT}`);
  });

  wss.on('error', (err) => {
    console.error('extensionBridge wss error', err);
  });

  pingInterval = setInterval(() => {
    if (extensionSocket?.readyState === WebSocket.OPEN) {
      sendToExtension({ type: 'ping' });
    }
  }, 20000);
  if (pingInterval.unref) pingInterval.unref();

  return wss;
}

export function getExtensionBridgeUrl() {
  return `ws://${BRIDGE_HOST}:${BRIDGE_WS_PORT}`;
}

export function getExtensionBridgeWsPort() {
  return BRIDGE_WS_PORT;
}
