import './style.css'
import { PlayerUI } from './ui/controls.js'
import { toast } from './utils.js'
import { preloadTranscoder } from './player/transcoder.js'

const ui = new PlayerUI(document.getElementById('app'))

// 预加载 ffmpeg.wasm（约 24MB），保证本地转码视频秒开
const startPreload = () => preloadTranscoder()
window.addEventListener('load', () => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(startPreload, { timeout: 6000 })
    setTimeout(startPreload, 4000)
  } else {
    setTimeout(startPreload, 2500)
  }
})

// 生产环境注册 Service Worker（PWA 离线 / 安装）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // 使用子资源完整性校验，防止中间人攻击
    navigator.serviceWorker.register('sw.js', { integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC' }).catch(() => {})
  })
}

// 支持直链播放：
//   ?src= / ?url=（生产环境可用；Vite dev 对 ?url= 保留字会返回 403，故优先 ?src=）
//   #src= / #url=（hash 参数，dev / prod 均可用）
const params = new URLSearchParams(location.search)
let u = params.get('src') || params.get('url')
let title = params.get('title')
if (!u) {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  u = hash.get('src') || hash.get('url')
  title = hash.get('title') || title
}
if (u) {
  // 安全校验：仅允许 http/https 协议
  try {
    const parsed = new URL(u)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      toast('仅支持 http/https 协议的媒体地址', 'error')
    } else {
      ui.loadUrl(u, title || undefined)
    }
  } catch {
    toast('无效的媒体地址', 'error')
  }
}

// 未开启浏览器服务时提示
if (!window.isSecureContext) {
  toast('当前为非安全上下文，部分功能（画中画等）不可用')
}
