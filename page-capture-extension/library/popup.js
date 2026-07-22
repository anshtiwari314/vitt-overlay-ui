const itineraryIdElement =
  document.getElementById("itineraryId");
const capturedAtElement =
  document.getElementById("capturedAt");
const backendStatusElement =
  document.getElementById("backendStatus");
const copyButton =
  document.getElementById("copyButton");
const openPageLink =
  document.getElementById("openPageLink");

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function setEmptyState() {
  itineraryIdElement.textContent =
    "No itinerary captured yet.";
  itineraryIdElement.classList.add("empty");
  capturedAtElement.textContent = "Captured: -";
  backendStatusElement.textContent = "Backend: -";
  copyButton.disabled = true;
  openPageLink.href = "#";
  openPageLink.setAttribute("aria-disabled", "true");
  openPageLink.style.pointerEvents = "none";
  openPageLink.style.opacity = "0.6";
}

function setPopulatedState(itinerary) {
  itineraryIdElement.textContent =
    itinerary.itineraryId;
  itineraryIdElement.classList.remove("empty");
  capturedAtElement.textContent =
    `Captured: ${formatTimestamp(itinerary.capturedAt)}`;
  copyButton.disabled = false;

  if (typeof itinerary.pageUrl === "string" &&
      itinerary.pageUrl.trim() !== "") {
    openPageLink.href = itinerary.pageUrl;
    openPageLink.setAttribute("aria-disabled", "false");
    openPageLink.style.pointerEvents = "auto";
    openPageLink.style.opacity = "1";
  } else {
    openPageLink.href = "#";
    openPageLink.setAttribute("aria-disabled", "true");
    openPageLink.style.pointerEvents = "none";
    openPageLink.style.opacity = "0.6";
  }
}

function formatBackendStatus(lastBackendAttempt) {
  if (!lastBackendAttempt || !lastBackendAttempt.result) {
    return "Backend: -";
  }

  if (lastBackendAttempt.result.ok) {
    return `Backend: Success (${lastBackendAttempt.endpoint})`;
  }

  const errorText =
    lastBackendAttempt.result.error ||
    lastBackendAttempt.result.responseText ||
    lastBackendAttempt.result.statusText ||
    "Unknown error";

  return `Backend: Failed - ${errorText}`;
}

function loadLastItinerary() {
  chrome.storage.local.get(
    ["lastItinerary", "lastBackendAttempt"],
    ({ lastItinerary, lastBackendAttempt }) => {
      if (chrome.runtime.lastError) {
        itineraryIdElement.textContent =
          chrome.runtime.lastError.message;
        itineraryIdElement.classList.add("empty");
        backendStatusElement.textContent =
          `Backend: ${chrome.runtime.lastError.message}`;
        copyButton.disabled = true;
        return;
      }

      if (
        !lastItinerary ||
        typeof lastItinerary.itineraryId !== "string" ||
        lastItinerary.itineraryId.trim() === ""
      ) {
        setEmptyState();
        return;
      }

      setPopulatedState(lastItinerary);
      backendStatusElement.textContent =
        formatBackendStatus(lastBackendAttempt);
    }
  );
}

copyButton.addEventListener("click", async () => {
  const itineraryId = itineraryIdElement.textContent;

  if (!itineraryId || copyButton.disabled) {
    return;
  }

  try {
    await navigator.clipboard.writeText(itineraryId);
    copyButton.textContent = "Copied";

    window.setTimeout(() => {
      copyButton.textContent = "Copy ID";
    }, 1400);
  } catch (error) {
    copyButton.textContent = "Copy failed";

    window.setTimeout(() => {
      copyButton.textContent = "Copy ID";
    }, 1400);
  }
});

loadLastItinerary();
