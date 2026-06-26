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

  const countCards = () => document.querySelectorAll(cardSelector).length;

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

  const closeModals = async () => {
    const modalCloser = document.querySelector('._Modal.modalCont .close.closeIcon, .close.closeIcon');
    if (modalCloser) {
      modalCloser.click();
      await sleep(500);
    }
  };

  const interceptTabUrl = async (el, timeoutMs = 2000) => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (url) => {
        if (settled) return;
        settled = true;
        chrome.runtime.onMessage.removeListener(onResult);
        resolve(url || null);
      };

      const onResult = (msg) => {
        if (msg?.channel === 'intercept_result') finish(msg.url);
      };
      chrome.runtime.onMessage.addListener(onResult);

      chrome.runtime.sendMessage({ channel: 'intercept_next_tab', timeout: timeoutMs }, (res) => {
        if (chrome.runtime.lastError || !res?.ready) {
          finish(null);
          return;
        }
        el.scrollIntoView({ block: 'center' });
        el.click();
        setTimeout(() => finish(null), timeoutMs + 500);
      });
    });
  };

  const processVisibleCards = async (packages, seen) => {
    const cards = document.querySelectorAll(cardSelector);
    for (const card of cards) {
      if (card.dataset.vittResolved === 'true') continue;

      const nameEl = card.querySelector('.packageHead[title], [class*="packageHead"]');
      const name = (nameEl?.getAttribute('title') || nameEl?.textContent || '').trim();
      const duration = (card.querySelector('.selected')?.textContent || card.querySelector('[class*="duration"]')?.textContent || '').trim();
      if (!name || name.length < 3) continue;

      // Type 3: Search package match
      if (opts.scrapeMode === 'mmt-listing-search' && opts.searchPackageName) {
        const searchWords = opts.searchPackageName.toLowerCase().split(/\s+/).filter(Boolean);
        const nameLower = name.toLowerCase();
        const matches = searchWords.every(w => nameLower.includes(w));
        if (!matches) {
          card.dataset.vittResolved = 'true';
          continue;
        }
      }

      await closeModals();

      const priceBox = card.querySelector('.includeWrapper, [class*="includeWrapper"]');
      if (!priceBox) continue;

      card.dataset.vittResolved = 'true';

      let detail_url = '';
      const package_options = [];

      // Try capturing tab directly from price box (No variant scenario)
      const urlFromPrice = await interceptTabUrl(priceBox, 1500);
      if (urlFromPrice) {
        detail_url = urlFromPrice;
      } else {
        await sleep(600); // Give modal time to appear
        const variantEls = document.querySelectorAll('.variant-card-container.pointer, .variant-card-container');
        const activeVariants = variantEls.length > 0 ? variantEls : card.querySelectorAll('.variant-card-container');

        for (const [index, variant] of activeVariants.entries()) {
          const variantText = (variant.innerText || '').toLowerCase();
          const isSoldOut = variantText.includes('sold out');
          const isWithFlight = variantText.includes('with flight');
          const isWithoutFlight = variantText.includes('without flight');

          if (isWithFlight && opts.extractWithFlight === false) continue;
          if (isWithoutFlight && opts.extractWithoutFlight === false) continue;

          let vUrl = '';
          if (!isSoldOut) {
            vUrl = await interceptTabUrl(variant, 2500);
          }

          package_options.push({
            option_label: (variant.innerText || '').split('\n').join(' ').slice(0, 100),
            detail_url: vUrl,
            status: isSoldOut ? 'sold out' : (vUrl ? 'ok' : 'failed')
          });

          if (vUrl && !detail_url) detail_url = vUrl;
        }
      }

      await closeModals();

      const key = `${name}|${duration}`;
      if (!seen.has(key)) {
        seen.add(key);
        const priceSource = priceBox.innerText || card.innerText || '';
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

      if (opts.scrapeMode === 'mmt-listing-search') {
        return true; // Found and resolved target package
      }
    }
    return false;
  };

  const dynamicPackages = [];
  const dynamicSeen = new Set();

  if (scrollUntilStable) {
    const root = getScrollRoot();
    let noGrowth = 0;
    let rounds = 0;
    const maxRounds = 25;

    while (rounds < maxRounds && noGrowth < 2) {
      if (opts.scrapeMode === 'mmt-listing-urls' || opts.scrapeMode === 'mmt-listing-search') {
        const found = await processVisibleCards(dynamicPackages, dynamicSeen);
        if (found && opts.scrapeMode === 'mmt-listing-search') break;
      }

      const heightBefore = getScrollHeight(root);
      const cardsBefore = countCards();
      scrollToBottom(root);
      await sleep(waitMs);
      const heightAfter = getScrollHeight(root);
      const cardsAfter = countCards();
      const grew = heightAfter > heightBefore || cardsAfter > cardsBefore;
      if (grew) noGrowth = 0;
      else noGrowth += 1;
      rounds += 1;
    }
  }

  const absoluteUrl = (value) => {
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return value || '';
    }
  };

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
    (opts.scrapeMode === 'mmt-listing-urls' || opts.scrapeMode === 'mmt-listing-search')
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
    metadata,
    text: rootEl === document.documentElement ? (document.body?.innerText || '') : (rootEl.innerText || ''),
    html: selector ? clone.outerHTML : `<!DOCTYPE ${document.doctype?.name || 'html'}>\n${clone.outerHTML}`,
    links,
    images,
    cardCount: countCards(),
    listingPackages,
    resourceUrls: performance.getEntriesByType('resource').map((e) => e.name).slice(0, 20000)
  };

  document.documentElement.removeAttribute('data-vitt-scrape-opts');
})();
