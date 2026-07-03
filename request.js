/**
 * Vitt Overlay — scrape REQUEST formats (server/AWS → overlay)
 *
 * The server broadcasts a flat WebSocket message to connected overlay clients.
 * React receives it → Electron scrapeStart → extension bridge → Chrome scrape.
 *
 * Transport:  ws://127.0.0.1:5000/ws  (or ws://127.0.0.1:${VITT_PORT}/ws)
 *
 * REQUIRED on every message:
 *   type: "scrape_request"
 *   jobId: UUID (server generates via randomUUID())
 *   url:   string (listing or package URL)
 *
 * All scrape options are top-level siblings (not nested in scrape-data).
 *
 * Local triggers:
 *   GET http://127.0.0.1:5000/api/scrape/test-type{1|2|3|4|5}
 *   Startup: vitt-overlay-server/.env  req_type_1=true … req_type_5=true
 *            One scrape per server start (first enabled req_type_* wins); restart to re-run
 *
 * Env overrides (server — see vitt-overlay-server/.env):
 *   VITT_SCRAPE_START_DELAY_MS
 *   VITT_LISTING_SCRAPE_URL
 *   VITT_TYPE2_LISTING_URL / VITT_TYPE3_LISTING_URL / VITT_TYPE5_LISTING_URL
 *   VITT_TYPE3_SEARCH_PACKAGE_NAME
 *   VITT_TYPE3_EXTRACT_PACKAGE_DETAIL
 *   VITT_TYPE1_EXTRACT_ALL_LISTING_TABS
 *   VITT_TYPE1_WAIT_MS
 *   VITT_PACKAGE_SCRAPE_URL
 *
 * Examples below mirror TYPE1–TYPE5 in vitt-overlay-server/src/index.js
 * (same fields the server sends after mergeJobOptions).
 */

const exampleJobId = '550e8400-e29b-41d4-a716-446655440000';

const KERALA_LISTING_URL =
  'https://holidayz.makemytrip.com/holidays/india/search?fromSearchWidget=true&searchDep=Kerala&dest=Kerala&destValue=Kerala&depCity=New%20Delhi&initd=searchwidget_landing_Kerala_notheme&dateSearched=03%2F07%2F2026&glp=true&pdo=true&rooms=2%2C0%2C0%2C0%2C%2C%2C&affiliate=MMT##page_header';

const KERALA_PACKAGE_URL =
  'https://holidayz.makemytrip.com/holidays/india/package?fromSearchWidget=true&searchDep=Kerala&dest=Kerala&destValue=Kerala&depCity=New%20Delhi&initd=searchwidget_landing_Kerala_notheme&dateSearched=03%2F07%2F2026&glp=true&pdo=true&rooms=2%2C0%2C0%2C0%2C%2C%2C&affiliate=MMT&id=32287&listingClassId=4298&depDate=2026-07-03&fromCity=New%20Delhi&variantId=NO_MAJOR_COMMUTE_57531BC2&room=2%2C0%2C0%2C0%2C%2C%2C&searchDate=2026-07-03&pkgType=FIT';

