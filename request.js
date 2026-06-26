/**
 * Vitt Overlay — scrape request formats for backend team
 *
 * Entry points:
 *   1. WebSocket  ws://127.0.0.1:5000/ws   route_type: "request_scrape"
 *   2. HTTP POST  http://127.0.0.1:5000/api/scrape
 *
 * Prerequisites: vitt-overlay-server running, Electron overlay + Chrome extension connected.
 *
 * Results are saved under: vitt-overlay-server/capture/<timestamp>.json
 * Job lifecycle events: scrape_status → scrape_result | scrape_error (via same WS)
 */

// ---------------------------------------------------------------------------
// Shared field reference
// ---------------------------------------------------------------------------
//
// scrapeMode (required for intent):
//   "mmt-listing"         — Type 1: listing page scroll + HTML/text (no URL clicks)
//   "mmt-listing-urls"    — Type 2: listing scroll + click price box → package detail URLs
//   "mmt-listing-search"  — Type 3: scroll listing until package name match → URLs for that package only
//   "mmt-package"         — Type 4: package detail page (itinerary / policies / summary / sidebars)
//
// url (required): MMT holidays URL (listing /search or detail /package)
//
// Listing URL click options (Type 2 & 3):
//   extractWithFlight     boolean  default true  — resolve "with flight" variant if shown
//   extractWithoutFlight  boolean  default true  — resolve "without flight" variant if shown
//   searchPackageName     string   Type 3 only — fuzzy match: every word must appear in card title
//                                     e.g. "kolkata 2 nightful joy" matches "Kolkata 2 Nightful Joy Journey"
//
// Package detail options (Type 4):
//   extractItinerary, extractPolicies, extractSummary  boolean  default true
//   extractHotels, extractActivities, extractTransfers boolean  default true
//   maxSidebarClicks  number  default 8
//   waitMs            number  ms between steps (package default 2500)
//
// Common:
//   scrollUntilStable  boolean  default true for listing modes
//   waitMs             number   ms wait after each scroll (listing default 3000–4000)
//   urls               string[] optional — multiple listing/package URLs in one request

// ---------------------------------------------------------------------------
// TYPE 1 — Listing only (current default behaviour)
// ---------------------------------------------------------------------------
export const type1_listingOnly = {
  route_type: 'request_scrape',
  'scrape-data': {
    scrapeMode: 'mmt-listing',
    url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Goa',
    scrollUntilStable: true,
    waitMs: 4000
  }
};

// HTTP equivalent:
// POST /api/scrape
// {
//   "scrapeMode": "mmt-listing",
//   "url": "https://holidayz.makemytrip.com/holidays/india/search?dest=Goa"
// }

// ---------------------------------------------------------------------------
// TYPE 2 — Listing + package detail URLs (interleaved scroll + click)
// ---------------------------------------------------------------------------
export const type2_listingWithUrls = {
  route_type: 'request_scrape',
  'scrape-data': {
    scrapeMode: 'mmt-listing-urls',
    url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Goa',
    extractWithFlight: true,
    extractWithoutFlight: true,
    scrollUntilStable: true,
    waitMs: 3000
  }
};

// HTTP:
// {
//   "scrapeMode": "mmt-listing-urls",
//   "url": "https://holidayz.makemytrip.com/holidays/india/search?dest=Goa",
//   "extractWithFlight": true,
//   "extractWithoutFlight": true
// }

// ---------------------------------------------------------------------------
// TYPE 3 — Find one package on listing + return its detail URL(s)
// ---------------------------------------------------------------------------
export const type3_listingSearchPackage = {
  route_type: 'request_scrape',
  'scrape-data': {
    scrapeMode: 'mmt-listing-search',
    url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Kolkata',
    searchPackageName: 'kolkata 2 nightful joy journey',
    extractWithFlight: true,
    extractWithoutFlight: false
  }
};

// HTTP:
// {
//   "scrapeMode": "mmt-listing-search",
//   "url": "https://holidayz.makemytrip.com/holidays/india/search?dest=Kolkata",
//   "searchPackageName": "kolkata 2 nightful joy journey",
//   "extractWithFlight": true,
//   "extractWithoutFlight": false
// }

