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
  let title = 'Lakky Variety Store';
  let body = 'You have an update';
  let url = '/admin';
  try {
    const d = e.data ? e.data.json() : null;
    if (d) {
      if (d.title) title = d.title;
      if (d.body) body = d.body;
      if (d.url) url = d.url;
    } else if (e.data) {
      body = e.data.text();
    }
  } catch { if (e.data) body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin';
  e.waitUntil(clients.openWindow(url));
});
