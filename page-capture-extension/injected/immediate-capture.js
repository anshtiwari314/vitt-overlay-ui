/**
 * Instant snapshot of the current page — no scroll, waits, or tab automation.
 * Used for manual "Capture and send". Server-driven jobs use scrape-runner / mmt-package-scraper.
 */
(() => {
  const parseOpts = () => {
    try {
      const raw = document.documentElement.getAttribute('data-vitt-scrape-opts') || '{}';
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const opts = parseOpts();
  const selector = opts.selector || null;
  const cardSelector = opts.cardSelector || '[class*="packageCard"]';

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
    schemaVersion: 2,
    pageType: opts.scrapeMode || 'manual',
    captureMode: 'immediate',
    capturedAt: new Date().toISOString(),
    url: location.href,
    extractedUrl: location.href,
    canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || null,
    title: document.title,
    language: document.documentElement.lang || null,
    selector: selector || null,
    scrollUntilStable: false,
    metadata,
    text: rootEl === document.documentElement ? (document.body?.innerText || '') : (rootEl.innerText || ''),
    html: selector ? clone.outerHTML : `<!DOCTYPE ${document.doctype?.name || 'html'}>\n${clone.outerHTML}`,
    links,
    images,
    cardCount: document.querySelectorAll(cardSelector).length,
    resourceUrls: performance.getEntriesByType('resource').map((e) => e.name).slice(0, 20000)
  };

  document.documentElement.removeAttribute('data-vitt-scrape-opts');
})();
