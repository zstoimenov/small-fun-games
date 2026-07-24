/* RETIRED — Game Box now uses a single service worker at the site root.        */
/*                                                                              */
/* Times Table Blaster used to ship its own worker. This stub exists only so    */
/* browsers that already installed the old one will replace it, clear its stale */
/* cache, and unregister — after which the root worker (../sw.js) takes over.   */
/* Safe to delete once every device has updated.                               */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("ttblaster")) await caches.delete(key);
    }
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
/* No fetch handler on purpose: requests fall through to the network (and to the */
/* root worker once this one has unregistered).                                  */
