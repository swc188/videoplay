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
    navigator.serviceWorker.register('sw.js').catch(() => {})
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
if (u) ui.loadUrl(u, title || undefined)

// 未开启浏览器服务时提示
if (!window.isSecureContext) {
  toast('当前为非安全上下文，部分功能（画中画等）不可用')
}

window.playerUI = ui
