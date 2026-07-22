/**
 * Passive listener: MMT DIY Planner — captures itineraryId from createItinerary API.
 * Content scripts (interceptor + bridge) run on diyPlanner; background sends scrape_result via bridge.
 */

export const LISTENER_ID = 'mmt-diy-planner';

export const DIY_PLANNER_URL_PREFIX = 'https://holidayz.makemytrip.com/holidays/diyPlanner';

export function matchesDiyPlannerUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes('makemytrip.com') &&
      u.pathname.startsWith('/holidays/diyPlanner')
    );
  } catch {
    return false;
  }
}

export function buildItineraryCapture(itineraryData) {
  const { itineraryId, pageUrl, capturedAt } = itineraryData;
  return {
    schemaVersion: 2,
    pageType: 'mmt-diy-planner',
    capturedAt: capturedAt || new Date().toISOString(),
    url: pageUrl,
    extractedUrl: pageUrl,
    itineraryId,
    message: 'Itinerary created successfully'
  };
}

/** Same scrape_result envelope as other extension listeners (→ electron → react → server WS). */
export function buildBridgePayload(itineraryData) {
  const jobId = crypto.randomUUID();
  const capture = buildItineraryCapture(itineraryData);
  return {
    type: 'scrape_result',
    jobId,
    resultPhase: 'itinerary_created',
    pageType: 'mmt-diy-planner',
    source: 'extension-listener-mmt-diy-planner',
    url: itineraryData.pageUrl,
    extractedUrl: itineraryData.pageUrl,
    capture
  };
}

export const MMT_DIY_PLANNER_LISTENER = {
  id: LISTENER_ID,
  matches: matchesDiyPlannerUrl,
  interceptorScript: 'injected/mmt-itinerary-interceptor.js',
  bridgeScript: 'injected/mmt-itinerary-bridge.js'
};
