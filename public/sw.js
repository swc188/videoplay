const CACHE = 'uvp-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return

  // ffmpeg core 体积大，优先走缓存
  if (req.url.includes('/ffmpeg-core/')) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          cache.put(req, res.clone())
          return res
        }))
      )
    )
    return
  }

  e.respondWith(
    fetch(req).then((res) => res).catch(() => caches.match(req).then((hit) => hit))
  )
})
