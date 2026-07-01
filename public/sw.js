/* Tomifoci 2026 — service worker (PWA shell + web-push).
 *
 * Strategy:
 *   - App shell / static assets: cache-first (offline shell), with a network
 *     refresh in the background for navigations.
 *   - /api/*: network-first, no caching (always fresh game state).
 *   - push: showNotification from the payload.
 *   - notificationclick: focus an open app tab or open /meccsek.
 *
 * Bump CACHE_VERSION on every deploy. The 'activate' handler deletes every
 * cache whose name != current, so phones drop stale files automatically.
 */

const CACHE_VERSION = '2026-07-01'
const CACHE = 'tomifoci-' + CACHE_VERSION

// Core shell assets. allSettled-style add so one 404 never fails install.
const ASSETS = ['/', '/meccsek', '/favicon.svg', '/logo.png', '/manifest.webmanifest']

const ICON = '/logo.png'
const APP_PATH = '/meccsek'

// ── Install: pre-cache the shell, take over immediately ──────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: drop every old cache ───────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // pass cross-origin through

  // API: network-first, never cached. Don't intercept the failure path — /api/
  // responses are never cache.put here, so caches.match(req) always resolves
  // undefined, which turns a normal transient network error into a broken
  // respondWith(undefined) and a scarier failure on the page than what actually
  // happened. Let fetch()'s own rejection propagate untouched.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req))
    return
  }

  // Navigations: serve cached shell instantly, refresh in background.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((resp) => {
            if (resp && resp.ok) {
              const clone = resp.clone()
              caches.open(CACHE).then((c) => c.put(req, clone))
            }
            return resp
          })
          .catch(() => cached || caches.match(APP_PATH) || caches.match('/'))
        return cached || network
      })
    )
    return
  }

  // Static assets: cache-first, populate on miss.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return resp
        })
        .catch(() => cached)
    })
  )
})

// ── Push: server-sent notifications ──────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Tomifoci 2026', body: 'Friss értesítés!' }
  try {
    if (event.data) data = event.data.json() || data
  } catch (_) {
    try {
      if (event.data) data = { title: 'Tomifoci 2026', body: event.data.text() }
    } catch (_e) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tomifoci 2026', {
      body: data.body || '',
      icon: ICON,
      badge: ICON,
      vibrate: [200, 100, 200],
      tag: data.tag || 'tomifoci',
      data: data,
      actions: data.actions || []
    })
  )
})

// ── Notification click: focus or open the app ────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || APP_PATH
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        const u = new URL(client.url)
        if (u.origin === self.location.origin) return client.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})

// ── Message: allow the page to activate a waiting worker ─────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
