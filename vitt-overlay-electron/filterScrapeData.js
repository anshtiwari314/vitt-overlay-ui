const ENTRY_TYPES = /^(FLIGHT|TRANSFER|HOTEL|MEAL|ACTIVITY|RESORT|HOTEL CHECKOUT)/i;
const BOOKING_FOOTER_MARKERS = [
  'PROCEED TO PAYMENT',
  'Coupons & Offers',
  'Customise my trip',
  'Have a Coupon Code?'
];

export function extractDestination(url = '') {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get('destValue') ||
      parsed.searchParams.get('dest') ||
      parsed.searchParams.get('searchDep') ||
      ''
    ).trim();
  } catch {
    const match = url.match(/[?&]dest(?:Value)?=([^&]+)/i);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }
}

function detectPageType(url = '', capture = {}) {
  if (capture.pageType) return capture.pageType;
  if (capture.sections || capture.sidebars) return 'mmt-package';
  if (/\/package(?:\?|$)/i.test(url)) return 'mmt-package';
  if (/\/search(?:\?|$)/i.test(url)) return 'mmt-listing';
  return 'unknown';
}

function splitLines(text = '') {
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripBookingFooter(text = '') {
  if (!text) return '';
  let cut = text.length;
  for (const marker of BOOKING_FOOTER_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx >= 0 && idx < cut) cut = idx;
  }
  const priceFooter = text.search(/₹[\d,]+(?:\s*\d+%\s*OFF\s*)?₹[\d,]+\s*\/Adult/i);
  if (priceFooter >= 0 && priceFooter < cut) cut = priceFooter;
  return text.slice(0, cut).trim();
}

function extractPrice(text = '') {
  if (!text) return '';
  const adult = text.match(/₹([\d,]+)\s*\/Adult/i);
  if (adult) return `₹${adult[1]}`;
  const perPerson = text.match(/₹([\d,]+)\s*\/Person/i);
  if (perPerson) return `₹${perPerson[1]}`;
  const first = text.match(/₹([\d,]+)/);
  return first ? `₹${first[1]}` : '';
}

function extractDuration(text = '') {
  const match = text.match(/\b(\d+N\/\d+D)\b/i);
  return match ? match[1].toUpperCase() : '';
}

function extractPackageName(capture = {}) {
  const title = (capture.title || '').trim();
  if (title && !/^(Holiday Packages|STARTING FROM)$/i.test(title)) {
    return title;
  }

  const text =
    capture.sections?.itinerary?.text ||
    capture.sections?.summary?.text ||
    capture.text ||
    '';

  const skip =
    /^(Flights|Hotels|Homestays|Holiday Packages|Trains|Buses|Cabs|Visa|Forex|Travel Insurance|More|Login|Create Account|STARTING FROM|TRAVELLING ON|ROOMS & GUESTS|SEARCH|Please note|Customizable|VIEW GALLERY|Activities & Sightseeing|Property photos|ITINERARY|POLICIES|SUMMARY|Share)$/i;

  for (const line of splitLines(text)) {
    if (skip.test(line)) continue;
    if (/^\d+N\/\d+D$/i.test(line)) break;
    if (line.length >= 8 && line.length <= 120) return line;
  }

  return title || '';
}

function extractPackageFeatures(text = '') {
  const features = [];
  const patterns = [
    /\d+\s*Star\s+(?:Hotel|Apartment|Resort|Villa)/i,
    /Airport Pickup & Drop/i,
    /Selected Meals/i,
    /\d+\s+Activity/i,
    /Boat Cruise/i,
    /North Goa Sightseeing/i,
    /South Goa Sightseeing/i,
    /Crafted Just for You/i,
    /\d+N\s+Goa/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && !features.includes(match[0])) features.push(match[0]);
  }

  const header = text.split(/\bITINERARY\b/i)[0] || text;
  for (const line of splitLines(header)) {
    if (line.length > 50) continue;
    if (/Customizable|VIEW GALLERY|Property photos|Activities & Sightseeing/i.test(line)) continue;
    if (/Star|Meal|Activity|Pickup|Sightseeing|Cruise|\d+N Goa/i.test(line) && !features.includes(line)) {
      features.push(line);
    }
  }

  return features.slice(0, 15);
}

