import { MMT_PACKAGE_ITINERARY_LISTENER } from './mmt-package-itinerary-listener.js';

const LISTENERS = [MMT_PACKAGE_ITINERARY_LISTENER];

export function findListenerForUrl(url) {  return LISTENERS.find((listener) => listener.matches(url));
}

export function getListenerById(id) {
  return LISTENERS.find((listener) => listener.id === id);
}

export function getAllListeners() {
  return LISTENERS.slice();
}
