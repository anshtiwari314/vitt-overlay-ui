const serverUrl = document.querySelector('#serverUrl');
const localToken = document.querySelector('#localToken');
const bridgeUrl = document.querySelector('#bridgeUrl');
const concurrency = document.querySelector('#concurrency');
const status = document.querySelector('#status');

async function load() {
  const saved = await chrome.storage.local.get({
    serverUrl: 'http://127.0.0.1:5000',
    localToken: 'vitt-local-capture-token',
    bridgeUrl: 'ws://127.0.0.1:38772',
    concurrency: 3
  });
  serverUrl.value = saved.serverUrl;
  localToken.value = saved.localToken;
  bridgeUrl.value = saved.bridgeUrl;
  concurrency.value = saved.concurrency;
}

document.querySelector('#save').addEventListener('click', async () => {
  let bridge = bridgeUrl.value.trim().replace(/\/$/, '');
  if (bridge.startsWith('http://')) bridge = `ws://${bridge.slice(7)}`;
  if (bridge.startsWith('https://')) bridge = `wss://${bridge.slice(8)}`;
  bridge = bridge.replace(':38771', ':38772');

  await chrome.storage.local.set({
    serverUrl: serverUrl.value.trim().replace(/\/$/, ''),
    localToken: localToken.value,
    bridgeUrl: bridge,
    concurrency: Number(concurrency.value) || 3
  });
  status.textContent = 'Settings saved.';
  status.className = 'status show success';
});

load();
