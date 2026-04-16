// ============================================
// EBTracker Service Worker - FULL FEATURED
// Version: 6.0.0 - Cache Version 50 (Fix broken JS cache)
// ============================================

const CACHE_NAME = 'ebtracker-v50';
const STATIC_CACHE = 'ebtracker-static-v50';
const DYNAMIC_CACHE = 'ebtracker-dynamic-v50';

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
  console.log('🔧 Service Worker v50: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE)
        .then((cache) => {
          console.log('📦 Service Worker v50: Caching static assets');
          return cache.addAll(STATIC_ASSETS);
        }),
      // Cache external scripts (Firebase SDK including Storage)
      caches.open(DYNAMIC_CACHE)
        .then((cache) => {
          console.log('📦 Service Worker v50: Caching Firebase SDK');
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
      console.log('✅ Service Worker v50: All assets cached');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('❌ Service Worker v50: Cache failed', error);
    })
  );
});

// ==============================
// ACTIVATE EVENT
// ==============================
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker v50: Activating...');
  
  // List of valid cache names to keep
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete any cache that's not in our valid list (including all v49 caches)
            if (!validCaches.includes(cacheName)) {
              console.log('🗑️ Service Worker v50: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker v50: Activated - Old caches cleared');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients that cache has been updated
        return self.clients.matchAll({ type: 'window' });
      })
      .then((clients) => {
        console.log('📢 Service Worker v50: Notifying clients to refresh');
        clients.forEach(client => {
          client.postMessage({ 
            type: 'CACHE_UPDATED',
            version: 'v50',
            message: 'App restored! Fixed JS loaded. Please refresh.'
          });
        });
      })
  );
});

// ==============================
// FETCH EVENT - Network First with Cache Fallback
// ==============================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests (POST, PUT, DELETE should always go to network)
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip blob URLs (used for file downloads)
  if (url.protocol === 'blob:') {
    return;
  }
  
  // Check if this URL should always go to network
  const shouldSkipCache = NETWORK_ONLY.some(pattern => 
    url.href.includes(pattern) || url.pathname.includes(pattern)
  );
  
  // Skip API calls and Firebase - always go to network
  if (shouldSkipCache) {
    event.respondWith(
      fetch(request)
        .catch((error) => {
          console.warn('⚠️ Network request failed:', url.href, error);
          return new Response(
            JSON.stringify({ 
              error: 'Offline', 
              message: 'You are offline. Please check your connection.',
              offline: true
            }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        })
    );
    return;
  }
  
  // For static assets - Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // For HTML pages - Network First with Cache Fallback
  event.respondWith(networkFirst(request));
});

// ==============================
// CACHING STRATEGIES
// ==============================

// Cache First Strategy (for static assets)
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Return cached version immediately
      // Also fetch new version in background to update cache
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

// Network First Strategy (for dynamic content)
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
    if (cachedResponse) {
      return cachedResponse;
    }
    return offlineFallback();
  }
}

// Background fetch and cache update
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    // Silently fail - we already returned cached version
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', 
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp'
  ];
  return staticExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
}

// Offline fallback response
function offlineFallback() {
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>EBTracker - Offline</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .offline-container {
          background: white;
          border-radius: 20px;
          padding: 3rem;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #1f2937; margin-bottom: 1rem; font-size: 1.5rem; }
        p { color: #6b7280; margin-bottom: 2rem; line-height: 1.6; }
        .retry-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
        <button class="retry-btn" onclick="window.location.reload()">🔄 Try Again</button>
      </div>
      <script>
        window.addEventListener('online', () => { window.location.reload(); });
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// ==============================
// PUSH NOTIFICATIONS
// ==============================
self.addEventListener('push', (event) => {
  let data = {
    title: 'EBTracker',
    body: 'New notification from EBTracker',
    icon: '/icons/icon-192x192.png',
    url: '/'
  };
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

// ==============================
// MESSAGE HANDLER
// ==============================
self.addEventListener('message', (event) => {
  if (!event.data) return;
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: 'v50', cache: CACHE_NAME });
      break;
    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).then(() => { event.ports[0]?.postMessage({ success: true }); });
      break;
    case 'FORCE_REFRESH':
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(() => { event.ports[0]?.postMessage({ success: true, message: 'All caches cleared' }); });
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

console.log('✅ Service Worker v50: Loaded - app restored with correct JS files');