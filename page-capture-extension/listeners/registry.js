import { MMT_PACKAGE_ITINERARY_LISTENER } from './mmt-package-itinerary-listener.js';
import { MMT_DIY_PLANNER_LISTENER } from './mmt-diy-planner-listener.js';

/** Tab URL listeners (chrome.tabs.onUpdated). DIY planner uses content_scripts instead. */
const TAB_LISTENERS = [MMT_PACKAGE_ITINERARY_LISTENER];

const ALL_LISTENERS = [MMT_PACKAGE_ITINERARY_LISTENER, MMT_DIY_PLANNER_LISTENER];

export function findListenerForUrl(url) {
  return TAB_LISTENERS.find((listener) => listener.matches(url));
}

export function getListenerById(id) {
  return ALL_LISTENERS.find((listener) => listener.id === id);
}

export function getAllListeners() {
  return ALL_LISTENERS.slice();
}
