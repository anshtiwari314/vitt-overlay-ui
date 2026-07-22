/**
 * Observes MMT package price block; notifies background when .priceDetail span changes.
 * Loaded by extension listener — not used for server-driven jobs.
 */
(() => {
  const PRICE_SEL = '.pakageDtlWrap .priceDetail span';
  const ROOT_SEL = '.pakageDtlWrap';
  const LISTENER_ID = 'mmt-package-itinerary';
  const POLL_MS = 500;
  const MAX_WAIT_MS = 60000;

  let lastPrice = null;
  let observer = null;

  const normalizePrice = (value) =>
    String(value || '')
      .replace(/\s+/g, '')
      .replace(/[^\d₹,]/g, '');

  const readPrice = () => document.querySelector(PRICE_SEL)?.textContent?.trim() || null;

  const readSlashedPrice = () =>
    document.querySelector('.pakageDtlWrap .slashedPrice')?.textContent?.trim() || null;

  const emit = (reason) => {
    const price = readPrice();
    if (!price) return;

    const normalized = normalizePrice(price);
    if (reason !== 'force' && normalized === lastPrice) return;
    lastPrice = normalized;

    let itineraryId = null;
    try {
      itineraryId = new URL(location.href).searchParams.get('itineraryId');
    } catch {
      /* ignore */
    }

    chrome.runtime.sendMessage({
      channel: 'listener_price_change',
      listenerId: LISTENER_ID,
      reason,
      price,
      slashedPrice: readSlashedPrice(),
      url: location.href,
      itineraryId
    });
  };

  const armObserver = () => {
    const root = document.querySelector(ROOT_SEL);
    if (!root || observer) return Boolean(root);

    observer = new MutationObserver(() => emit('price_change'));
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
    return true;
  };

  const deadline = Date.now() + MAX_WAIT_MS;
  const poll = setInterval(() => {
    if (armObserver() || Date.now() > deadline) clearInterval(poll);
  }, POLL_MS);
})();
