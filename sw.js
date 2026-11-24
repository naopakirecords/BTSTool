// Minimal service worker so browsers offer "Install app".
// It deliberately caches nothing – the app always loads the latest version from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
