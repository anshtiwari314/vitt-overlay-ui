import { MMT_DIY_PLANNER_LISTENER, buildBridgePayload } from './mmt-diy-planner-listener.js';

/** @type {{
 *   ensureBridgeConnected: () => Promise<void>,
 *   sendBridgeEvent: (payload: object) => Promise<{ ok?: boolean } | undefined>,
 *   devLog: (tag: string, detail?: object) => void
 * } | null} */
let api = null;

export function initDiyPlannerHandler(deps) {
  api = deps;
}

export function handleSaveItineraryId(msg, sender, sendResponse) {
  if (msg?.type !== 'SAVE_ITINERARY_ID' || !api) {
    return false;
  }

  const senderUrl = sender.tab?.url || msg.pageUrl || '';

  if (!MMT_DIY_PLANNER_LISTENER.matches(senderUrl)) {
    api.devLog('diy_planner_rejected', { senderUrl: senderUrl.slice(0, 120) });
    sendResponse({ ok: false, error: 'Message received from invalid page' });
    return true;
  }

  const itineraryData = {
    itineraryId: msg.itineraryId,
    pageUrl: msg.pageUrl || senderUrl,
    capturedAt: msg.capturedAt || new Date().toISOString()
  };

  void (async () => {
    try {
      await chrome.storage.local.set({ lastItinerary: itineraryData });

      api.devLog('diy_planner_itinerary_captured', {
        itineraryId: itineraryData.itineraryId,
        pageUrl: itineraryData.pageUrl.slice(0, 120)
      });

      await api.ensureBridgeConnected();
      const bridgePayload = buildBridgePayload(itineraryData);
      const bridgeResult = (await api.sendBridgeEvent(bridgePayload)) || { ok: false };

      await chrome.storage.local.set({
        lastItineraryBridgeAttempt: {
          itineraryId: itineraryData.itineraryId,
          attemptedAt: new Date().toISOString(),
          jobId: bridgePayload.jobId,
          result: bridgeResult
        }
      });

      api.devLog('diy_planner_bridge_sent', {
        jobId: bridgePayload.jobId,
        ok: Boolean(bridgeResult?.ok)
      });

      sendResponse({ ok: Boolean(bridgeResult?.ok), bridge: bridgeResult });
    } catch (error) {
      const unexpectedResult = { ok: false, error: error?.message || String(error) };
      api.devLog('diy_planner_error', unexpectedResult);

      await chrome.storage.local.set({
        lastItineraryBridgeAttempt: {
          itineraryId: itineraryData.itineraryId,
          attemptedAt: new Date().toISOString(),
          result: unexpectedResult
        }
      });

      sendResponse(unexpectedResult);
    }
  })();

  return true;
}
