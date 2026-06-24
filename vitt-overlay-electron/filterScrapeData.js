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

function parseListingBlock(block = '') {
  const lines = splitLines(block);
  if (!lines.length) return null;

  const durIdx = lines.findIndex((line) => /^\d+N\/\d+D$/i.test(line));
  if (durIdx < 1) return null;

  let nameIdx = durIdx - 1;
  while (
    nameIdx > 0 &&
    /^(Popular|Sorted By|\(\d+\)|ALL PACKAGES|HONEYMOON|NORTH GOA|SOUTH GOA|BEACH|HOTEL|VILLAS|LAST MINUTE|PREMIUM|₹)/i.test(
      lines[nameIdx]
    )
  ) {
    nameIdx -= 1;
  }

  const name = lines[nameIdx];
  if (!name || name.length < 4) return null;

  const duration = lines[durIdx].toUpperCase();
  const features = [];
  let price = '';

  for (let j = durIdx + 1; j < lines.length; j += 1) {
    const line = lines[j];
    if (/^\d+N\/\d+D$/i.test(line)) break;
    if (/More Options Available/i.test(line)) break;

    const perPerson = line.match(/₹([\d,]+)\s*\/Person/i);
    if (perPerson) price = `₹${perPerson[1]}`;

    if (/Book this|paying only/i.test(line)) continue;
    if (/Total Price/i.test(line)) {
      const total = line.match(/₹([\d,]+)/);
      if (total && !price) price = `₹${total[1]}`;
      continue;
    }
    if (!/₹/.test(line) && line.length <= 50) features.push(line);
  }

  const durationDetails = features.filter((line) => /^\d+N\s/i.test(line));
  const featureList = features.filter((line) => !/^\d+N\s/i.test(line));

  return {
    name,
    duration,
    duration_details: durationDetails,
    features: featureList.slice(0, 12),
    price,
    detail_url: ''
  };
}

export function filterListingCapture(capture = {}, url = '') {
  const destination = extractDestination(url) || 'Unknown';
  let region = capture.text || '';

  const sortedIdx = region.indexOf('Sorted By:');
  if (sortedIdx >= 0) region = region.slice(sortedIdx);

  const filtersIdx = region.search(/\nFILTERS\n|\nShow \d+ Packages/i);
  if (filtersIdx >= 0) region = region.slice(0, filtersIdx);

  const blocks = region.split(/\n\d+\s+More Options Available\n/i);
  const packages = [];
  const seen = new Set();

  for (const block of blocks) {
    const pkg = parseListingBlock(block.trim());
    if (!pkg) continue;
    const key = `${pkg.name}|${pkg.duration}`;
    if (seen.has(key)) continue;
    seen.add(key);
    packages.push(pkg);
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
    } else if (pageType === 'mmt-listing') {
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