// ---------------------------------------------------------------------------
// TYPE 1 — mmt-listing (scroll + HTML/text, no URL clicks)
// Server: TYPE1_LISTING_ONLY
// ---------------------------------------------------------------------------
export const type1_listingOnly = {
  type: 'scrape_request',
  jobId: exampleJobId,
  url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Goa',
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

/** Type 1 — all #collectionList tabs; discover once then scrape each in parallel Chrome tabs */
export const type1_listingAllTabs = {
  type: 'scrape_request',
  jobId: exampleJobId,
  url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Goa',
  scrapeMode: 'mmt-listing',
  scrollUntilStable: true,
  waitMs: 4000,
  extractAllListingTabs: true
};

// ---------------------------------------------------------------------------
// TYPE 2 — mmt-listing-urls (scroll listing + click all package detail URLs)
// Server: TYPE2_LISTING_URLS
// ---------------------------------------------------------------------------
export const type2_listingWithUrls = {
  type: 'scrape_request',
  jobId: exampleJobId,
  url: KERALA_LISTING_URL,
  scrapeMode: 'mmt-listing-urls',
  scrollUntilStable: true,
  waitMs: 3000,
  extractWithFlight: true,
  extractWithoutFlight: true
};

// ---------------------------------------------------------------------------
// TYPE 3 — mmt-listing-search (find one package + detail URL(s))
// Server: TYPE3_LISTING_SEARCH
//
// Flow (Type 3 sends detail pages only — no listing scrape_result to backend):
//   1. Open listing URL → scroll/search for searchPackageName (internal)
//   2. Click matched card → intercept detail URL(s) (withFlight / withoutFlight / default)
//   3. If extractPackageDetail: open detail URLs in parallel → Type 4 scrape each
//   4. Send one scrape_result per variant (resultPhase: "package_detail") — same JSON as Type 4/5
//
// extractPackageDetail: false → no backend messages (listing used only to resolve URLs locally)
// extractPackageDetail: true  → 1–2 package_detail messages only (withFlight / withoutFlight)
// ---------------------------------------------------------------------------
/** Type 3 — URLs only (no scrape_result sent to backend; listing is internal) */
export const type3_listingSearchUrlsOnly = {
  type: 'scrape_request',
  jobId: exampleJobId,
  url: KERALA_LISTING_URL,
  scrapeMode: 'mmt-listing-search',
  scrollUntilStable: true,
  waitMs: 3000,
  extractWithFlight: true,
  extractWithoutFlight: true,
  searchPackageName: 'Family Holiday to Munnar & Alleppey',
  extractPackageDetail: false,
  extractItinerary: true,
  extractPolicies: true,
  extractSummary: true,
  extractHotels: false,
  extractActivities: false,
  extractTransfers: false,
  maxSidebarClicks: 8,
  packageDetailWaitMs: 2500
};

/** Type 3 — detail pages only (1–2 messages: withFlight / withoutFlight; no listing message) */
export const type3_listingSearchWithPackageDetail = {
  type: 'scrape_request',
  jobId: exampleJobId,
  url: KERALA_LISTING_URL,
  scrapeMode: 'mmt-listing-search',
  scrollUntilStable: true,
  waitMs: 3000,
  extractWithFlight: true,
  extractWithoutFlight: true,
  searchPackageName: 'Family Holiday to Munnar & Alleppey',
  extractPackageDetail: true,
  extractItinerary: true,
  extractPolicies: true,
  extractSummary: true,
  extractHotels: false,
  extractActivities: false,
  extractTransfers: false,
  maxSidebarClicks: 8,
  packageDetailWaitMs: 2500
};

/** Type 3 does not send a listing scrape_result — only package_detail (same shape as Type 5 detail). */
export const type3_responsePackageDetail = {
  type: 'scrape_result',
  jobId: exampleJobId,
  resultPhase: 'package_detail',
  url: KERALA_LISTING_URL,
  extractedUrl: 'https://holidayz.makemytrip.com/holidays/india/package?…',
  capture: {
    pageType: 'mmt-package',
    flight_type: 'withoutFlight',
    html: '<!DOCTYPE html>…',
    sections: { itinerary: {}, policies: {}, summary: {} },
    sidebars: { hotels: [], activities: [], transfers: [] }
  }
};

// ---------------------------------------------------------------------------
// TYPE 4 — mmt-package (package detail page: itinerary / policies / sidebars)
// Server: TYPE4_PACKAGE_DETAIL
// ---------------------------------------------------------------------------
export const type4_packageDetail = {
  type: 'scrape_request',
  jobId: exampleJobId,
  url: KERALA_PACKAGE_URL,
  scrapeMode: 'mmt-package',
  scrollUntilStable: false,
  waitMs: 2500,
  extractItinerary: true,
  extractPolicies: true,
  extractSummary: true,
  extractHotels: true,
  extractActivities: true,
  extractTransfers: false,
  maxSidebarClicks: 8
};

// ---------------------------------------------------------------------------
// TYPE 5 — mmt-listing-first-package
// Server: TYPE5_FIRST_PACKAGE (req_type_5=true, VITT_TYPE5_LISTING_URL)
//
// Flow:
//   1. Open listing URL → "All Packages" tab
//   2. Scroll to bottom once → wait for cards (minPackageCards, best-effort)
//   3. Click first card → intercept detail URL(s) (withFlight / withoutFlight / default)
//   4. Send listing scrape_result immediately (resultPhase: "listing")
//   5. Open all detail URLs in parallel Chrome tabs → Type 4 scrape each
//   6. Send one scrape_result per variant as each finishes (resultPhase: "package_detail")
//
// Typical job with both flight variants → 3 server saves (1 listing + 2 Type 4).
// ---------------------------------------------------------------------------
export const type5_firstPackageDetail = {
  type: 'scrape_request',
  jobId: exampleJobId,
  url: KERALA_LISTING_URL,
  scrapeMode: 'mmt-listing-first-package',
  scrollUntilStable: false,
  waitMs: 4000,
  minPackageCards: 4,
  listingTabName: 'All Packages',
  extractWithFlight: true,
  extractWithoutFlight: true,
  packageDetailWaitMs: 2500,
  extractItinerary: true,
  extractPolicies: false,
  extractSummary: false,
  extractHotels: false,
  extractActivities: false,
  extractTransfers: false,
  maxSidebarClicks: 8
};

/** Type 5 — listing phase response (first message, sent before Type 4 starts) */
export const type5_responseListing = {
  type: 'scrape_result',
  jobId: exampleJobId,
  resultPhase: 'listing',
  url: KERALA_LISTING_URL,
  extractedUrl: KERALA_LISTING_URL,
  capture: {
    pageType: 'mmt-listing-first-package',
    listingPackages: [
      {
        name: 'Epic Kerala - Mega Price Drop Sale',
        duration: '4N/5D',
        detail_url: 'https://holidayz.makemytrip.com/holidays/india/package?…',
        package_options: [
          {
            option_label: 'Starting from - Cochin Without Flight …',
            detail_url: 'https://holidayz.makemytrip.com/holidays/india/package?…',
            flight_type: 'withoutFlight',
            status: 'ok'
          },
          {
            option_label: 'Starting from - New Delhi With Flight …',
            detail_url: 'https://holidayz.makemytrip.com/holidays/india/package?…',
            flight_type: 'withFlight',
            status: 'ok'
          }
        ]
      }
    ]
  }
};

/** Type 5 — package detail phase response (one per variant; Type 4 tabs run in parallel) */
export const type5_responsePackageDetail = {
  type: 'scrape_result',
  jobId: exampleJobId,
  resultPhase: 'package_detail',
  url: KERALA_LISTING_URL,
  extractedUrl: 'https://holidayz.makemytrip.com/holidays/india/package?…',
  capture: {
    pageType: 'mmt-package',
    flight_type: 'withoutFlight',
    html: '<!DOCTYPE html>…',
    sections: { itinerary: {}, policies: {}, summary: {} },
    sidebars: { hotels: [], activities: [], transfers: [] }
  }
};

// ---------------------------------------------------------------------------
// Field reference (top-level on scrape_request)
// ---------------------------------------------------------------------------
//
// scrapeMode:
//   "mmt-listing"                 — Type 1
//   "mmt-listing-urls"            — Type 2
//   "mmt-listing-search"          — Type 3
//   "mmt-package"                 — Type 4
//   "mmt-listing-first-package"   — Type 5
//
// Common (listing 1–3, 5):
//   scrollUntilStable, waitMs, selector, cardSelector
//
// Type 5 request:
//   minPackageCards           default 4 (wait after single scroll; still uses first card if fewer)
//   listingTabName            default "All Packages"
//   extractWithFlight, extractWithoutFlight
//   packageDetailWaitMs       default 2500
//   extractItinerary … maxSidebarClicks — Type 4 chain flags (match server TYPE5_FIRST_PACKAGE)
//
// Type 5 responses (scrape_result, same jobId):
//   resultPhase: "listing"
//     capture.pageType = mmt-listing-first-package
//     capture.listingPackages[0] = first card (name, detail_url, package_options[])
//   resultPhase: "package_detail"  (one per available variant; scraped in parallel)
//     capture.pageType = mmt-package
//     capture.flight_type = "withFlight" | "withoutFlight" | "default"
//     capture.html = full page HTML
//
// Type 1:
//   listingTabName          default "All Packages" (always in capture.listingTabs)
//   extractAllListingTabs   default false — when true, adds Honeymoon etc. alongside All Packages
//
// Type 2 & 3:
//   extractWithFlight, extractWithoutFlight, searchPackageName (Type 3)
//
// Type 3 optional Type 4 chain (backend receives detail pages only — no listing message):
//   extractPackageDetail    default true (VITT_TYPE3_EXTRACT_PACKAGE_DETAIL)
//   packageDetailWaitMs     default 2500
//   extractItinerary … maxSidebarClicks — used when extractPackageDetail true
//
// Type 3 responses (scrape_result, same jobId):
//   resultPhase: "package_detail" only (1–2 messages; withFlight / withoutFlight in parallel)
//     capture.pageType = mmt-package (identical to Type 4 / Type 5 detail phase)
//
// Type 4:
//   extractItinerary, extractPolicies, extractSummary, extractHotels,
//   extractActivities, extractTransfers (server default: false), maxSidebarClicks
//
// Dev logs (server console + capture.devLog):
//   Type 3 — scroll rounds, clicks, matched package
//   Type 4 — main tabs, sidebar scan/click timeline, durationMs
//   Type 3 & 5 — listing devLog + background timeline (listing_result_sent, package_detail_sent)
//
// ---------------------------------------------------------------------------
// WebSocket message types (overlay ↔ server)
// ---------------------------------------------------------------------------
//
// Server → overlay (request):
//   type: "scrape_request"     — Types 1–5 (flat top-level fields + jobId, url)
//
// Overlay → server (response / status):
//   type: "scrape_status"      — progress (loading / scrolling / extracting)
//   type: "scrape_result"      — capture (Type 3: package_detail only; Type 5: listing + package_detail)
//   type: "scrape_error"       — job failed
//   type: "request_scrape"      — optional batch queue from Scrape tab (urls in scrape-data)
//
// Payload: use scrape-data { jobId, url, capture, … } or flat siblings (server accepts both).
//
// ---------------------------------------------------------------------------
// WRONG — do not send
// ---------------------------------------------------------------------------
//
// route_type (legacy — use type instead)
// Missing type or jobId
