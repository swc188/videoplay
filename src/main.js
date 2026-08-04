import './style.css'
import { PlayerUI } from './ui/controls.js'
import { toast } from './utils.js'
import { preloadTranscoder } from './player/transcoder.js'

const ui = new PlayerUI(document.getElementById('app'))

// 预加载 ffmpeg.wasm（约 24MB），保证本地转码视频秒开。
// 页面 load 后延迟启动，避免与首屏渲染抢带宽；优先用 idle 回调，未触发则用定时器兜底
const startPreload = () => preloadTranscoder()
window.addEventListener('load', () => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(startPreload, { timeout: 6000 })
    // 兜底：idle 在 headless/繁忙场景可能不触发
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

// 支持 ?url= 直链播放
const params = new URLSearchParams(location.search)
const u = params.get('url')
if (u) {
  ui.loadUrl(u, params.get('title') || undefined)
}

// 未开启浏览器服务时提示
if (!window.isSecureContext) {
  toast('当前为非安全上下文，部分功能（画中画等）不可用')
}

window.playerUI = ui
