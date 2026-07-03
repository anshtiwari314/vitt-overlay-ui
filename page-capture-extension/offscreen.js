const DEFAULT_BRIDGE_WS = 'ws://127.0.0.1:38772';
const DEFAULT_CONNECT_WAIT_MS = 10000;
const CONNECT_POLL_MS = 250;

/** @type {WebSocket | null} */
let bridgeSocket = null;
let bridgeWsUrl = DEFAULT_BRIDGE_WS;
/** @type {ReturnType<typeof setTimeout> | null} */
let reconnectTimer = null;
let reconnectDelayMs = 1000;
let extensionVersion = '1.0.0';

function normalizeBridgeWsUrl(input) {
  let url = (input || DEFAULT_BRIDGE_WS).trim().replace(/\/$/, '');
  if (url.startsWith('http://')) url = `ws://${url.slice(7)}`;
  if (url.startsWith('https://')) url = `wss://${url.slice(8)}`;
  if (!url.startsWith('ws')) url = DEFAULT_BRIDGE_WS;
  return url.replace(':38771', ':38772');
}

function postToServiceWorker(payload) {
  chrome.runtime.sendMessage({ channel: 'bridge', ...payload }).catch(() => {});
}

function notifyStatus(connected) {
  postToServiceWorker({ type: 'status', connected });
}

function isBridgeOpen() {
  return bridgeSocket?.readyState === WebSocket.OPEN;
}

function sendOnSocket(payload) {
  if (!isBridgeOpen()) {
    return false;
  }
  try {
    bridgeSocket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function waitForBridgeOpen(timeoutMs = DEFAULT_CONNECT_WAIT_MS) {
  if (isBridgeOpen()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (isBridgeOpen()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(poll, CONNECT_POLL_MS);
    };
    poll();
  });
}

function cancelScheduledReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
    connectBridge();
  }, reconnectDelayMs);
}

function attachSocketListeners(socket) {
  socket.addEventListener('open', () => {
    reconnectDelayMs = 1000;
    notifyStatus(true);
    sendOnSocket({
      type: 'extension_ready',
      version: extensionVersion
    });
  });

  socket.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }

    if (msg.type === 'ping') {
      sendOnSocket({ type: 'pong' });
      return;
    }

    postToServiceWorker({ type: 'message', payload: msg });
  });

  socket.addEventListener('close', () => {
    if (bridgeSocket === socket) {
      bridgeSocket = null;
    }
    notifyStatus(false);
    scheduleReconnect();
  });

  socket.addEventListener('error', () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  });
}

function connectBridge() {
  if (isBridgeOpen()) return;
  if (bridgeSocket?.readyState === WebSocket.CONNECTING) return;

  cancelScheduledReconnect();

  try {
    const socket = new WebSocket(bridgeWsUrl);
    bridgeSocket = socket;
    attachSocketListeners(socket);
  } catch {
    bridgeSocket = null;
    notifyStatus(false);
    scheduleReconnect();
  }
}

function resetBridge() {
  cancelScheduledReconnect();
  if (bridgeSocket) {
    try {
      bridgeSocket.close();
    } catch {
      /* ignore */
    }
    bridgeSocket = null;
  }
  reconnectDelayMs = 1000;
}

async function ensureBridgeOpen(timeoutMs = DEFAULT_CONNECT_WAIT_MS) {
  if (!isBridgeOpen()) {
    connectBridge();
  }
  return waitForBridgeOpen(timeoutMs);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.channel !== 'bridge') return;

  if (msg.type === 'connect') {
    bridgeWsUrl = normalizeBridgeWsUrl(msg.url);
    if (msg.version) extensionVersion = msg.version;
    resetBridge();
    connectBridge();
    void ensureBridgeOpen(msg.timeoutMs ?? DEFAULT_CONNECT_WAIT_MS).then((open) => {
      sendResponse({ ok: open });
    });
    return true;
  }

  if (msg.type === 'send') {
    void (async () => {
      const open = await ensureBridgeOpen(msg.timeoutMs ?? 5000);
      sendResponse({ ok: open && sendOnSocket(msg.payload) });
    })();
    return true;
  }

  if (msg.type === 'ping') {
    void (async () => {
      const timeoutMs = msg.timeoutMs ?? DEFAULT_CONNECT_WAIT_MS;
      const open = await ensureBridgeOpen(timeoutMs);
      if (open) {
        sendOnSocket({ type: 'extension_ping' });
      }
      sendResponse({ ok: open });
    })();
    return true;
  }
});
