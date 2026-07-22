(() => {
  if (window.__MMT_ITINERARY_INTERCEPTOR_INSTALLED__) {
    return;
  }

  Object.defineProperty(window, '__MMT_ITINERARY_INTERCEPTOR_INSTALLED__', {
    value: true,
    writable: false
  });

  const TARGET_ORIGIN = 'https://holidayservice.makemytrip.com';
  const TARGET_PATH = '/HolidayServices/service/diy/v3/createItinerary';

  function isTargetRequest(requestUrl, method = 'GET') {
    try {
      const url = new URL(requestUrl, window.location.href);
      return (
        method.toUpperCase() === 'POST' &&
        url.origin === TARGET_ORIGIN &&
        url.pathname === TARGET_PATH
      );
    } catch {
      return false;
    }
  }

  function publishItineraryId(responseData) {
    const itineraryId = responseData?.itineraryId;

    if (
      responseData?.success !== true ||
      typeof itineraryId !== 'string' ||
      itineraryId.trim() === ''
    ) {
      return;
    }

    window.postMessage(
      {
        source: 'MMT_ITINERARY_INTERCEPTOR',
        type: 'ITINERARY_ID_CAPTURED',
        itineraryId: itineraryId.trim()
      },
      window.location.origin
    );
  }

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const input = args[0];
    const options = args[1];
    const requestUrl = input instanceof Request ? input.url : String(input);
    const requestMethod =
      options?.method || (input instanceof Request ? input.method : 'GET');

    const response = await originalFetch.apply(this, args);

    if (isTargetRequest(requestUrl, requestMethod) && response.ok) {
      response
        .clone()
        .json()
        .then(publishItineraryId)
        .catch((error) => {
          console.error('[mmt-itinerary] fetch_parse_error', error);
        });
    }

    return response;
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...remainingArguments) {
    this.__mmtRequestDetails = {
      method,
      url
    };

    return originalXhrOpen.call(this, method, url, ...remainingArguments);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const requestDetails = this.__mmtRequestDetails;

    if (requestDetails && isTargetRequest(requestDetails.url, requestDetails.method)) {
      this.addEventListener(
        'load',
        function () {
          if (this.status < 200 || this.status >= 300) {
            return;
          }

          try {
            const responseData =
              this.responseType === 'json' && this.response
                ? this.response
                : JSON.parse(this.responseText);

            publishItineraryId(responseData);
          } catch (error) {
            console.error('[mmt-itinerary] xhr_parse_error', error);
          }
        },
        { once: true }
      );
    }

    return originalXhrSend.apply(this, args);
  };
})();