function parseItineraryDays(text = '') {
  if (!text) return [];

  let body = text;
  const dayPlanIdx = body.indexOf('Day Plan');
  const day1Idx = body.indexOf('Day 1', dayPlanIdx >= 0 ? dayPlanIdx : 0);
  if (day1Idx >= 0) body = body.slice(day1Idx);

  for (const marker of ['\nPOLICIES\n', '\nSUMMARY\n', 'PROCEED TO PAYMENT']) {
    const idx = body.indexOf(marker);
    if (idx >= 0) body = body.slice(0, idx);
  }

  const matches = [...body.matchAll(/\bDay\s+(\d+)\b/gi)];
  if (!matches.length) return [];

  const days = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? body.length : body.length;
    const block = body.slice(start, end).trim();
    const dayNum = matches[i][1];
    const lines = splitLines(block);

    let title = extractDestination(body) || 'Goa';
    const dayLineIdx = lines.findIndex((line) => line.toLowerCase() === `day ${dayNum}`.toLowerCase());
    if (dayLineIdx >= 0 && lines[dayLineIdx + 1] && !/^INCLUDED/i.test(lines[dayLineIdx + 1])) {
      title = lines[dayLineIdx + 1];
    }

    const included = [];
    const incIdx = lines.findIndex((line) => /^INCLUDED\s*:?/i.test(line));
    if (incIdx >= 0) {
      for (let j = incIdx + 1; j < lines.length; j += 1) {
        if (ENTRY_TYPES.test(lines[j])) break;
        if (/^\d+\s/.test(lines[j]) || /Hotel|Transfer|Meal|Activity/i.test(lines[j])) {
          included.push(lines[j]);
        }
      }
    }

    const entries = [];
    let currentEntry = '';
    for (const line of lines) {
      if (ENTRY_TYPES.test(line)) {
        if (currentEntry) entries.push(currentEntry.trim());
        currentEntry = line.replace(/\s+/g, ' ');
      } else if (
        currentEntry &&
        !/^Day\s+\d+$/i.test(line) &&
        !/^INCLUDED/i.test(line) &&
        line !== title &&
        !/REMOVEMODIFY|VIEW TRANSPORT|VIEW GALLERY|Read More\.\.\./i.test(line)
      ) {
        currentEntry += ` ${line}`;
      }
    }
    if (currentEntry) entries.push(currentEntry.trim());

    const dateMatch = block.match(
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\w{3}\b/i
    );

    days.push({
      day: `Day ${dayNum}`,
      date: dateMatch ? dateMatch[0] : '',
      title,
      included,
      entries: entries.slice(0, 25),
      raw_text: block.slice(0, 8000)
    });
  }

  return days;
}

function parseSidebarItem(item = {}) {
  if (!item || item.error) {
    return {
      index: item?.index ?? null,
      kind: item?.kind || '',
      preview: item?.preview || '',
      error: item?.error || null,
      text: '',
      parsed: null
    };
  }

  const text = item.text || '';
  const lines = splitLines(text);
  let parsed = { summary: text.slice(0, 2000) };

  if (item.kind === 'hotel') {
    const nameLine = lines.find(
      (line) =>
        line.length > 8 &&
        !/^[\d.+]+|Very Good|Ratings|View All|Read more|More Room Options|Breakfast is included/i.test(line)
    );
    parsed = {
      name: nameLine || '',
      rating: (text.match(/([\d.]+)\s*\nVery Good/i) || [])[1] || '',
      location: lines.find((line) => /\|.*drive to/i.test(line)) || '',
      stay: lines.find((line) => /Night|Jul|PM|AM/i.test(line)) || '',
      room: lines.find((line) => /Room|Breakfast|Deluxe/i.test(line)) || ''
    };
  } else if (item.kind === 'activity') {
    const titleLine = lines.find((line) => /Sightseeing|Exploration|Rentals|Tour/i.test(line));
    parsed = {
      title: titleLine || item.preview || '',
      duration: lines.find((line) => /^Duration /i.test(line)) || '',
      price: (text.match(/\+?\s*₹([\d,]+)/) || [])[1] ? `₹${(text.match(/\+?\s*₹([\d,]+)/) || [])[1]}` : ''
    };
  } else if (item.kind === 'transfer') {
    parsed = {
      title: lines[0] || item.preview || '',
      day: lines.find((line) => /Day \d+/i.test(line)) || '',
      summary: text.slice(0, 1500)
    };
  }

  return {
    index: item.index ?? null,
    kind: item.kind || '',
    preview: item.preview || '',
    text: text.slice(0, 4000),
    parsed
  };
}

