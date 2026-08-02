import './style.css'
import { PlayerUI } from './ui/controls.js'
import { toast } from './utils.js'

const ui = new PlayerUI(document.getElementById('app'))

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
