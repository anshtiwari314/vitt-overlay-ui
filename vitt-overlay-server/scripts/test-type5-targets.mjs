/**
 * Unit test: Type 5 listing capture → package detail targets (no browser).
 * Run: node vitt-overlay-server/scripts/test-type5-targets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function collectPackageDetailTargets(listingPkg, job = {}) {
  if (!listingPkg) return [];

  const targets = [];
  const seen = new Set();

  const add = (detail_url, option_label, flight_type) => {
    const url = String(detail_url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    targets.push({
      detail_url: url,
      option_label: option_label || flight_type || 'package',
      flight_type: flight_type || 'default'
    });
  };

  for (const opt of listingPkg.package_options || []) {
    if (!opt.detail_url || opt.status === 'sold out') continue;
    const label = String(opt.option_label || '').toLowerCase();
    const isWithFlight = label.includes('with flight');
    const isWithoutFlight = label.includes('without flight');
    if (isWithFlight && job.extractWithFlight === false) continue;
    if (isWithoutFlight && job.extractWithoutFlight === false) continue;
    const flight_type =
      opt.flight_type ||
      (isWithFlight ? 'withFlight' : isWithoutFlight ? 'withoutFlight' : 'default');
    add(opt.detail_url, opt.option_label, flight_type);
  }

  if (!targets.length && listingPkg.detail_url) {
    add(listingPkg.detail_url, listingPkg.name || 'package', listingPkg.flight_type || 'default');
  }

  return targets;
}

function resolveFirstListingPackage(capture) {
  const fromList = capture?.listingPackages?.[0];
  if (fromList?.name) return fromList;
  const matched = capture?.devLog?.matchedPackage;
  if (matched?.name) return matched;
  return null;
}

const capturePath = path.join(__dirname, '..', 'capture', '02-07-2026-15-37-39-046.json');
if (!fs.existsSync(capturePath)) {
  console.error('Missing fixture:', capturePath);
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
const capture = fixture['scrape-data'].capture;
const pkg = resolveFirstListingPackage(capture);
const targets = collectPackageDetailTargets(pkg, {
  extractWithFlight: true,
  extractWithoutFlight: true
});

console.log('first package:', pkg?.name);
console.log('targets:', targets.length);
for (const t of targets) {
  console.log(' -', t.flight_type, t.detail_url.slice(0, 90) + '…');
}

if (targets.length !== 2) {
  console.error('FAIL: expected 2 Type 4 targets (withFlight + withoutFlight)');
  process.exit(1);
}

console.log('OK: Type 5 would chain 2 Type 4 scrapes');
