/**
 * MMT package detail page: tabs (Itinerary / Policies / Summary) + itinerary sidebars.
 * Sets window.__vittScrapeResult. Reads opts from data-vitt-scrape-opts on <html>.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const startMs = Date.now();

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

  const devLog = {
    events: [],
    startedAt: new Date().toISOString(),
    url: location.href,
    options: {
      waitMs,
      maxSidebarClicks: maxClicks,
      extractItinerary: opts.extractItinerary !== false,
      extractPolicies: opts.extractPolicies !== false,
      extractSummary: opts.extractSummary !== false,
      extractHotels: opts.extractHotels !== false,
      extractActivities: opts.extractActivities !== false,
      extractTransfers: opts.extractTransfers !== false
    },
    counts: { hotels: 0, activities: 0, transfers: 0 },
    captured: { hotels: 0, activities: 0, transfers: 0 },
    mainTabs: {},
    outcome: 'in_progress'
  };

  const note = (type, detail = {}) => {
    devLog.events.push({ ts: new Date().toISOString(), type, ...detail });
  };

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
    note('main_tab_click_start', { tab: label });
    const tab = findMainTab(label);
    if (!tab) {
      note('main_tab_not_found', { tab: label });
      return false;
    }
    tab.scrollIntoView({ block: 'center' });
    tab.click();
    await sleep(waitMs);
    note('main_tab_click_done', { tab: label, waitMs });
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
    note('sidebar_click_start', { kind, index, preview });
    el.scrollIntoView({ block: 'center' });
    await sleep(400);
    el.click();
    await sleep(waitMs);
    const panel = findSidebar();
    const content = snap(panel || document.querySelector('[class*="sidePanel"]') || el);
    await closeSidebar();
    await sleep(600);
    note('sidebar_click_done', {
      kind,
      index,
      preview,
      textLen: content.text.length,
      htmlLen: content.html.length,
      hasPanel: Boolean(panel)
    });
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
    errors: [],
    devLog
  };

  try {
    note('page_ready_wait', { waitMs: 1000 });
    await sleep(1000);

    if (opts.extractItinerary !== false) {
      const ok = await clickMainTab('ITINERARY');
      devLog.mainTabs.itinerary = ok ? 'ok' : 'not_found';
      if (!ok) result.errors.push('ITINERARY tab not found');
      else {
        const section = snap(document.querySelector('#tabItem')?.closest('section') || document.body, 120000);
        result.sections.itinerary = section;
        note('section_captured', {
          section: 'itinerary',
          textLen: section.text.length,
          htmlLen: section.html.length
        });
      }

      if (opts.extractHotels !== false) {
        const hotels = queryAll(['.hotel-content-container', '[class*="hotel-content-container"]']);
        devLog.counts.hotels = hotels.length;
        note('sidebar_scan', { kind: 'hotel', found: hotels.length, maxClicks });
        for (let i = 0; i < Math.min(hotels.length, maxClicks); i++) {
          try {
            result.sidebars.hotels.push(await captureSidebarClick(hotels[i], i, 'hotel'));
            devLog.captured.hotels += 1;
          } catch (e) {
            note('sidebar_error', { kind: 'hotel', index: i, error: e.message || String(e) });
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
        devLog.counts.activities = activities.length;
        note('sidebar_scan', { kind: 'activity', found: activities.length, maxClicks });
        for (let i = 0; i < Math.min(activities.length, maxClicks); i++) {
          try {
            result.sidebars.activities.push(await captureSidebarClick(activities[i], i, 'activity'));
            devLog.captured.activities += 1;
          } catch (e) {
            note('sidebar_error', { kind: 'activity', index: i, error: e.message || String(e) });
            result.sidebars.activities.push({ index: i, kind: 'activity', error: e.message || String(e) });
          }
        }
      }

      if (opts.extractTransfers !== false) {
        const transfers = queryAll(['.transfer-row-body', '[class*="transfer-row-body"]']);
        devLog.counts.transfers = transfers.length;
        note('sidebar_scan', { kind: 'transfer', found: transfers.length, maxClicks });
        for (let i = 0; i < Math.min(transfers.length, maxClicks); i++) {
          try {
            result.sidebars.transfers.push(await captureSidebarClick(transfers[i], i, 'transfer'));
            devLog.captured.transfers += 1;
          } catch (e) {
            note('sidebar_error', { kind: 'transfer', index: i, error: e.message || String(e) });
            result.sidebars.transfers.push({ index: i, kind: 'transfer', error: e.message || String(e) });
          }
        }
      }
    } else {
      note('skip', { section: 'itinerary', reason: 'extractItinerary=false' });
    }

    if (opts.extractPolicies !== false) {
      const ok = await clickMainTab('POLICIES');
      devLog.mainTabs.policies = ok ? 'ok' : 'not_found';
      if (!ok) result.errors.push('POLICIES tab not found');
      else {
        const section = snap(document.body, 120000);
        result.sections.policies = section;
        note('section_captured', {
          section: 'policies',
          textLen: section.text.length,
          htmlLen: section.html.length
        });
      }
    } else {
      note('skip', { section: 'policies', reason: 'extractPolicies=false' });
    }

    if (opts.extractSummary !== false) {
      const ok = await clickMainTab('SUMMARY');
      devLog.mainTabs.summary = ok ? 'ok' : 'not_found';
      if (!ok) result.errors.push('SUMMARY tab not found');
      else {
        const section = snap(document.body, 120000);
        result.sections.summary = section;
        note('section_captured', {
          section: 'summary',
          textLen: section.text.length,
          htmlLen: section.html.length
        });
      }
    } else {
      note('skip', { section: 'summary', reason: 'extractSummary=false' });
    }

    devLog.outcome = result.errors.length ? 'completed_with_errors' : 'completed';
  } catch (err) {
    devLog.outcome = 'script_error';
    result.errors.push(err?.message || String(err));
    note('script_error', { error: err?.message || String(err) });
  } finally {
    devLog.durationMs = Date.now() - startMs;
    devLog.finishedAt = new Date().toISOString();
    note('finished', {
      outcome: devLog.outcome,
      durationMs: devLog.durationMs,
      errors: result.errors.length
    });
    result.html = snap(document.body, 120000).html;
    if (opts.flightType) {
      result.flight_type = opts.flightType;
    }
  }

  window.__vittScrapeResult = result;
  document.documentElement.removeAttribute('data-vitt-scrape-opts');
})();
