export function scrapeJobMessage(job) {
  return {
    type: 'scrape_job',
    jobId: job.jobId,
    url: job.url,
    scrollUntilStable: job.scrollUntilStable !== false,
    selector: job.selector || null,
    waitMs: job.waitMs ?? 4000,
    scrapeMode: job.scrapeMode || null,
    extractWithFlight: job.extractWithFlight,
    extractWithoutFlight: job.extractWithoutFlight,
    searchPackageName: job.searchPackageName || null,
    extractItinerary: job.extractItinerary,
    extractPolicies: job.extractPolicies,
    extractSummary: job.extractSummary,
    extractHotels: job.extractHotels,
    extractActivities: job.extractActivities,
    extractTransfers: job.extractTransfers,
    maxSidebarClicks: job.maxSidebarClicks,
    cardSelector: job.cardSelector || null
  };
}