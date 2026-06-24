const DEFAULT_BRIDGE_WS = 'ws://127.0.0.1:38772';

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

function sendOnSocket(payload) {
  if (!bridgeSocket || bridgeSocket.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    bridgeSocket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
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

function connectBridge() {
  if (
    bridgeSocket &&
    (bridgeSocket.readyState === WebSocket.CONNECTING || bridgeSocket.readyState === WebSocket.OPEN)
  ) {
    return;
  }

  try {
    bridgeSocket = new WebSocket(bridgeWsUrl);
  } catch {
    notifyStatus(false);
    scheduleReconnect();
    return;
  }

  bridgeSocket.addEventListener('open', () => {
    reconnectDelayMs = 1000;
    notifyStatus(true);
    sendOnSocket({
      type: 'extension_ready',
      version: extensionVersion
    });
  });

  bridgeSocket.addEventListener('message', (event) => {
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

  bridgeSocket.addEventListener('close', () => {
    bridgeSocket = null;
    notifyStatus(false);
    scheduleReconnect();
  });

  bridgeSocket.addEventListener('error', () => {
    try {
      bridgeSocket?.close();
    } catch {
      /* ignore */
    }
  });
}

function resetBridge() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.channel !== 'bridge') return;

  if (msg.type === 'connect') {
    bridgeWsUrl = normalizeBridgeWsUrl(msg.url);
    if (msg.version) extensionVersion = msg.version;
    resetBridge();
    connectBridge();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'send') {
    sendResponse({ ok: sendOnSocket(msg.payload) });
    return true;
  }

  if (msg.type === 'ping') {
    const open = bridgeSocket?.readyState === WebSocket.OPEN;
    if (!open) {
      connectBridge();
    } else {
      sendOnSocket({ type: 'extension_ping' });
    }
    sendResponse({ ok: open });
    return true;
  }
});
