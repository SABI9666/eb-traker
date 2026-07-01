// ============================================
// West EPCM Technologies Service Worker
// Version: 6.0.7 - Cache Version 61
//   - Accounts variation upload feature
//   - Patch scripts are now NETWORK_ONLY so they bypass the SW cache
//     and always reflect the latest deploy without needing a SW bump.
//   - The SW itself is not cached (browser handles SW updates).
// ============================================

const CACHE_NAME = 'ebtracker-v67';
const STATIC_CACHE = 'ebtracker-static-v67';
const DYNAMIC_CACHE = 'ebtracker-dynamic-v67';

const STATIC_ASSETS = [
  '/', '/index.html', '/app1.js', '/app2.js',
  '/candidate-screening.html', '/manifest.json',
  '/icons/icon-192x192.png', '/icons/icon-512x512.png'
];

const EXTERNAL_SCRIPTS = [
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-storage-compat.js'
];

// Always fetch these from the network (never cache).
// `*-patch.js` covers bdm-po-patch.js, account-variation-patch.js,
// timesheet-*-patch.js, bdm-quote-sync-patch.js etc. — future patches will
// pick up new deploys immediately without needing a SW cache bump.
const NETWORK_ONLY = [
  '/api/', 'render.com', 'firebase', 'firestore',
  'googleapis.com', 'firebasestorage.googleapis.com',
  '-patch.js', 'account-variation', 'service-worker.js'
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker v61: Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(DYNAMIC_CACHE).then((cache) =>
        Promise.all(EXTERNAL_SCRIPTS.map(url => cache.add(url).catch(() => {}))))
    ])
    .then(() => self.skipWaiting())
    .catch((error) => console.error('❌ Service Worker v61: Cache failed', error))
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker v61: Activating...');
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCaches.includes(cacheName)) {
            console.log('🗑️ Service Worker v61: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_UPDATED',
            version: 'v61',
            message: 'Accounts variation upload (BDM, value, file). Patch scripts now bypass cache.'
          });
        });
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.protocol === 'blob:') return;
  const shouldSkipCache = NETWORK_ONLY.some(pattern =>
    url.href.includes(pattern) || url.pathname.includes(pattern));
  if (shouldSkipCache) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (isStaticAsset(url.pathname)) { event.respondWith(cacheFirst(request)); return; }
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) { fetchAndCache(request); return cachedResponse; }
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) { return offlineFallback(); }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return offlineFallback();
  }
}

async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {}
}

function isStaticAsset(pathname) {
  const exts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp'];
  return exts.some(ext => pathname.toLowerCase().endsWith(ext));
}

function offlineFallback() {
  return new Response('<!DOCTYPE html><html><body><h1>Offline</h1></body></html>',
    { headers: { 'Content-Type': 'text/html' } });
}

self.addEventListener('push', (event) => {
  let data = { title: 'West EPCM Technologies', body: 'New notification', icon: '/icons/icon-192x192.png', url: '/' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: data.icon, badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100], tag: data.tag || 'ebtracker-notification',
    renotify: true, data: { url: data.url || '/', timestamp: Date.now() }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen); return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    }));
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  switch (event.data.type) {
    case 'SKIP_WAITING': self.skipWaiting(); break;
    case 'GET_VERSION': event.ports[0]?.postMessage({ version: 'v61', cache: CACHE_NAME }); break;
    case 'CLEAR_CACHE':
      caches.keys().then(names => { names.forEach(name => caches.delete(name)); })
        .then(() => { event.ports[0]?.postMessage({ success: true }); }); break;
    case 'FORCE_REFRESH':
      caches.keys().then(names => Promise.all(names.map(name => caches.delete(name))))
        .then(() => { event.ports[0]?.postMessage({ success: true }); }); break;
  }
});

self.addEventListener('sync', (event) => {
  const syncMap = {
    'sync-announcements': 'SYNC_ANNOUNCEMENTS',
    'sync-leave-requests': 'SYNC_LEAVE_REQUESTS',
    'sync-screening-data': 'SYNC_SCREENING',
    'sync-design-files': 'SYNC_DESIGN_FILES',
    'sync-timesheets': 'SYNC_TIMESHEETS'
  };
  if (syncMap[event.tag]) {
    event.waitUntil(self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: syncMap[event.tag], timestamp: Date.now() }));
    }));
  }
});

self.addEventListener('error', (event) => { console.error('❌ SW Error:', event.error); });
self.addEventListener('unhandledrejection', (event) => { console.error('❌ SW Unhandled:', event.reason); });

console.log('✅ Service Worker v61: Loaded - Accounts variation upload, patch scripts bypass cache');
