/**
 * Runs in the page context. Reads opts from data-vitt-scrape-opts on <html>.
 * Sets window.__vittScrapeResult when finished.
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
  const waitMs = opts.waitMs || 4000;
  const selector = opts.selector || null;
  const scrollUntilStable = opts.scrollUntilStable !== false;
  const cardSelector = opts.cardSelector || '[class*="packageCard"]';
  const isListingSearch = opts.scrapeMode === 'mmt-listing-search';
  const isFirstPackageListing = opts.scrapeMode === 'mmt-listing-first-package';
  const devLog = isListingSearch || isFirstPackageListing
    ? {
        searchPackageName: opts.searchPackageName || '',
        events: [],
        rounds: [],
        clicks: [],
        outcome: 'not_found'
      }
    : null;

  const dynamicPackages = [];
  const dynamicSeen = new Set();

  try {
  /** Normalize whitespace + casing for fuzzy word matching. */
  const normalizeText = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  /** Common spelling variants (MMT titles vs user query typos). */
  const WORD_ALIASES = {
    kerela: ['kerela', 'kerala'],
    kerala: ['kerela', 'kerala'],
    kolkatta: ['kolkatta', 'kolkata'],
    kolkata: ['kolkatta', 'kolkata']
  };

  const wordMatches = (haystack, word) => {
    if (haystack.includes(word)) return true;
    const aliases = WORD_ALIASES[word];
    return aliases ? aliases.some((alias) => haystack.includes(alias)) : false;
  };

  /** True when every word in query appears in target (case/whitespace/punctuation insensitive). */
  const allWordsPresent = (target, query) => {
    const haystack = normalizeText(target);
    const words = normalizeText(query).split(' ').filter(Boolean);
    if (!words.length) return false;
    return words.every((word) => wordMatches(haystack, word));
  };

  const getScrollRoot = () => {
    if (selector) {
      const el = document.querySelector(selector);
      if (el) return { type: 'element', el };
    }
    return { type: 'window', el: null };
  };

  const getScrollHeight = (root) => {
    if (root.type === 'element') return root.el.scrollHeight;
    return Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight || 0);
  };

  const scrollToBottom = (root) => {
    if (root.type === 'element') {
      root.el.scrollTop = root.el.scrollHeight;
    } else {
      window.scrollTo(0, getScrollHeight(root));
    }
  };

  const dispatchScrollEvents = () => {
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
  };

  /** Poll for up to maxWaitMs; scroll again immediately when height/cards grow. */
  const waitForContentGrowth = async (root, heightBefore, cardsBefore, maxWaitMs, pollIntervalMs = 1000) => {
    scrollToBottom(root);
    dispatchScrollEvents();

    let lastHeight = heightBefore;
    let lastCards = cardsBefore;
    let waitStart = Date.now();
    let sawGrowth = false;

    while (Date.now() - waitStart < maxWaitMs) {
      const remaining = maxWaitMs - (Date.now() - waitStart);
      if (remaining <= 0) break;
      await sleep(Math.min(pollIntervalMs, remaining));

      const heightNow = getScrollHeight(root);
      const cardsNow = countCards();
      if (heightNow > lastHeight || cardsNow > lastCards) {
        sawGrowth = true;
        lastHeight = heightNow;
        lastCards = cardsNow;
        scrollToBottom(root);
        dispatchScrollEvents();
        waitStart = Date.now();
      }
    }

    const heightAfter = getScrollHeight(root);
    const cardsAfter = countCards();
    const grew = sawGrowth || heightAfter > heightBefore || cardsAfter > cardsBefore;
    return { grew, heightAfter, cardsAfter };
  };

  const countCards = () => document.querySelectorAll(cardSelector).length;

  const absoluteUrl = (value) => {
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return value || '';
    }
  };

  const urlFromString = (value) => {
    if (!value) return '';
    const m = String(value).match(
      /(https?:\/\/[^\s"'<>]+?\/holidays\/[^\s"'<>]*package[^\s"'<>]*|\/holidays\/[^\s"'<>]*package[^\s"'<>]*)/i
    );
    return m ? absoluteUrl(m[1]) : '';
  };

  const packageUrlFromElement = (el) => {
    if (!el) return '';

    const anchor = el.closest('a[href]') || el.querySelector('a[href]');
    if (anchor?.href && /\/package/i.test(anchor.href)) {
      return absoluteUrl(anchor.href);
    }

    for (const attr of el.attributes || []) {
      const fromAttr = urlFromString(attr.value);
      if (fromAttr) return fromAttr;
    }

    const onclick = el.getAttribute('onclick') || el.getAttribute('ng-click') || '';
    const fromClick = urlFromString(onclick);
    if (fromClick) return fromClick;

    const card =
      el.closest('[class*="packageCard"]') ||
      el.closest('[class*="listingCard"]') ||
      el.closest('[class*="package-card"]');
    if (card) {
      const cardLink = card.querySelector('a[href*="/package"]');
      if (cardLink?.href) return absoluteUrl(cardLink.href);
    }

    return '';
  };

  const textLines = (el) =>
    (el?.innerText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  const extractListingPackages = () => {
    const cards = document.querySelectorAll(cardSelector);
    const packages = [];
    const seen = new Set();

    for (const card of cards) {
      const head =
        card.querySelector('.packageHead[title]') ||
        card.querySelector('[class*="packageHead"][title]') ||
        card.querySelector('.packageHead') ||
        card.querySelector('[class*="packageHead"]');
      const name = (head?.getAttribute('title') || head?.textContent || '').trim();
      const duration = (
        card.querySelector('.packageHead + span.selected')?.textContent ||
        card.querySelector('.selected')?.textContent ||
        card.querySelector('[class*="duration"]')?.textContent ||
        ''
      ).trim();

      const priceBox = card.querySelector('.includeWrapper, [class*="includeWrapper"]');
      const priceSource = priceBox?.innerText || card.innerText || '';
      const priceMatch = priceSource.match(/₹([\d,]+)\s*\/Person/i) || priceSource.match(/₹([\d,]+)/);
      const price = priceMatch ? `₹${priceMatch[1]}` : '';

      const variantEls = card.querySelectorAll(
        '.variant-card-container.pointer, .variant-card-container, [class*="variant-card-container"]'
      );

      let detail_url = '';
      const package_options = [];

      for (const [index, variant] of variantEls.entries()) {
        const option_url = packageUrlFromElement(variant);
        const preview = textLines(variant).slice(0, 3).join(' ').slice(0, 120);
        if (option_url) {
          package_options.push({
            option_label: preview || `Option ${index + 1}`,
            detail_url: option_url
          });
          if (!detail_url) detail_url = option_url;
        }
      }

      if (!detail_url) {
        detail_url = packageUrlFromElement(priceBox) || packageUrlFromElement(card);
      }

      const features = [];
      for (const li of card.querySelectorAll('.tripListWrapper li, .visitListWrapper li, [class*="tripList"] li')) {
        const line = (li.innerText || '').trim();
        if (line && line.length < 60) features.push(line);
      }

      const duration_details = [];
      for (const span of card.querySelectorAll('.itineraryList span, [class*="itineraryList"] span')) {
        const line = (span.innerText || '').trim();
        if (line) duration_details.push(line);
      }

      const key = `${name}|${duration}`;
      if (!name || name.length < 3 || seen.has(key)) continue;
      seen.add(key);

      packages.push({
        name,
        duration,
        duration_details: duration_details.slice(0, 6),
        features: features.slice(0, 12),
        price,
        detail_url,
        package_options
      });
    }

    return packages;
  };

  const dismissPageOverlays = async () => {
    const closeSelectors = [
      '._Modal.modalCont .close.closeIcon',
      '._Modal.modalCont .close',
      '.modalCont .close.closeIcon',
      '.close.closeIcon',
      '[class*="modal"] .close',
      '[class*="Modal"] .close',
      '[class*="popup"] .close',
      '[class*="Popup"] .close',
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      '.loginClose',
      '.crossIcon',
      '.header-cross-btn',
      '[data-testid="header-cross-btn"]'
    ];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let closed = false;
      for (const sel of closeSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          closed = true;
          await sleep(400);
        }
      }
      if (!closed) break;
    }
  };

  const closeModals = dismissPageOverlays;

  const tabBarLeft = () =>
    document.querySelector(
      '#collectionList .srollTapLeft, #collectionList .scrollTapLeft, .tabScrollSection .srollTapLeft, .tabScrollSection .scrollTapLeft'
    );
  const tabBarRight = () =>
    document.querySelector(
      '#collectionList .srollTapRight, #collectionList .scrollTapRight, .tabScrollSection .srollTapRight, .tabScrollSection .scrollTapRight'
    );
  const tabListItems = () =>
    document.querySelectorAll('#collectionList .tabsWrapper li, .tabScrollSection .tabsWrapper li');

  const normalizeTabName = (value) => normalizeText(value);

  const readListingTabCatalog = () => {
    const seen = new Set();
    const tabs = [];
    for (const li of tabListItems()) {
      const name = (li.querySelector('.name')?.textContent || '').trim();
      const packCount = (li.querySelector('.packCount')?.textContent || '').replace(/\s+/g, ' ').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      tabs.push({ name, packCount });
    }
    return tabs;
  };

  const scrollTabBarToStart = async () => {
    const left = tabBarLeft();
    if (!left) return;
    let clicks = 0;
    while (!left.classList.contains('disabled') && clicks < 25) {
      left.click();
      await sleep(250);
      clicks += 1;
    }
  };

  const collectAllListingTabNames = async () => {
    await scrollTabBarToStart();
    const seen = new Set();
    const tabs = [];
    const ingest = () => {
      for (const entry of readListingTabCatalog()) {
        if (!seen.has(entry.name)) {
          seen.add(entry.name);
          tabs.push(entry);
        }
      }
    };
    ingest();
    const right = tabBarRight();
    if (!right) return tabs;
    let clicks = 0;
    while (!right.classList.contains('disabled') && clicks < 25) {
      right.click();
      await sleep(400);
      ingest();
      clicks += 1;
    }
    return tabs;
  };

  const waitForListingCardsReady = async () => {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      const loading = document.querySelector('.packageHeadLoading, .imageCardWrapperLoading');
      const cards = countCards();
      if (!loading && cards > 0) return true;
      await sleep(500);
    }
    return countCards() > 0;
  };

  const waitForCollectionTabBar = async () => {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      if (tabListItems().length > 0) return true;
      await sleep(500);
    }
    return tabListItems().length > 0;
  };

  const activateListingTab = async (tabName) => {
    const want = normalizeTabName(tabName);
    await scrollTabBarToStart();
    for (let round = 0; round < 30; round += 1) {
      for (const li of tabListItems()) {
        const name = (li.querySelector('.name')?.textContent || '').trim();
        if (normalizeTabName(name) !== want) continue;
        li.scrollIntoView({ block: 'nearest', inline: 'center' });
        if (li.classList.contains('active')) {
          await waitForListingCardsReady();
          return true;
        }
        li.click();
        await sleep(Math.min(waitMs, 2000));
        await waitForListingCardsReady();
        return true;
      }
      const right = tabBarRight();
      if (!right || right.classList.contains('disabled')) break;
      right.click();
      await sleep(350);
    }
    return false;
  };

  const isListingOnly = opts.scrapeMode === 'mmt-listing';

  if (opts.discoverListingTabsOnly) {
    await dismissPageOverlays();
    await waitForCollectionTabBar();
    const listingTabCatalog = await collectAllListingTabNames();
    window.__vittScrapeResult = {
      schemaVersion: 2,
      pageType: 'mmt-listing-discover',
      listingTabCatalog,
      capturedAt: new Date().toISOString(),
      url: location.href,
      extractedUrl: location.href
    };
    document.documentElement.removeAttribute('data-vitt-scrape-opts');
    return;
  }

  if (opts.listingTabName && isListingOnly) {
    await waitForCollectionTabBar();
  }

  await dismissPageOverlays();

  if (opts.listingTabName && isListingOnly) {
    const activated = await activateListingTab(opts.listingTabName);
    if (!activated) {
      console.warn('[vitt] Listing tab not found, continuing with visible content:', opts.listingTabName);
    }
  }

  const interceptTabUrl = async (el, timeoutMs = 2000, label = 'click') => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (url, reason) => {
        if (settled) return;
        settled = true;
        chrome.runtime.onMessage.removeListener(onResult);
        if (devLog) {
          devLog.clicks.push({ label, url: url || null, reason: reason || (url ? 'ok' : 'failed'), timeoutMs });
        }
        resolve(url || null);
      };

      const onResult = (msg) => {
        if (msg?.channel === 'intercept_result') finish(msg.url, msg.reason || 'intercept_result');
      };
      chrome.runtime.onMessage.addListener(onResult);

      chrome.runtime.sendMessage({ channel: 'intercept_next_tab', timeout: timeoutMs }, (res) => {
        if (chrome.runtime.lastError || !res?.ready) {
          finish(null, chrome.runtime.lastError?.message || 'intercept_not_ready');
          return;
        }
        el.scrollIntoView({ block: 'center' });
        el.click();
        setTimeout(() => finish(null, 'click_timeout'), timeoutMs + 500);
      });
    });
  };

  const resolveCardWrapper = (el) =>
    el.closest('.packageCardWrapper') ||
    el.closest('[class*="packageCardWrapper"]') ||
    el.closest('[class*="packageCard"]') ||
    el;

  const VARIANT_SELECTOR =
    '.variant-card-container.pointer, .variant-card-container, [class*="variant-card-container"]';

  /** Variants scoped to this card only (MMT: .package-varient-parent → .variant-card-container). */
  const findVariantsInCard = (cardRoot) => {
    const variantParent =
      cardRoot.querySelector(
        '.package-varient-parent, .package-variant-parent, [class*="package-varient-parent"], [class*="package-variant-parent"]'
      ) || cardRoot;
    return [...variantParent.querySelectorAll(VARIANT_SELECTOR)];
  };

  const waitForVariantsInCard = async (cardRoot, maxWaitMs = 2500) => {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const variants = findVariantsInCard(cardRoot);
      if (variants.length) return variants;
      await sleep(200);
    }
    return findVariantsInCard(cardRoot);
  };

  const resolvePackageClickTarget = (cardRoot) => {
    const textContainer = cardRoot.querySelector('.packageTextContainer, [class*="packageTextContainer"]');
    const priceBox = cardRoot.querySelector('.includeWrapper, [class*="includeWrapper"]');
    return {
      clickTarget: textContainer || priceBox || cardRoot,
      clickTargetKind: textContainer ? 'packageTextContainer' : priceBox ? 'includeWrapper' : 'cardRoot',
      priceBox
    };
  };

  const processVariantOptions = async (cardRoot, activeVariants, roundNum, detail_url, package_options) => {
    let resolvedDetailUrl = detail_url;

    for (const [index, variant] of activeVariants.entries()) {
      const variantText = (variant.innerText || '').toLowerCase();
      const isSoldOut = variantText.includes('sold out');
      const isWithFlight = variantText.includes('with flight');
      const isWithoutFlight = variantText.includes('without flight');

      if (isWithFlight && opts.extractWithFlight === false) {
        if (devLog) {
          devLog.events.push({
            type: 'variant_skipped',
            round: roundNum,
            index: index + 1,
            reason: 'extractWithFlight_disabled',
            label: (variant.innerText || '').slice(0, 80)
          });
        }
        continue;
      }
      if (isWithoutFlight && opts.extractWithoutFlight === false) {
        if (devLog) {
          devLog.events.push({
            type: 'variant_skipped',
            round: roundNum,
            index: index + 1,
            reason: 'extractWithoutFlight_disabled',
            label: (variant.innerText || '').slice(0, 80)
          });
        }
        continue;
      }

      let vUrl = '';
      if (!isSoldOut) {
        if (devLog) {
          devLog.events.push({
            type: 'variant_click_start',
            round: roundNum,
            index: index + 1,
            label: (variant.innerText || '').slice(0, 80)
          });
        }
        vUrl = await interceptTabUrl(variant, 5000, `variant_${index + 1}`);
        if (devLog) {
          devLog.events.push({
            type: vUrl ? 'variant_url_captured' : 'variant_click_no_url',
            round: roundNum,
            index: index + 1,
            url: vUrl ? vUrl.slice(0, 160) : null
          });
        }
      } else if (devLog) {
        devLog.events.push({
          type: 'variant_skipped',
          round: roundNum,
          index: index + 1,
          reason: 'sold_out',
          label: (variant.innerText || '').slice(0, 80)
        });
      }

      const flight_type = isWithFlight
        ? 'withFlight'
        : isWithoutFlight
          ? 'withoutFlight'
          : 'default';

      package_options.push({
        option_label: (variant.innerText || '').split('\n').join(' ').slice(0, 100),
        detail_url: vUrl,
        status: isSoldOut ? 'sold out' : (vUrl ? 'ok' : 'failed'),
        flight_type
      });

      if (vUrl && !resolvedDetailUrl) resolvedDetailUrl = vUrl;
    }

    return resolvedDetailUrl;
  };

  const processVisibleCards = async (packages, seen, roundNum = 0) => {
    const allCards = document.querySelectorAll(cardSelector);
    const cards = isFirstPackageListing ? [...allCards].slice(0, 1) : allCards;

    for (const card of cards) {
      if (card.dataset.vittResolved === 'true') continue;

      const nameEl = card.querySelector('.packageHead[title], [class*="packageHead"]');
      const name = (nameEl?.getAttribute('title') || nameEl?.textContent || '').trim();
      const duration = (card.querySelector('.selected')?.textContent || card.querySelector('[class*="duration"]')?.textContent || '').trim();
      if (!name || name.length < 3) continue;

      // Type 3: match only .packageHead title (not full card body — avoids itinerary false positives)
      if (opts.scrapeMode === 'mmt-listing-search' && opts.searchPackageName) {
        if (!allWordsPresent(name, opts.searchPackageName)) {
          if (devLog && roundNum === 0) {
            devLog.events.push({
              type: 'title_mismatch',
              round: roundNum,
              cardTitle: name,
              searchPackageName: opts.searchPackageName
            });
          }
          card.dataset.vittResolved = 'true';
          continue;
        }
        if (devLog) devLog.events.push({ type: 'title_matched', round: roundNum, name, searchPackageName: opts.searchPackageName });
      }

      await closeModals();

      const cardRoot = resolveCardWrapper(card);
      const { clickTarget, clickTargetKind, priceBox } = resolvePackageClickTarget(cardRoot);
      if (!clickTarget) {
        if (devLog) devLog.events.push({ type: 'title_match_no_click_target', round: roundNum, name });
        continue;
      }

      card.scrollIntoView({ block: 'center' });
      await sleep(300);
      card.dataset.vittResolved = 'true';

      let detail_url = '';
      const package_options = [];

      // MMT: click .packageTextContainer — opens new tab directly OR reveals variant picker.
      if (devLog) {
        devLog.events.push({
          type: 'package_text_click_start',
          round: roundNum,
          name,
          clickTarget: clickTargetKind
        });
      }
      const urlFromTextClick = await interceptTabUrl(clickTarget, 3000, 'package_text_container');
      if (urlFromTextClick) {
        detail_url = urlFromTextClick;
        if (devLog) {
          devLog.events.push({
            type: 'package_text_url_captured',
            round: roundNum,
            url: urlFromTextClick.slice(0, 160)
          });
        }
      } else {
        if (devLog) {
          devLog.events.push({
            type: 'package_text_no_url',
            round: roundNum,
            next: 'wait_for_card_variants'
          });
        }
        await sleep(400);
        const activeVariants = await waitForVariantsInCard(cardRoot, Math.min(waitMs, 2500));
        if (devLog) {
          devLog.events.push({
            type: 'variant_modal_state',
            round: roundNum,
            globalVariantCount: 0,
            cardVariantCount: activeVariants.length,
            scopedToCard: true
          });
        }

        if (activeVariants.length) {
          detail_url = await processVariantOptions(
            cardRoot,
            activeVariants,
            roundNum,
            detail_url,
            package_options
          );
        } else if (devLog) {
          devLog.events.push({ type: 'variant_modal_not_found', round: roundNum, name });
        }
      }

      await closeModals();

      const key = `${name}|${duration}`;
      if (!seen.has(key)) {
        seen.add(key);
        const priceSource = priceBox?.innerText || cardRoot.innerText || '';
        const priceMatch = priceSource.match(/₹([\d,]+)\s*\/Person/i) || priceSource.match(/₹([\d,]+)/);
        const price = priceMatch ? `₹${priceMatch[1]}` : '';

        const features = [];
        for (const li of card.querySelectorAll('.tripListWrapper li, .visitListWrapper li, [class*="tripList"] li')) {
          const line = (li.innerText || '').trim();
          if (line && line.length < 60) features.push(line);
        }

        const duration_details = [];
        for (const span of card.querySelectorAll('.itineraryList span, [class*="itineraryList"] span')) {
          const line = (span.innerText || '').trim();
          if (line) duration_details.push(line);
        }

        packages.push({
          name, duration, duration_details: duration_details.slice(0, 6), features: features.slice(0, 12), price, detail_url, package_options
        });
      }

      if (opts.scrapeMode === 'mmt-listing-search' || isFirstPackageListing) {
        if (devLog) {
          devLog.outcome = detail_url ? 'found_with_url' : 'found_no_url';
          devLog.matchedPackage = { name, duration, detail_url, package_options };
        }
        return true;
      }
    }
    return false;
  };

  if (isFirstPackageListing) {
    await dismissPageOverlays();

    const allPackagesTab =
      opts.listingTabName ||
      readListingTabCatalog().find((t) => normalizeTabName(t.name) === normalizeTabName('All Packages'))?.name ||
      'All Packages';
    await waitForCollectionTabBar();
    const activated = await activateListingTab(allPackagesTab);
    if (!activated && devLog) {
      devLog.events.push({ type: 'listing_tab_not_found', tab: allPackagesTab });
    }

    await waitForListingCardsReady();

    const root = getScrollRoot();
    scrollToBottom(root);
    dispatchScrollEvents();

    const minCards = opts.minPackageCards ?? 4;
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      if (countCards() >= minCards) break;
      await sleep(500);
    }

    if (devLog) {
      devLog.events.push({
        type: 'scroll_once_done',
        cardsAfter: countCards(),
        minCards,
        listingTab: allPackagesTab
      });
    }

    await processVisibleCards(dynamicPackages, dynamicSeen, 1);

    if (devLog) {
      devLog.totalCardsInDom = countCards();
      if (devLog.outcome === 'not_found' && dynamicPackages[0]) {
        devLog.outcome = dynamicPackages[0].detail_url ? 'found_with_url' : 'found_no_url';
        devLog.matchedPackage = dynamicPackages[0];
      }
    }

    if (dynamicPackages.length === 0 && devLog?.matchedPackage) {
      dynamicPackages.push(devLog.matchedPackage);
    }
  } else if (scrollUntilStable || opts.scrapeMode === 'mmt-listing') {
    const root = getScrollRoot();
    let noGrowth = 0;
    let rounds = 0;
    const isListingOnly = opts.scrapeMode === 'mmt-listing';

    await dismissPageOverlays();

    if (isListingOnly) {
      // Type 1 — poll every 500ms up to waitMs; scroll to bottom immediately when cards load.
      const maxRounds = 25;
      while (rounds < maxRounds && noGrowth < 2) {
        const heightBefore = getScrollHeight(root);
        const cardsBefore = countCards();
        const { grew } = await waitForContentGrowth(root, heightBefore, cardsBefore, waitMs, 500);
        if (grew) noGrowth = 0;
        else noGrowth += 1;
        rounds += 1;
      }
    } else {
      const maxRounds = isListingSearch ? 45 : 25;
      const noGrowthLimit = isListingSearch ? 8 : 1;

      while (rounds < maxRounds) {
        await dismissPageOverlays();

        const heightBefore = getScrollHeight(root);
        const cardsBefore = countCards();
        const { grew, cardsAfter } = await waitForContentGrowth(root, heightBefore, cardsBefore, waitMs);

        if (opts.scrapeMode === 'mmt-listing-urls' || isListingSearch) {
          const found = await processVisibleCards(dynamicPackages, dynamicSeen, rounds + 1);
          if (found && isListingSearch) break;
        }

        if (grew) noGrowth = 0;
        else noGrowth += 1;

        if (devLog) {
          devLog.rounds.push({ round: rounds + 1, cardsAfter, grew, noGrowth });
        }

        rounds += 1;
        if (!isListingSearch && noGrowth >= noGrowthLimit) break;
      }
      if (devLog && devLog.outcome === 'not_found') {
        devLog.totalCardsInDom = countCards();
        devLog.totalRounds = devLog.rounds.length;
        devLog.events.push({
          type: 'search_exhausted',
          searchPackageName: opts.searchPackageName || '',
          cardsInDom: devLog.totalCardsInDom,
          rounds: devLog.totalRounds
        });
      }
    }
  }

  const captureRoot = selector ? document.querySelector(selector) : document.documentElement;
  const rootEl = captureRoot || document.documentElement;

  const clone = rootEl.cloneNode(true);
  const scope = selector ? rootEl : document;
  const originals = scope.querySelectorAll('input, textarea, select');
  const copies = clone.querySelectorAll('input, textarea, select');
  const sensitive = /password|cc-|credit|card|cvc|cvv|otp|one-time/i;

  originals.forEach((element, index) => {
    const copy = copies[index];
    if (!copy) return;
    const descriptor = `${element.type || ''} ${element.name || ''} ${element.id || ''} ${element.autocomplete || ''}`;
    if (sensitive.test(descriptor) || element.type === 'hidden' || element.type === 'password') {
      if ('value' in copy) copy.value = '[REDACTED]';
      copy.setAttribute('value', '[REDACTED]');
      return;
    }
    if (element instanceof HTMLTextAreaElement) copy.textContent = element.value;
    if (element instanceof HTMLSelectElement) {
      [...copy.options].forEach((option, optionIndex) => {
        option.selected = element.options[optionIndex]?.selected || false;
      });
    } else if (element.type === 'checkbox' || element.type === 'radio') {
      copy.toggleAttribute('checked', element.checked);
    } else if ('value' in element) {
      copy.setAttribute('value', element.value);
    }
  });

  const metadata = {};
  document.querySelectorAll('meta[name], meta[property]').forEach((meta) => {
    const key = meta.getAttribute('name') || meta.getAttribute('property');
    if (key) metadata[key] = meta.getAttribute('content') || '';
  });

  const linkScope = selector ? rootEl : document;
  const links = [...linkScope.querySelectorAll('a')].map((link) => ({
    text: link.innerText.trim(),
    href: link.href
  })).slice(0, 10000);

  const images = [...linkScope.querySelectorAll('img')].map((img) => ({
    src: absoluteUrl(img.currentSrc || img.src),
    alt: img.alt || '',
    width: img.naturalWidth,
    height: img.naturalHeight
  })).slice(0, 10000);

  const listingPackages =
    (opts.scrapeMode === 'mmt-listing-urls' ||
      opts.scrapeMode === 'mmt-listing-search' ||
      isFirstPackageListing)
      ? dynamicPackages
      : (opts.scrapeMode === 'mmt-listing' || /\/holidays\/india\/search\b/i.test(location.pathname))
        ? extractListingPackages()
        : [];

  window.__vittScrapeResult = {
    schemaVersion: 2,
    pageType: opts.scrapeMode || 'mmt-listing',
    capturedAt: new Date().toISOString(),
    url: location.href,
    extractedUrl: location.href,
    canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || null,
    title: document.title,
    language: document.documentElement.lang || null,
    selector: selector || null,
    scrollUntilStable,
    extractAllListingTabs: opts.extractAllListingTabs === true,
    listingTabName: opts.listingTabName || null,
    metadata,
    text: rootEl === document.documentElement ? (document.body?.innerText || '') : (rootEl.innerText || ''),
    html: selector ? clone.outerHTML : `<!DOCTYPE ${document.doctype?.name || 'html'}>\n${clone.outerHTML}`,
    links,
    images,
    cardCount: countCards(),
    listingPackages,
    devLog: devLog || undefined,
    resourceUrls: performance.getEntriesByType('resource').map((e) => e.name).slice(0, 20000)
  };

  document.documentElement.removeAttribute('data-vitt-scrape-opts');
  } catch (err) {
    if (devLog) devLog.outcome = 'script_error';
    window.__vittScrapeResult = {
      schemaVersion: 2,
      pageType: opts.scrapeMode || 'mmt-listing',
      capturedAt: new Date().toISOString(),
      url: location.href,
      error: err?.message || String(err),
      listingPackages: [],
      devLog: devLog || undefined
    };
  }
})();