const LISTING_NAME_SKIP =
  /^(Popular|Sorted By|\(\d+\)|ALL PACKAGES|HONEYMOON|NORTH GOA|SOUTH GOA|BEACH|HOTEL|VILLAS|LAST MINUTE|PREMIUM|Recently Viewed|Previous|Next|Explore|FILTERS|₹|No Cost EMI|Buy Now|SHOW PACKAGES|Book @)/i;

function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripHtmlTags(html = '') {
  return decodeHtmlEntities(String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function listingPackageKey(name, duration) {
  return `${name.trim().toLowerCase()}|${duration.trim().toUpperCase()}`;
}

function pushListingPackage(packages, seen, pkg) {
  if (!pkg?.name || pkg.name.length < 3) return;
  const key = listingPackageKey(pkg.name, pkg.duration || '');
  const existingIdx = packages.findIndex((p) => listingPackageKey(p.name, p.duration || '') === key);
  if (existingIdx >= 0) {
    const existing = packages[existingIdx];
    if (!existing.detail_url && pkg.detail_url) existing.detail_url = pkg.detail_url;
    if ((!existing.package_options || !existing.package_options.length) && pkg.package_options?.length) {
      existing.package_options = pkg.package_options;
    }
    if (!existing.price && pkg.price) existing.price = pkg.price;
    return;
  }
  if (seen.has(key)) return;
  seen.add(key);
  packages.push(pkg);
}

/** Parse MMT listing cards from captured HTML (packageHead + card structure). */
function parseListingFromHtml(html = '') {
  if (!html || !/packageHead/i.test(html)) return [];

  const packages = [];
  const seen = new Set();
  const headRe =
    /title="([^"]*)"[^>]*class="packageHead"[^>]*>([^<]*)<\/p>\s*<span class="selected">([^<]*)<\/span>/gi;

  let match;
  while ((match = headRe.exec(html)) !== null) {
    const name = decodeHtmlEntities((match[1] || match[2] || '').trim());
    const duration = (match[3] || '').trim().toUpperCase();
    if (!name || name.length < 3) continue;

    const start = match.index;
    const nextHead = html.indexOf('class="packageHead"', start + 1);
    const chunk = html.slice(start, nextHead > start ? nextHead : start + 3000);

    const duration_details = [];
    const itineraryHtml = chunk.match(/class="itineraryList"[^>]*>([\s\S]*?)<\/div>/i);
    if (itineraryHtml) {
      for (const span of itineraryHtml[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)) {
        const line = stripHtmlTags(span[1]);
        if (line) duration_details.push(line);
      }
    }

    const features = [];
    const tripList = chunk.match(/class="tripListWrapper"[^>]*>([\s\S]*?)<\/ul>/i);
    if (tripList) {
      for (const item of tripList[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        const line = stripHtmlTags(item[1]);
        if (line) features.push(line);
      }
    }

    const visitList = chunk.match(/class="visitListWrapper"[^>]*>([\s\S]*?)<\/ul>/i);
    if (visitList) {
      for (const item of visitList[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        const line = stripHtmlTags(item[1]);
        if (line && !features.includes(line)) features.push(line);
      }
    }

    const priceMatch = chunk.match(/class="priceStyle">₹([\d,]+)/i);
    const price = priceMatch ? `₹${priceMatch[1]}` : '';

    const hrefMatches = [...chunk.matchAll(/href="([^"]*\/holidays\/[^"]*package[^"]*)"/gi)];
    const detail_url = hrefMatches[0] ? decodeHtmlEntities(hrefMatches[0][1]) : '';

    const package_options = [];
    const variantChunks = chunk.split(/class="[^"]*variant-card-container/i).slice(1);
    for (const [index, variantChunk] of variantChunks.entries()) {
      const variantHref = variantChunk.match(/href="([^"]*\/holidays\/[^"]*package[^"]*)"/i);
      if (!variantHref) continue;
      package_options.push({
        option_label: `Option ${index + 1}`,
        detail_url: decodeHtmlEntities(variantHref[1])
      });
    }

    pushListingPackage(packages, seen, {
      name,
      duration,
      duration_details: duration_details.slice(0, 5),
      features: features.slice(0, 12),
      price,
      detail_url: detail_url || package_options[0]?.detail_url || '',
      package_options
    });
  }

  return packages;
}

