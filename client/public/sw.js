const CACHE = 'chessorg-v3';
const API_CACHE = 'chessorg-api-v2';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg'];
const AUTH_API_PREFIXES = ['/auth/', '/tournaments/', '/players/', '/rounds/', '/pairings/', '/arbiters/', '/stats/', '/membership/', '/notifications/', '/fide/', '/validation/', '/teams/', '/stripe/', '/import/', '/api-keys/', '/webhooks/', '/api/'];
const PUBLIC_API_PREFIXES = ['/public/', '/health'];

function isApiRequest(url) {
  const path = url.pathname;
  if (PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))) return 'public';
  if (AUTH_API_PREFIXES.some((p) => path.startsWith(p))) return 'auth';
  return false;
}

function shouldCache(method, url) {
  // Only cache GET requests
  if (method !== 'GET') return false;
  const api = isApiRequest(url);
  if (api === 'public' || api === 'auth') return true;
  return false;
}

// ===== INSTALL =====
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((ks) =>
        Promise.all(ks.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-queue') {
    e.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  try {
    // Notify all clients to trigger syncQueue()
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_QUEUE' });
    });
  } catch {
    // Silently fail, will retry on next sync event
  }
}

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (e) => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/icon.svg',
      badge: '/icon.svg',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      actions: data.actions || [],
    };
    e.waitUntil(
      self.registration.showNotification(data.title || 'Chess Organizers Pro', options)
    );
  } catch {
    // Invalid push payload
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.notification.data?.url) {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === e.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(e.notification.data.url);
        }
      })
    );
  }
});

// ===== FETCH =====
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const api = isApiRequest(url);
  const isShell = e.request.mode === 'navigate' || SHELL.includes(url.pathname) || url.pathname.startsWith('/assets/');

  // API requests
  if (api && e.request.method === 'GET') {
    e.respondWith(networkFirst(e.request, api === 'auth' ? API_CACHE : API_CACHE));
    return;
  }

  // Mutation requests (POST/PATCH/DELETE) - try network, fallback to offline queue
  if (api && e.request.method !== 'GET') {
    e.respondWith(mutationHandler(e.request));
    return;
  }

  // Shell/assets
  if (isShell) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // Default: network only
  e.respondWith(fetch(e.request));
});

// ===== STRATEGIES =====

async function cacheFirst(req) {
  const cached = await caches.match(req);
  return cached || fetchAndCache(req, CACHE);
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetchAndCache(req, cacheName);
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // For auth API, return a generic offline response
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'Sin conexión. Datos no disponibles en caché.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function mutationHandler(req) {
  try {
    const res = await fetch(req.clone());
    return res;
  } catch {
    // Queue the mutation and return a pending response
    const cloned = req.clone();
    const body = cloned.method !== 'GET' && cloned.method !== 'HEAD' ? await cloned.json().catch(() => null) : null;
    // Store in IndexedDB via message to client
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'QUEUE_MUTATION',
        payload: { method: req.method, path: req.url, body },
      });
    }
    return new Response(JSON.stringify({
      ok: true,
      queued: true,
      message: 'Operación encolada para cuando haya conexión.',
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function fetchAndCache(req, cacheName) {
  const res = await fetch(req);
  if (res.ok) {
    const clone = res.clone();
    caches.open(cacheName).then((c) => c.put(req, clone));
  }
  return res;
}

// ===== MESSAGE HANDLER =====
self.addEventListener('message', (e) => {
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.delete(CACHE);
    caches.delete(API_CACHE);
  }
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
