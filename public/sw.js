// Minimal, safe service worker for Caption Fox PWA.
// Strategy: network-first for navigations (always fresh app), cache-first for static assets,
// and an offline fallback page. Never caches API/auth responses.

const CACHE = 'cf-v1'
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never intercept API, auth, or Supabase calls.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.hostname.includes('supabase')) return

  // App navigations: network-first, fall back to offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response('Offline', { status: 503 })))
    )
    return
  }

  // Static assets: cache-first.
  if (url.pathname.startsWith('/_next/static/') || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
        const copy = resp.clone()
        caches.open(CACHE).then((c) => c.put(request, copy))
        return resp
      }))
    )
  }
})
