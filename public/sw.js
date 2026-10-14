/* Litmus service worker.
   Two jobs: keep the app shell available offline, and turn Web Push
   messages into notifications. */

const CACHE = 'litmus-v3';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Android share sheet: the OS POSTs the shared spreadsheet here. Park it
  // in a cache, bounce to the app, and the app collects it on load.
  if (request.method === 'POST' && url.pathname === '/share-file') {
    event.respondWith(
      (async () => {
        try {
          const form = await request.formData();
          const file = form.get('sheet');
          if (file) {
            const cache = await caches.open('litmus-shared');
            await cache.put(
              '/__shared-file',
              new Response(file, {
                headers: {
                  'X-File-Name': file.name || 'shared.xlsx',
                  'Content-Type': file.type || 'application/octet-stream',
                },
              })
            );
          }
        } catch (err) {
          console.error('[sw] share intake failed', err);
        }
        return Response.redirect('/?shared=1', 303);
      })()
    );
    return;
  }

  if (request.method !== 'GET') return;
  // Never cache API traffic — Supabase responses must always be fresh.
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache first, then network.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
    )
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Litmus', body: 'You have something coming up.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'litmus',
      renotify: false,
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
