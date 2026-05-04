// ============================================
// EBTracker Service Worker - FULL FEATURED
// Version: 6.0.4 - Cache Version 58 (BDM Analytics charts: empty-state + smart default period)
// ============================================

const CACHE_NAME = 'ebtracker-v58';
const STATIC_CACHE = 'ebtracker-static-v58';
const DYNAMIC_CACHE = 'ebtracker-dynamic-v58';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app1.js',
  '/app2.js',
  '/candidate-screening.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// External scripts to cache
const EXTERNAL_SCRIPTS = [
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.0.0/firebase-storage-compat.js'
];

// URLs to always fetch from network (never cache)
const NETWORK_ONLY = [
  '/api/',
  'render.com',
  'firebase',
  'firestore',
  'googleapis.com',
  'firebasestorage.googleapis.com'
];

// ==============================
// INSTALL EVENT
// ==============================
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker v58: Installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE)
        .then((cache) => {
          console.log('📦 Service Worker v58: Caching static assets');
          return cache.addAll(STATIC_ASSETS);
        }),
      caches.open(DYNAMIC_CACHE)
        .then((cache) => {
          console.log('📦 Service Worker v58: Caching Firebase SDK');
          return Promise.all(
            EXTERNAL_SCRIPTS.map(url => 
              cache.add(url).catch(err => {
                console.warn('⚠️ Failed to cache:', url, err);
              })
            )
          );
        })
    ])
    .then(() => {
      console.log('✅ Service Worker v58: All assets cached');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('❌ Service Worker v58: Cache failed', error);
    })
  );
});

// ==============================
// ACTIVATE EVENT
// ==============================
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker v58: Activating...');
  
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!validCaches.includes(cacheName)) {
              console.log('🗑️ Service Worker v58: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker v58: Activated - Old caches cleared');
        return self.clients.claim();
      })
      .then(() => {
        return self.clients.matchAll({ type: 'window' });
      })
      .then((clients) => {
        console.log('📢 Service Worker v58: Notifying clients to refresh');
        clients.forEach(client => {
          client.postMessage({ 
            type: 'CACHE_UPDATED',
            version: 'v58',
            message: 'BDM analytics charts: empty-state + smart default period.'
          });
        });
      })
  );
});

// ==============================
// FETCH EVENT
// ==============================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.protocol === 'blob:') return;
  const shouldSkipCache = NETWORK_ONLY.some(pattern => 
    url.href.includes(pattern) || url.pathname.includes(pattern)
  );
  if (shouldSkipCache) {
    event.respondWith(
      fetch(request).catch((error) => {
        console.warn('⚠️ Network request failed:', url.href, error);
        return new Response(
          JSON.stringify({ error: 'Offline', message: 'You are offline. Please check your connection.', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      fetchAndCache(request);
      return cachedResponse;
    }
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Cache first failed for:', request.url);
    return offlineFallback();
  }
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
    console.warn('⚠️ Network first failed, trying cache:', request.url);
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
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp'];
  return staticExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
}

function offlineFallback() {
  return new Response('<!DOCTYPE html><html><body><h1>Offline</h1><p>Please reconnect.</p></body></html>', {
    headers: { 'Content-Type': 'text/html' }
  });
}

self.addEventListener('push', (event) => {
  let data = { title: 'EBTracker', body: 'New notification from EBTracker', icon: '/icons/icon-192x192.png', url: '/' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      tag: data.tag || 'ebtracker-notification',
      renotify: true,
      data: { url: data.url || '/', timestamp: Date.now() }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: 'v58', cache: CACHE_NAME });
      break;
    case 'CLEAR_CACHE':
      caches.keys().then(names => { names.forEach(name => caches.delete(name)); })
        .then(() => { event.ports[0]?.postMessage({ success: true }); });
      break;
    case 'FORCE_REFRESH':
      caches.keys().then(names => Promise.all(names.map(name => caches.delete(name))))
        .then(() => { event.ports[0]?.postMessage({ success: true, message: 'All caches cleared' }); });
      break;
    default:
      console.log('Unknown message type:', event.data.type);
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
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: syncMap[event.tag], timestamp: Date.now() }));
      })
    );
  }
});

self.addEventListener('error', (event) => { console.error('❌ SW Error:', event.error); });
self.addEventListener('unhandledrejection', (event) => { console.error('❌ SW Unhandled:', event.reason); });

console.log('✅ Service Worker v58: Loaded - empty-state + smart default for BDM analytics charts');
