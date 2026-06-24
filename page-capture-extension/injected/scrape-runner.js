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

  if (scrollUntilStable) {
    const root = getScrollRoot();
    let noGrowth = 0;
    let rounds = 0;
    const maxRounds = 25;

    while (rounds < maxRounds && noGrowth < 2) {
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

  window.__vittScrapeResult = {
    schemaVersion: 1,
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
    resourceUrls: performance.getEntriesByType('resource').map((e) => e.name).slice(0, 20000)
  };

  document.documentElement.removeAttribute('data-vitt-scrape-opts');
})();
