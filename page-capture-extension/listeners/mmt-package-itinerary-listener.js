/**
 * Passive listener: MMT package detail pages with itineraryId.
 * Hardcoded scrape options — edit SCRAPE_CONFIG below as needed.
 */

export const LISTENER_ID = 'mmt-package-itinerary';

/** @type {string[]} Empty = match any itineraryId on package pages. */
export const ALLOWED_ITINERARY_IDS = [];

/** Debounce price-change rescrapes (ms). */
export const PRICE_CHANGE_DEBOUNCE_MS = 1000;

/** Max wait for price + itinerary tabs before first scrape (ms). */
export const PACKAGE_READY_TIMEOUT_MS = 60000;

/** Poll interval while waiting for package DOM (ms). */
export const PACKAGE_READY_POLL_MS = 500;

/** Reuse Type 4 (mmt-package-scraper) options. */
export const SCRAPE_CONFIG = {
  scrapeMode: 'mmt-package',
  scrollUntilStable: false,
  waitMs: 1000,
  extractItinerary: true,
  extractPolicies: false,
  extractSummary: false,
  extractHotels: false,
  extractActivities: false,
  extractTransfers: false,
  maxSidebarClicks: 8
};

export function matchesMmtPackageItineraryUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('makemytrip.com')) return false;
    if (!/\/holidays\/india\/package\b/i.test(u.pathname)) return false;
    const itineraryId = u.searchParams.get('itineraryId');
    if (!itineraryId) return false;
    if (ALLOWED_ITINERARY_IDS.length > 0 && !ALLOWED_ITINERARY_IDS.includes(itineraryId)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function extractItineraryId(url) {
  try {
    return new URL(url).searchParams.get('itineraryId') || null;
  } catch {
    return null;
  }
}

export function buildListenerJob(url, { trigger = 'initial' } = {}) {
  return {
    jobId: crypto.randomUUID(),
    url,
    source: 'extension-listener-mmt-package',
    trigger,
    ...SCRAPE_CONFIG
  };
}

export const MMT_PACKAGE_ITINERARY_LISTENER = {
  id: LISTENER_ID,
  matches: matchesMmtPackageItineraryUrl,
  extractItineraryId,
  buildJob: buildListenerJob,
  priceWatcherScript: 'injected/mmt-package-price-watcher.js',
  packageReadyTimeoutMs: PACKAGE_READY_TIMEOUT_MS,
  packageReadyPollMs: PACKAGE_READY_POLL_MS,
  priceChangeDebounceMs: PRICE_CHANGE_DEBOUNCE_MS
};