// ---------------------------------------------------------------------------
// TYPE 4 — Package detail page (full content scrape)
// ---------------------------------------------------------------------------
export const type4_packageDetail = {
  route_type: 'request_scrape',
  'scrape-data': {
    scrapeMode: 'mmt-package',
    url:
      'https://holidayz.makemytrip.com/holidays/india/package?dest=Goa&destValue=Goa&id=21828&depDate=2026-07-02',
    extractItinerary: true,
    extractPolicies: true,
    extractSummary: true,
    extractHotels: true,
    extractActivities: true,
    extractTransfers: true,
    maxSidebarClicks: 8,
    waitMs: 2500
  }
};

// HTTP:
// {
//   "scrapeMode": "mmt-package",
//   "url": "https://holidayz.makemytrip.com/holidays/india/package?...",
//   "extractItinerary": true,
//   "extractPolicies": true,
//   "extractSummary": true,
//   "extractHotels": true,
//   "extractActivities": true,
//   "extractTransfers": true,
//   "maxSidebarClicks": 8
// }

// ---------------------------------------------------------------------------
// Expected result shape (listing with URLs — Type 2 / 3)
// ---------------------------------------------------------------------------
export const exampleResult_listingWithUrls = {
  jobId: '<uuid>',
  pageType: 'mmt-listing-urls',
  url: 'https://holidayz.makemytrip.com/holidays/india/search?dest=Goa',
  filtered: {
    Goa: [
      {
        name: 'Super Saver Goa',
        duration: '3N/4D',
        price: '₹8,040',
        detail_url: 'https://holidayz.makemytrip.com/holidays/india/package?id=...&variantId=...',
        package_options: [
          {
            option_label: 'With Flight ₹12,000 /Person',
            detail_url: 'https://holidayz.makemytrip.com/holidays/india/package?...&variantId=FLIGHT_...',
            status: 'ok'
          },
          {
            option_label: 'Without Flight ₹8,040 /Person',
            detail_url: 'https://holidayz.makemytrip.com/holidays/india/package?...&variantId=NO_MAJOR_...',
            status: 'ok'
          },
          {
            option_label: 'With Flight Sold Out',
            detail_url: '',
            status: 'sold out'
          }
        ]
      }
    ]
  },
  capture: {
    listingPackages: '/* same package array as above */',
    pageType: 'mmt-listing-urls',
    cardCount: 20
  }
};

// ---------------------------------------------------------------------------
// Variant / sold-out behaviour
// ---------------------------------------------------------------------------
// - If variant text contains "sold out" → status: "sold out", detail_url: ""
// - If extractWithFlight: false → skip "with flight" variant clicks
// - If extractWithoutFlight: false → skip "without flight" variant clicks
// - If price box opens detail directly (no variant modal) → detail_url on package root
// - Blocking modal on listing: closed via ._Modal.modalCont .close.closeIcon when needed

// ---------------------------------------------------------------------------
// curl examples
// ---------------------------------------------------------------------------
//
// Type 2:
// curl -X POST http://127.0.0.1:5000/api/scrape \
//   -H "Content-Type: application/json" \
//   -d '{"scrapeMode":"mmt-listing-urls","url":"https://holidayz.makemytrip.com/holidays/india/search?dest=Goa","extractWithFlight":true,"extractWithoutFlight":true}'
//
// Type 3:
// curl -X POST http://127.0.0.1:5000/api/scrape \
//   -H "Content-Type: application/json" \
//   -d '{"scrapeMode":"mmt-listing-search","url":"https://holidayz.makemytrip.com/holidays/india/search?dest=Kolkata","searchPackageName":"kolkata 2 nightful joy","extractWithFlight":true,"extractWithoutFlight":false}'
//
// Type 4:
// curl -X POST http://127.0.0.1:5000/api/scrape \
//   -H "Content-Type: application/json" \
//   -d '{"scrapeMode":"mmt-package","url":"https://holidayz.makemytrip.com/holidays/india/package?dest=Goa&id=21828"}'
