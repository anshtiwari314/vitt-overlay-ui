import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_CANDIDATES = {
  linux: [
    'google-chrome-stable',
    'google-chrome',
    'chromium-browser',
    'chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ],
  win32: [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ]
};

function findChromeExecutable() {
  const platform = process.platform;
  const candidates = CHROME_CANDIDATES[platform] || CHROME_CANDIDATES.linux;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (fs.existsSync(candidate)) return candidate;
    if (platform !== 'win32') {
      try {
        const which = spawn('which', [candidate.split('/').pop()], { stdio: ['ignore', 'pipe', 'ignore'] });
        // sync-ish fallback: just check path
      } catch { /* ignore */ }
    }
  }
  return candidates.find((c) => c && fs.existsSync(c)) || null;
}

export function getExtensionPath() {
  return path.resolve(__dirname, '..', 'page-capture-extension');
}

export function launchChromeWithExtension(options = {}) {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error('Google Chrome or Chromium was not found on this system.');
  }

  const extensionPath = getExtensionPath();
  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error(`Extension not found at ${extensionPath}`);
  }

  const userDataDir =
    options.userDataDir ||
    path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.vitt-chrome-capture');

  const args = [
    `--load-extension=${extensionPath}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions-except=' + extensionPath
  ];

  if (options.url) {
    args.push(options.url);
  } else {
    args.push('about:blank');
  }

  const child = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  return {
    ok: true,
    chromePath,
    extensionPath,
    userDataDir,
    pid: child.pid
  };
}

export function getScrapeServerDefaults() {
  return {
    httpBase: process.env.VITT_PORT ? `http://127.0.0.1:${process.env.VITT_PORT}` : 'http://127.0.0.1:5000',
    wsUrl: process.env.VITT_PORT ? `ws://127.0.0.1:${process.env.VITT_PORT}/ws` : 'ws://127.0.0.1:5000/ws',
    bridgeUrl: process.env.VITT_EXTENSION_BRIDGE_PORT
      ? `http://127.0.0.1:${process.env.VITT_EXTENSION_BRIDGE_PORT}`
      : 'http://127.0.0.1:38771'
  };
}
