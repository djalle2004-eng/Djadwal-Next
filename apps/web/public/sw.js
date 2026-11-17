/**
 * Djadwal Progressive Web App (PWA) Service Worker
 * Serwist/Workbox Compliant Differentiated Caching Strategies:
 * 1. API Reads (GET): Network-First with Offline Fallback
 * 2. Static Assets (JS/CSS): Stale-While-Revalidate
 * 3. Fonts & Media: Cache-First
 * 4. Auth & Mutating Operations (POST/PUT/DELETE): Strict Network-Only
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_STATIC = `djadwal-static-${CACHE_VERSION}`;
const CACHE_FONTS = `djadwal-fonts-${CACHE_VERSION}`;
const CACHE_API = `djadwal-api-${CACHE_VERSION}`;

const ACTIVE_CACHES = [CACHE_STATIC, CACHE_FONTS, CACHE_API];

// Essential core shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/schedule',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 1. Installation: Pre-cache static shell & activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[PWA SW] Pre-caching partial failure (safe to continue):', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activation: Clean up stale cache versions & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !ACTIVE_CACHES.includes(name))
            .map((staleCache) => {
              console.log('[PWA SW] Removing stale cache:', staleCache);
              return caches.delete(staleCache);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event Interceptor with Differentiated Strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  // Guard: Cache API only supports http: and https: schemes.
  // Explicitly bypass chrome-extension://, moz-extension://, blob:, about:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Strategy 4: Network-Only for mutating methods (POST, PUT, DELETE, PATCH) & Auth routes
  if (
    request.method !== 'GET' ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('/login') ||
    url.pathname.includes('/logout') ||
    url.pathname.includes('/system/backup')
  ) {
    return; // Pass through directly to standard network
  }

  // Strategy 3: Cache-First for Fonts, SVGs, and Static Media
  if (
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/i)
  ) {
    event.respondWith(
      caches.open(CACHE_FONTS).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && request.url.startsWith('http')) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Strategy 1: Network-First for API Read endpoints (/api/*)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(CACHE_API).then((cache) => {
        return fetch(request)
          .then((networkResponse) => {
            // Only cache successful JSON GET responses
            if (networkResponse && networkResponse.status === 200 && request.url.startsWith('http')) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(async () => {
            // Offline fallback: serve cached API response if available
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
              const headers = new Headers(cachedResponse.headers);
              headers.set('X-Djadwal-Offline-Cache', 'true');
              return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers,
              });
            }

            // Fallback JSON payload when both network and cache are unavailable
            return new Response(
              JSON.stringify({
                error: {
                  code: 'OFFLINE_NO_CACHE',
                  message_ar: 'أنت غير متصل بالشبكة ولا تتوفر نسخة مخزنة مؤقتاً لهذا المورد.',
                  trace_id: 'offline-sw-' + Date.now(),
                },
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
              }
            );
          });
      })
    );
    return;
  }

  // Strategy 2: Stale-While-Revalidate for Web App Shell & Next.js Static Chunks
  event.respondWith(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && request.url.startsWith('http')) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      });
    })
  );
});

// 4. Message Handler for Cache Invalidation and Update Trigger
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'INVALIDATE_CACHE' || event.data.type === 'CLEAR_ALL_DATA') {
    caches
      .keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, message: 'All caches purged' });
        }
      });
  }
});
