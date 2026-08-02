const CACHE = 'uvp-v1'
const PRECACHE = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch { return }
  if (url.origin !== self.location.origin) return

  // ffmpeg.wasm 核心文件较大，走网络策略避免占满缓存
  if (url.pathname.includes('ffmpeg-core')) return

  // 跨域视频直链由浏览器直接处理，不拦截
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone))
        }
        return res
      }).catch(() => cached)
      return cached || network
    })
  )
})
