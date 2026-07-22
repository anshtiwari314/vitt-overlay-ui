let lastCapturedItineraryId = null;

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.origin !== window.location.origin) {
    return;
  }

  const message = event.data;

  if (
    message?.source !== "MMT_ITINERARY_INTERCEPTOR" ||
    message?.type !== "ITINERARY_ID_CAPTURED"
  ) {
    return;
  }

  const itineraryId = message.itineraryId;

  if (
    typeof itineraryId !== "string" ||
    itineraryId.trim() === ""
  ) {
    console.warn(
      "[MMT Extension] Invalid itinerary ID ignored:",
      itineraryId
    );

    return;
  }

  // Duplicate response ko dobara process nahi karenge.
  if (itineraryId === lastCapturedItineraryId) {
    return;
  }

  lastCapturedItineraryId = itineraryId;

  console.log(
    "%c[MMT Extension] Itinerary ID captured:",
    "font-weight: bold; color: green;",
    itineraryId
  );

  chrome.runtime.sendMessage({
    type: "SAVE_ITINERARY_ID",
    itineraryId,
    pageUrl: window.location.href,
    capturedAt: new Date().toISOString()
  });
});
