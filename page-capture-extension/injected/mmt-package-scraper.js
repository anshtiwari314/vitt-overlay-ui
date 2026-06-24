/**
 * MMT package detail page: tabs (Itinerary / Policies / Summary) + itinerary sidebars.
 * Sets window.__vittScrapeResult. Reads opts from data-vitt-scrape-opts on <html>.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const parseOpts = () => {
    try {
      const raw = document.documentElement.getAttribute('data-vitt-scrape-opts') || '{}';
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const opts = parseOpts();
  const waitMs = opts.waitMs || 2500;
  const maxClicks = opts.maxSidebarClicks || 8;

  const snap = (el, maxHtml = 80000) => {
    if (!el) return { text: '', html: '' };
    const html = el.outerHTML || '';
    return {
      text: (el.innerText || '').trim(),
      html: html.length > maxHtml ? html.slice(0, maxHtml) + '\n<!-- truncated -->' : html
    };
  };

  const findMainTab = (label) => {
    const want = label.toUpperCase();
    const tabs = document.querySelectorAll('#tabItem .mainTabItem, .mainTab .mainTabItem');
    for (const tab of tabs) {
      if ((tab.textContent || '').trim().toUpperCase() === want) return tab;
    }
    return null;
  };

  const clickMainTab = async (label) => {
    const tab = findMainTab(label);
    if (!tab) return false;
    tab.scrollIntoView({ block: 'center' });
    tab.click();
    await sleep(waitMs);
    return true;
  };

  const findSidebar = () =>
    document.querySelector(
      [
        '.sidePanelWrapper',
        '.sidePanelContainer',
        '[class*="sidePanelWrap"]',
        '[class*="SidePanel"]',
        '[class*="side-panel"]',
        '.modalContainer.show',
        '[class*="drawer"][class*="open"]'
      ].join(', ')
    );

  const closeSidebar = async () => {
    const closeBtn = document.querySelector(
      [
        '.sidePanelWrapper .close',
        '[class*="sidePanel"] .close',
        '.holidaySprite.iconClose',
        'button[aria-label="Close"]',
        '.closePopup',
        '[class*="closeIcon"]'
      ].join(', ')
    );
    if (closeBtn) {
      closeBtn.click();
      await sleep(800);
      return;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await sleep(500);
    const backdrop = document.querySelector('[class*="overlay"], [class*="backdrop"], .modalBackdrop');
    if (backdrop) backdrop.click();
    await sleep(400);
  };

  const captureSidebarClick = async (el, index, kind) => {
    const preview = (el.innerText || '').trim().slice(0, 120);
    el.scrollIntoView({ block: 'center' });
    await sleep(400);
    el.click();
    await sleep(waitMs);
    const panel = findSidebar();
    const content = snap(panel || document.querySelector('[class*="sidePanel"]') || el);
    await closeSidebar();
    await sleep(600);
    return { index, kind, preview, ...content };
  };

  const queryAll = (selectors) => {
    const seen = new Set();
    const out = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        seen.add(el);
        out.push(el);
      }
    }
    return out;
  };

  const result = {
    schemaVersion: 2,
    pageType: 'mmt-package',
    capturedAt: new Date().toISOString(),
    url: location.href,
    extractedUrl: location.href,
    title: document.title,
    options: {
      extractItinerary: opts.extractItinerary !== false,
      extractPolicies: opts.extractPolicies !== false,
      extractSummary: opts.extractSummary !== false,
      extractHotels: opts.extractHotels !== false,
      extractActivities: opts.extractActivities !== false,
      extractTransfers: opts.extractTransfers !== false
    },
    sections: {},
    sidebars: { hotels: [], activities: [], transfers: [] },
    errors: []
  };

  await sleep(1000);

  if (opts.extractItinerary !== false) {
    const ok = await clickMainTab('ITINERARY');
    if (!ok) result.errors.push('ITINERARY tab not found');
    else result.sections.itinerary = snap(document.querySelector('#tabItem')?.closest('section') || document.body, 120000);

    if (opts.extractHotels !== false) {
      const hotels = queryAll(['.hotel-content-container', '[class*="hotel-content-container"]']);
      for (let i = 0; i < Math.min(hotels.length, maxClicks); i++) {
        try {
          result.sidebars.hotels.push(await captureSidebarClick(hotels[i], i, 'hotel'));
        } catch (e) {
          result.sidebars.hotels.push({ index: i, kind: 'hotel', error: e.message || String(e) });
        }
      }
    }

    if (opts.extractActivities !== false) {
      const activities = queryAll([
        '.add-activity-card-conatiner',
        '[class*="add-activity-card-conatiner"]',
        '[class*="add-activity-card-container"]',
        '[class*="add-activity-card"]'
      ]);
      for (let i = 0; i < Math.min(activities.length, maxClicks); i++) {
        try {
          result.sidebars.activities.push(await captureSidebarClick(activities[i], i, 'activity'));
        } catch (e) {
          result.sidebars.activities.push({ index: i, kind: 'activity', error: e.message || String(e) });
        }
      }
    }

    if (opts.extractTransfers !== false) {
      const transfers = queryAll(['.transfer-row-body', '[class*="transfer-row-body"]']);
      for (let i = 0; i < Math.min(transfers.length, maxClicks); i++) {
        try {
          result.sidebars.transfers.push(await captureSidebarClick(transfers[i], i, 'transfer'));
        } catch (e) {
          result.sidebars.transfers.push({ index: i, kind: 'transfer', error: e.message || String(e) });
        }
      }
    }
  }

  if (opts.extractPolicies !== false) {
    const ok = await clickMainTab('POLICIES');
    if (!ok) result.errors.push('POLICIES tab not found');
    else result.sections.policies = snap(document.body, 120000);
  }

  if (opts.extractSummary !== false) {
    const ok = await clickMainTab('SUMMARY');
    if (!ok) result.errors.push('SUMMARY tab not found');
    else result.sections.summary = snap(document.body, 120000);
  }

  window.__vittScrapeResult = result;
  document.documentElement.removeAttribute('data-vitt-scrape-opts');
})();
