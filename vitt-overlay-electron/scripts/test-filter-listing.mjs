import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterListingCapture } from '../filterScrapeData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const capturePath =
  process.argv[2] ||
  path.join(__dirname, '../../vitt-overlay-server/capture/25-06-2026-00-26-48-018.json');

const raw = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
const capture = raw.capture || raw;
const url = raw.url || capture.url || '';
const result = filterListingCapture(capture, url);
const dest = Object.keys(result)[0];
const packages = result[dest] || [];

console.log('file:', path.basename(capturePath));
console.log('destination:', dest);
console.log('filtered packages:', packages.length);
console.log('names:', packages.map((p) => p.name).join('\n  '));
