const captureButton = document.querySelector('#capture');
const statusBox = document.querySelector('#status');
const pageBox = document.querySelector('#page');
const bridgeStatusBox = document.querySelector('#bridgeStatus');
const screenshotBox = document.querySelector('#screenshot');

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab was found.');
  return tab;
}

async function refreshBridgeStatus() {
  const saved = await chrome.storage.local.get({
    bridgeUrl: 'ws://127.0.0.1:38772',
    connectionStatus: 'unknown',
    lastConnectedAt: null
  });
  const connected = saved.connectionStatus === 'connected';
  bridgeStatusBox.textContent = connected
    ? `Overlay bridge: connected (${saved.bridgeUrl}) — capture routes through Electron`
    : `Overlay bridge: offline — launch Vitt Overlay and open Chrome from it`;
  bridgeStatusBox.className = connected ? 'hint ok' : 'hint warn';
}

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

async function initialize() {
  try {
    const tab = await currentTab();
    pageBox.textContent = tab.title || tab.url || 'Current page';
    const saved = await chrome.storage.local.get({ includeScreenshot: false });
    screenshotBox.checked = saved.includeScreenshot;
    await refreshBridgeStatus();
  } catch (error) {
    showStatus(error.message, 'error');
    captureButton.disabled = true;
  }
}

screenshotBox.addEventListener('change', () =>
  chrome.storage.local.set({ includeScreenshot: screenshotBox.checked })
);

captureButton.addEventListener('click', async () => {
  captureButton.disabled = true;
  showStatus('Capturing current page…', 'working');

  try {
    const tab = await currentTab();
    if (!/^https?:/i.test(tab.url || '')) {
      throw new Error('Chrome internal pages cannot be captured. Open a normal website first.');
    }

    const result = await chrome.runtime.sendMessage({
      channel: 'manual_capture',
      tabId: tab.id,
      includeScreenshot: screenshotBox.checked
    });

    if (!result?.ok) {
      throw new Error(result?.error || 'Manual capture failed.');
    }

    showStatus(
      `Captured and sent via overlay (${result.title || result.url || 'page'}).`,
      'success'
    );
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    captureButton.disabled = false;
  }
});

initialize();
setInterval(refreshBridgeStatus, 3000);