/** Fallback: extract every package in a text block (not just the first). */
function parseListingBlocksFromText(block = '') {
  const lines = splitLines(block);
  if (!lines.length) return [];

  const durIndices = lines.reduce((acc, line, i) => {
    if (/^\d+N\/\d+D$/i.test(line)) acc.push(i);
    return acc;
  }, []);

  if (!durIndices.length) return [];

  const packages = [];

  for (let n = 0; n < durIndices.length; n += 1) {
    const durIdx = durIndices[n];
    const prevDurIdx = n > 0 ? durIndices[n - 1] : -1;

    let nameIdx = durIdx - 1;
    while (
      nameIdx > prevDurIdx &&
      (LISTING_NAME_SKIP.test(lines[nameIdx]) ||
        /More Options Available/i.test(lines[nameIdx]) ||
        /^\d+N\/\d+D$/i.test(lines[nameIdx]))
    ) {
      nameIdx -= 1;
    }

    const name = lines[nameIdx];
    if (!name || name.length < 4) continue;

    const duration = lines[durIdx].toUpperCase();
    const features = [];
    let price = '';
    const nextDurIdx = n + 1 < durIndices.length ? durIndices[n + 1] : lines.length;

    for (let j = durIdx + 1; j < nextDurIdx; j += 1) {
      const line = lines[j];
      if (/More Options Available/i.test(line)) break;

      const perPerson = line.match(/₹([\d,]+)\s*\/Person/i);
      if (perPerson) price = `₹${perPerson[1]}`;

      if (/Book this|paying only|SHOW PACKAGES/i.test(line)) continue;
      if (/Total Price/i.test(line)) {
        const total = line.match(/₹([\d,]+)/);
        if (total && !price) price = `₹${total[1]}`;
        continue;
      }
      if (!/₹/.test(line) && line.length <= 50 && !LISTING_NAME_SKIP.test(line)) {
        features.push(line);
      }
    }

    const durationDetails = features.filter((line) => /^\d+N\s/i.test(line));
    const featureList = features.filter((line) => !/^\d+N\s/i.test(line));

    packages.push({
      name,
      duration,
      duration_details: durationDetails,
      features: featureList.slice(0, 12),
      price,
      detail_url: ''
    });
  }

  return packages;
}

function parseListingFromText(text = '') {
  let region = text || '';
  const sortedIdx = region.indexOf('Sorted By:');
  if (sortedIdx >= 0) region = region.slice(sortedIdx);

  const filtersIdx = region.search(/\nFILTERS\n|\nShow \d+ Packages/i);
  if (filtersIdx >= 0) region = region.slice(0, filtersIdx);

  const blocks = region.split(/\n\d+\s+More Options Available\n/i);
  const packages = [];
  const seen = new Set();

  for (const block of blocks) {
    for (const pkg of parseListingBlocksFromText(block.trim())) {
      pushListingPackage(packages, seen, pkg);
    }
  }

  // Cards without a preceding "More Options" marker (e.g. paired rows).
  for (const pkg of parseListingBlocksFromText(region)) {
    pushListingPackage(packages, seen, pkg);
  }

  return packages;
}

