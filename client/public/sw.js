/**
 * GritIQ Service Worker
 *
 * Strategy:
 *  - Static assets (JS/CSS/fonts/icons)  → Cache-First  (CACHE_NAME)
 *  - Navigation requests (HTML)           → Cache-First with network fallback → offline.html
 *  - API GET requests                     → Network-First (stale-while-revalidate)
 *  - API POST/PATCH (workout writes)      → Background-Sync queue (SYNC_QUEUE)
 *  - Font CDN requests                    → Cache-First (FONT_CACHE)
 */

const VERSION        = 'v3';
const CACHE_NAME     = `gritiq-static-${VERSION}`;
// PERF-P3: Font cache is version-independent — fonts are binary-immutable files.
// Using a fixed key means fonts survive SW updates without re-downloading.
// When font files actually change (rare), bump FONT_CACHE_VERSION manually.
const FONT_CACHE     = 'gritiq-fonts-permanent-v1';
const API_CACHE      = `gritiq-api-${VERSION}`;
const SYNC_QUEUE     = 'gritiq-workout-sync';
const OFFLINE_URL    = './offline.html';

// Assets to pre-cache at install time (shell)
// We include the offline page so it's always available
const PRECACHE_URLS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// Critical API routes to warm into API cache on SW activate
// These power the offline Dashboard and Workout Tracker
const WARM_API_URLS = [
  '/api/user',
  '/api/sessions',
  '/api/exercises',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            // PERF-P3: Keep the permanent font cache across SW version bumps.
            .filter((k) => k !== CACHE_NAME && k !== FONT_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => warmApiCache())
  );
});

// Pre-warm critical API endpoints so Dashboard & Workout Tracker
// have stale data to show immediately when the device goes offline.
async function warmApiCache() {
  const cache = await caches.open(API_CACHE);
  await Promise.allSettled(
    WARM_API_URLS.map(async (url) => {
      try {
        const res = await fetch(url);
        // Only cache successful authenticated responses
        if (res.ok) {
          await cache.put(url, res);
        }
      } catch {
        // Not online or not logged in — skip silently
      }
    })
  );
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET API mutations — they go through background sync
  if (
    url.pathname.startsWith('/api/') &&
    (request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE')
  ) {
    event.respondWith(handleMutation(request.clone()));
    return;
  }

  // API GETs — network-first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // Font CDN — cache-first
  if (url.hostname === 'api.fontshare.com') {
    event.respondWith(cacheFirstFont(request));
    return;
  }

  // Static assets with a hash in filename (Vite) — cache-first, long TTL
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/')  ||
    url.pathname.endsWith('.js')   ||
    url.pathname.endsWith('.css')  ||
    url.pathname.endsWith('.woff2')||
    url.pathname.endsWith('.png')  ||
    url.pathname.endsWith('.svg')  ||
    url.pathname.endsWith('.ico')  ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // Navigation (HTML) — cache-first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Default — network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_QUEUE) {
    event.waitUntil(drainSyncQueue());
  }
});

// ── Strategy helpers ──────────────────────────────────────────────────────────

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — asset not cached', { status: 503 });
  }
}

async function cacheFirstFont(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(FONT_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fonts are decorative — fail gracefully
    return new Response('', { status: 503 });
  }
}

async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}

// ── Mutation handler with background-sync queue ───────────────────────────────

async function handleMutation(request) {
  // Clone body before attempting fetch (body can only be read once)
  const bodyText = await request.text();

  try {
    // Optimistically try the network first
    const response = await fetch(
      new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bodyText,
      })
    );
    return response;
  } catch {
    // Network unavailable — queue for background sync
    await enqueueRequest(request.url, request.method, request.headers, bodyText);

    // Register sync tag if Background Sync API is available
    // AND-12: Guard against self.registration.sync being undefined on
    // Android WebView < 49 and Huawei devices without GMS
    if ('SyncManager' in self && self.registration.sync) {
      // Tag registration happens from clients, but we can attempt from SW too
      try {
        await self.registration.sync.register(SYNC_QUEUE);
      } catch (_) { /* not always available from SW context */ }
    }

    // Return an optimistic 202 so the UI doesn't show an error
    return new Response(
      JSON.stringify({ queued: true, offline: true }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ── Sync queue stored in Cache Storage (no IndexedDB needed) ─────────────────
const QUEUE_CACHE = 'gritiq-sync-queue';

async function enqueueRequest(url, method, headers, body) {
  const cache = await caches.open(QUEUE_CACHE);
  const entry = {
    url,
    method,
    // Serialize headers (Headers object isn't JSON-serializable)
    headers: Object.fromEntries(
      [...headers.entries()].filter(([k]) => k.toLowerCase() !== 'content-length')
    ),
    body,
    timestamp: Date.now(),
  };
  // Use a timestamp-based key so multiple queued items coexist
  await cache.put(
    new Request(`/queued-sync/${Date.now()}`),
    new Response(JSON.stringify(entry), { headers: { 'Content-Type': 'application/json' } })
  );
}

async function drainSyncQueue() {
  const cache = await caches.open(QUEUE_CACHE);
  const keys = await cache.keys();

  for (const key of keys) {
    const res = await cache.match(key);
    if (!res) continue;
    let entry;
    try {
      entry = await res.json();
    } catch {
      await cache.delete(key);
      continue;
    }

    try {
      const response = await fetch(
        new Request(entry.url, {
          method: entry.method,
          headers: entry.headers,
          body: entry.body,
        })
      );
      if (response.ok || response.status < 500) {
        // Successfully replayed or server rejected it (e.g. 400) — remove either way
        await cache.delete(key);
        // Notify all open clients to refresh their data
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((c) =>
          c.postMessage({ type: 'SYNC_COMPLETE', url: entry.url })
        );
      }
      // If 5xx, keep in queue and retry next sync
    } catch {
      // Still offline — leave in queue
    }
  }
}

// ── Message handler (SKIP_WAITING for update flow) ─────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push Notifications (stub — extend later) ──────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'GritIQ', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
    })
  );
});
