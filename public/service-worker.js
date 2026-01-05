// ============================================
// EBTracker Service Worker - FULL FEATURED
// Version: 5.0.0 - Cache Version 35 (COO Time Request Allocation Fix)
// ============================================

const CACHE_NAME = 'ebtracker-v35';
const STATIC_CACHE = 'ebtracker-static-v35';
const DYNAMIC_CACHE = 'ebtracker-dynamic-v35';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// URLs to always fetch from network (never cache)
const NETWORK_ONLY = [
  '/api/',
  'render.com',
  'firebase',
  'firestore',
  'googleapis.com'
];

// ==============================
// INSTALL EVENT
// ==============================
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker v35: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Service Worker v35: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker v35: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker v35: Cache failed', error);
      })
  );
});

// ==============================
// ACTIVATE EVENT
// ==============================
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker v35: Activating...');
  
  // List of valid cache names to keep
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete any cache that's not in our valid list
            if (!validCaches.includes(cacheName)) {
              console.log('🗑️ Service Worker v35: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker v35: Activated - Old caches cleared');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients that cache has been updated
        return self.clients.matchAll({ type: 'window' });
      })
      .then((clients) => {
        console.log('📢 Service Worker v35: Notifying clients to refresh');
        clients.forEach(client => {
          client.postMessage({ 
            type: 'CACHE_UPDATED',
            version: 'v35',
            message: 'New version available with COO Time Request Allocation Fix! Please refresh.'
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
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #1f2937;
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }
        p {
          color: #6b7280;
          margin-bottom: 2rem;
          line-height: 1.6;
        }
        .retry-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .retry-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .retry-btn:active {
          transform: translateY(0);
        }
        .status-info {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #f3f4f6;
          border-radius: 10px;
          font-size: 0.85rem;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again. EBTracker requires an active connection to sync your data.</p>
        <button class="retry-btn" onclick="window.location.reload()">🔄 Try Again</button>
        <div class="status-info">
          <strong>Tip:</strong> Your data is safe! Any unsaved changes will sync when you're back online.
        </div>
      </div>
      <script>
        // Auto-retry when connection is restored
        window.addEventListener('online', () => {
          window.location.reload();
        });
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
  console.log('📬 Push notification received');
  
  let data = {
    title: 'EBTracker',
    body: 'New notification from EBTracker',
    icon: '/icons/icon-192x192.png',
    url: '/'
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'ebtracker-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked');
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed');
});

// ==============================
// MESSAGE HANDLER
// ==============================
self.addEventListener('message', (event) => {
  console.log('📨 Message received:', event.data);
  
  if (!event.data) return;
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      console.log('⏭️ Skip waiting requested');
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: 'v35', cache: CACHE_NAME });
      break;
      
    case 'CLEAR_CACHE':
      console.log('🗑️ Clear cache requested');
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'CACHE_URLS':
      if (event.data.urls && Array.isArray(event.data.urls)) {
        caches.open(DYNAMIC_CACHE).then(cache => {
          cache.addAll(event.data.urls);
        });
      }
      break;
      
    default:
      console.log('Unknown message type:', event.data.type);
  }
});

// ==============================
// PERIODIC BACKGROUND SYNC (if supported)
// ==============================
self.addEventListener('periodicsync', (event) => {
  console.log('🔄 Periodic sync:', event.tag);
  
  if (event.tag === 'update-cache') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
    );
  }
});

// ==============================
// BACKGROUND SYNC (for offline actions)
// ==============================
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'sync-announcements') {
    event.waitUntil(syncAnnouncements());
  }
  
  if (event.tag === 'sync-leave-requests') {
    event.waitUntil(syncLeaveRequests());
  }
});

// Sync announcements when back online
async function syncAnnouncements() {
  console.log('📢 Syncing announcements...');
  return Promise.resolve();
}

// Sync leave requests when back online
async function syncLeaveRequests() {
  console.log('🏖️ Syncing leave requests...');
  return Promise.resolve();
}

// ==============================
// ERROR HANDLING
// ==============================
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled Promise Rejection:', event.reason);
});

console.log('✅ Service Worker v35: Loaded successfully - COO Time Request Allocation Fix enabled');