export function filterListingCapture(capture = {}, url = '') {
  const destination = extractDestination(url) || 'Unknown';
  const packages = [];
  const seen = new Set();

  for (const pkg of capture.listingPackages || []) {
    pushListingPackage(packages, seen, {
      name: pkg.name || '',
      duration: pkg.duration || '',
      duration_details: pkg.duration_details || [],
      features: pkg.features || [],
      price: pkg.price || '',
      detail_url: pkg.detail_url || '',
      package_options: pkg.package_options || []
    });
  }

  const fromHtml = parseListingFromHtml(capture.html || '');
  for (const pkg of fromHtml) {
    pushListingPackage(packages, seen, pkg);
  }

  // Supplement with text parsing (covers gaps when HTML is partial or card markup changes).
  for (const pkg of parseListingFromText(capture.text || '')) {
    pushListingPackage(packages, seen, pkg);
  }

  return { [destination]: packages };
}

export function filterPackageCapture(capture = {}, url = '') {
  const destination = extractDestination(url) || 'Unknown';
  const sections = capture.sections || {};
  const sidebars = capture.sidebars || {};
  const isImmediate = capture.captureMode === 'immediate';
  const visibleText = isImmediate ? (capture.text || '') : '';

  const itineraryText = sections.itinerary?.text || visibleText;
  const policiesText = stripBookingFooter(sections.policies?.text || '');
  const summaryText = stripBookingFooter(sections.summary?.text || '');
  const headerText = itineraryText || summaryText || capture.text || '';

  const name = extractPackageName(capture);
  const duration = extractDuration(headerText);
  const features = extractPackageFeatures(headerText);
  const price = extractPrice(policiesText || summaryText || headerText);

  const packageOption = {
    option_label: 'Default',
    detail_url: url || capture.url || capture.extractedUrl || '',
    page_title: capture.title || name,
    detail_scrape_status: isImmediate ? 'immediate' : capture.errors?.length ? 'partial' : 'ok',
    tabs: {
      itinerary: {
        text: stripBookingFooter(itineraryText),
        lines: splitLines(stripBookingFooter(itineraryText)),
        days: parseItineraryDays(itineraryText)
      },
      policies: {
        text: policiesText,
        lines: splitLines(policiesText)
      },
      summary: {
        text: summaryText,
        lines: splitLines(summaryText)
      }
    },
    sidebars: {
      hotels: (sidebars.hotels || []).map(parseSidebarItem),
      activities: (sidebars.activities || []).map(parseSidebarItem),
      transfers: (sidebars.transfers || []).map(parseSidebarItem)
    },
    booking: {
      price: extractPrice(policiesText || summaryText)
    }
  };

  if (capture.errors?.length) {
    packageOption.errors = capture.errors;
  }

  return {
    [destination]: [
      {
        name,
        duration,
        duration_details: features.filter((line) => /^\d+N\s/i.test(line)),
        features: features.filter((line) => !/^\d+N\s/i.test(line)),
        price,
        detail_url: packageOption.detail_url,
        package_options: [packageOption],
        detail_scrape_status: packageOption.detail_scrape_status,
        detail_scrape_error: capture.errors?.join('; ') || ''
      }
    ]
  };
}

/**
 * Transform raw extension scrape_result payload into structured filtered JSON.
 * Persistence: server saves to vitt-overlay-server/capture/ via React WS relay.
 */
export function filterScrapeData(payload) {
  if (!payload || payload.type !== 'scrape_result') {
    return payload;
  }

  const capture = payload.capture || {};
  const url = payload.url || payload.extractedUrl || capture.url || capture.extractedUrl || '';
  const pageType = detectPageType(url, capture);
  const destination = extractDestination(url) || 'Unknown';

  let filtered = null;
  let filterError = null;

  try {
    if (pageType === 'mmt-package') {
      filtered = filterPackageCapture(capture, url);
    } else if (
      pageType === 'mmt-listing' ||
      pageType === 'mmt-listing-urls' ||
      pageType === 'mmt-listing-search'
    ) {
      filtered = filterListingCapture(capture, url);
    }
  } catch (error) {
    filterError = error.message || String(error);
    filtered = { error: filterError, destination, pageType };
  }

  if (filterError) {
    console.error('[scrape] filterScrapeData failed', filterError);
  }

  return {
    ...payload,
    pageType,
    filtered
  };
}
