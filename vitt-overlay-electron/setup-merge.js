#!/usr/bin/env node
/**
 * One-time setup: copy React client src/ into this Electron app.
 * Run from repo root: node vitt-overlay-electron/setup-merge.js
 * Or from vitt-overlay-electron: node setup-merge.js
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const reactSrc = path.join(repoRoot, 'vitt-overlay-react-client', 'src');
const electronSrc = path.join(__dirname, 'src');

if (!fs.existsSync(reactSrc)) {
  console.error('Not found:', reactSrc);
  process.exit(1);
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(electronSrc)) {
  console.log('vitt-overlay-electron/src already exists. Remove it first to re-copy.');
  process.exit(0);
}

copyRecursive(reactSrc, electronSrc);
console.log('Copied vitt-overlay-react-client/src -> vitt-overlay-electron/src');
console.log('Next: cd vitt-overlay-electron && npm install && npm run build:renderer && npm start');
