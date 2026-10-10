// Lakky PWA shell: cache the shop shell + images, serve offline where possible.
// Push arrives with the PWA step keys (see docs; VAPID setup is a later version).
const CACHE = 'lakky-v1';
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/')))
  );
});
self.addEventListener('push', (e) => {
  const text = e.data ? e.data.text() : 'Lakky Variety Store update';
  e.waitUntil(self.registration.showNotification('Lakky Variety Store', { body: text }));
});
