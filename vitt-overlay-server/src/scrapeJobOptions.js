/** Detect MMT page type from URL. */
export function detectScrapeMode(url) {
  const u = String(url || '');
  if (/\/holidays\/india\/package\b/i.test(u)) return 'mmt-package';
  if (/\/holidays\/india\/search\b/i.test(u)) return 'mmt-listing';
  return 'generic';
}

/** Default extract flags per page type. */
export function defaultExtractOptions(mode) {
  if (mode === 'mmt-package') {
    return {
      scrapeMode: 'mmt-package',
      scrollUntilStable: false,
      waitMs: 2500,
      extractItinerary: true,
      extractPolicies: true,
      extractSummary: true,
      extractHotels: true,
      extractActivities: true,
      extractTransfers: true,
      maxSidebarClicks: 8
    };
  }
  if (mode === 'mmt-listing-urls' || mode === 'mmt-listing-search') {
    return {
      scrapeMode: mode,
      scrollUntilStable: true,
      waitMs: 3000,
      extractWithFlight: true,
      extractWithoutFlight: true,
      searchPackageName: '',
      extractPackageDetail: false,
      extractItinerary: true,
      extractPolicies: true,
      extractSummary: true,
      extractHotels: true,
      extractActivities: true,
      extractTransfers: true,
      maxSidebarClicks: 8,
      packageDetailWaitMs: 2500
    };
  }
  if (mode === 'mmt-listing') {
    return {
      scrapeMode: 'mmt-listing',
      scrollUntilStable: true,
      waitMs: 4000,
      extractAllListingTabs: false,
      listingTabName: 'All Packages',
      extractItinerary: false,
      extractPolicies: false,
      extractSummary: false,
      extractHotels: false,
      extractActivities: false,
      extractTransfers: false
    };
  }
  if (mode === 'mmt-listing-first-package') {
    return {
      scrapeMode: 'mmt-listing-first-package',
      scrollUntilStable: false,
      waitMs: 4000,
      minPackageCards: 4,
      listingTabName: 'All Packages',
      extractWithFlight: true,
      extractWithoutFlight: true,
      extractItinerary: true,
      extractPolicies: true,
      extractSummary: true,
      extractHotels: true,
      extractActivities: true,
      extractTransfers: false,
      maxSidebarClicks: 8,
      packageDetailWaitMs: 2500
    };
  }
  return { scrapeMode: 'generic', scrollUntilStable: true, waitMs: 4000 };
}

export function mergeJobOptions(url, overrides = {}) {
  const mode = overrides.scrapeMode || detectScrapeMode(url);
  return { ...defaultExtractOptions(mode), ...overrides, scrapeMode: mode };
}
