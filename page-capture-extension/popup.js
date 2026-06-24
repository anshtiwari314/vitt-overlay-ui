const statusBox = document.querySelector('#status');
const queueBox = document.querySelector('#queue');

async function refresh() {
  const saved = await chrome.storage.local.get({
    connectionStatus: 'unknown',
    lastConnectedAt: null,
    bridgeUrl: 'http://127.0.0.1:38771'
  });

  const connected = saved.connectionStatus === 'connected';
  statusBox.textContent = connected
    ? `Connected to Electron bridge at ${saved.bridgeUrl}`
    : 'Not connected — start Vitt Overlay Electron and launch Chrome';
  statusBox.className = `page ${connected ? 'ok' : 'warn'}`;

  queueBox.textContent = saved.lastConnectedAt
    ? `Last poll: ${new Date(saved.lastConnectedAt).toLocaleString()}`
    : 'Jobs arrive from overlay via Electron bridge.';
}

refresh();
setInterval(refresh, 2000);
