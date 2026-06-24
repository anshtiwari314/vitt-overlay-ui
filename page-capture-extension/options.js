const bridgeUrl = document.querySelector('#bridgeUrl');
const concurrency = document.querySelector('#concurrency');
const status = document.querySelector('#status');

async function load() {
  const saved = await chrome.storage.local.get({
    bridgeUrl: 'http://127.0.0.1:38771',
    concurrency: 3
  });
  bridgeUrl.value = saved.bridgeUrl;
  concurrency.value = saved.concurrency;
}

document.querySelector('#save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    bridgeUrl: bridgeUrl.value.trim().replace(/\/$/, ''),
    concurrency: Number(concurrency.value) || 3
  });
  status.textContent = 'Saved. Extension will reconnect to Electron bridge.';
  status.className = 'status show success';
});

load();
