const BACKEND_ENDPOINT =
  "http://127.0.0.1:5000/api/itinerary";

async function sendItineraryToBackend(itineraryData) {
  const payload = {
    itineraryId: itineraryData.itineraryId,
    message: "Itinerary created successfully",
    pageUrl: itineraryData.pageUrl,
    capturedAt: itineraryData.capturedAt
  };

  try {
    console.log(
      "[MMT Extension] Sending itinerary to backend:",
      payload
    );

    const response = await fetch(BACKEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const responseText = await response.text();

      console.error(
        "[MMT Extension] Backend request failed:",
        response.status,
        response.statusText,
        responseText
      );

      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        responseText
      };
    }

    console.log(
      "[MMT Extension] Backend notified for itinerary:",
      itineraryData.itineraryId
    );

    return {
      ok: true,
      status: response.status
    };
  } catch (error) {
    console.error(
      "[MMT Extension] Unable to notify backend:",
      error
    );

    return {
      ok: false,
      error: String(error)
    };
  }
}

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message?.type !== "SAVE_ITINERARY_ID") {
      return;
    }

    const senderUrl = sender.tab?.url || "";

    const isAllowedPage =
      senderUrl.startsWith(
        "https://holidayz.makemytrip.com/holidays/diyPlanner"
      );

    if (!isAllowedPage) {
      console.warn(
        "[MMT Extension] Message received from invalid page:",
        senderUrl
      );

      sendResponse({
        ok: false,
        error: "Message received from invalid page"
      });

      return;
    }

    const itineraryData = {
      itineraryId: message.itineraryId,
      pageUrl: message.pageUrl,
      capturedAt: message.capturedAt
    };

    (async () => {
      await chrome.storage.local.set({
        lastItinerary: itineraryData
      });

      if (chrome.runtime.lastError) {
        console.error(
          "[MMT Extension] Storage error:",
          chrome.runtime.lastError.message
        );

        const storageResult = {
          ok: false,
          error: chrome.runtime.lastError.message
        };

        await chrome.storage.local.set({
          lastBackendAttempt: {
            itineraryId: itineraryData.itineraryId,
            attemptedAt: new Date().toISOString(),
            endpoint: BACKEND_ENDPOINT,
            result: storageResult
          }
        });

        sendResponse(storageResult);
        return;
      }

      const backendResult =
        await sendItineraryToBackend(itineraryData);

      await chrome.storage.local.set({
        lastBackendAttempt: {
          itineraryId: itineraryData.itineraryId,
          attemptedAt: new Date().toISOString(),
          endpoint: BACKEND_ENDPOINT,
          result: backendResult
        }
      });

      console.log(
        "[MMT Extension] Itinerary saved:",
        itineraryData
      );

      sendResponse(backendResult);
    })().catch(async (error) => {
      const unexpectedResult = {
        ok: false,
        error: String(error)
      };

      console.error(
        "[MMT Extension] Unexpected background error:",
        error
      );

      await chrome.storage.local.set({
        lastBackendAttempt: {
          itineraryId: itineraryData.itineraryId,
          attemptedAt: new Date().toISOString(),
          endpoint: BACKEND_ENDPOINT,
          result: unexpectedResult
        }
      });

      sendResponse(unexpectedResult);
    });

    return true;
  }
);
