import { extname } from '../utils.js'

/**
 * 检测浏览器类型。
 * 顺序很重要：QQ/百度/360 的 UA 都包含 "chrome"，
 * 必须先识别带品牌标记的浏览器，再回落到通用 Chrome。
 * @returns {'chrome'|'edge'|'360'|'qq'|'baidu'|'other'}
 */
export function getBrowserType() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  // Edge / Chrome / 360 各自独立类型，但均为现代浏览器，播放逻辑完全一致
  // Android Edge UA 包含 'EdgA'，iOS Edge UA 包含 'EdgiOS'
  if (ua.includes('edg/') || ua.includes('edga') || ua.includes('edgios')) return 'edge'
  if (ua.includes('360') && ua.includes('chrome')) return '360'
  if (ua.includes('qqbrowser')) return 'qq'
  if (ua.includes('baidu')) return 'baidu'
  if (ua.includes('chrome') && !ua.includes('chromium')) return 'chrome'
  return 'other'
}

export function isModernBrowser() {
  const type = getBrowserType()
  const modern = type === 'chrome' || type === 'edge' || type === '360'
  return { type, modern }
}

/**
 * 检测是否为移动端设备
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
}

const UNIVERSAL_NATIVE_EXTS = new Set([
  'mp4', 'm4v', 'm4a', 'mov', 'webm', 'ogv', 'ogg', 'mp3', 'wav', 'aac', 'flac',
])

const MODERN_NATIVE_EXTS = new Set([
  'mkv', 'avi', 'wmv', 'asf', 'mpg', 'mpeg', 'ts', 'mts', 'm2ts', '3gp', '3gpp',
])

/**
 * 浏览器是否原生支持指定格式
 * @param {string} ext - 扩展名（不含点）
 */
export function isNativeSupported(ext) {
  if (!ext) return false
  if (UNIVERSAL_NATIVE_EXTS.has(ext)) return true
  if (isModernBrowser().modern && MODERN_NATIVE_EXTS.has(ext)) return true
  return false
}

/**
 * 是否需要对指定 kind 转码。
 * @param {string} kind - detectKind 返回的类型
 * @returns {boolean}
 */
export function needTranscode(kind) {
  return kind === 'transcode'
}

/**
 * 判定资源类型
 * @param {{url?:string, mime?:string, name?:string}} options
 * @returns {{kind:'native'|'transcode'|'hls'|'dash'|'flv'|'ts', ext:string}}
 */
export function detectKind({ url = '', mime = '', name = '' } = {}) {
  const ext = extname(name || url)
  const m = mime.toLowerCase()

  if (ext === 'm3u8' || m === 'application/vnd.apple.mpegurl') return { kind: 'hls', ext }
  if (ext === 'mpd' || m === 'application/dash+xml') return { kind: 'dash', ext }
  if (ext === 'flv' || m === 'video/x-flv') return { kind: 'flv', ext }
  if (ext === 'ts' || m === 'video/mp2t') return { kind: 'ts', ext }

  if (isNativeSupported(ext)) return { kind: 'native', ext }
  return { kind: 'transcode', ext }
}

/**
 * 本地文件是否可被播放器接受
 * @param {File} file
 */
export function isSupportedLocalFile(file) {
  if (!file || !file.name) return false
  const ext = extname(file.name)
  if (!ext) return false
  if (ext === 'm3u8' || ext === 'mpd') return false
  // flv/ts 由 mpegts.js 引擎处理，即使浏览器无法识别 MIME 类型也应支持
  if (ext === 'flv' || ext === 'ts') return true
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('video/') || type.startsWith('audio/')) return true
  if (isNativeSupported(ext)) return true
  return false
}

/**
 * 挂载对应播放引擎
 * @param {HTMLVideoElement} video
 * @param {{kind:string, url:string}} options
 * @returns {Promise<{engine:any, destroy:()=>void}>}
 */
export function attachEngine(video, { kind, url }) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (r) => { if (!settled) { settled = true; resolve(r) } }
    const fail = (err) => { if (!settled) { settled = true; reject(err) } }

    const native = () => {
      video.src = url
      done({ engine: null, destroy: () => { video.removeAttribute('src'); video.load() } })
    }

    if (kind === 'hls') {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            backBufferLength: 60,
            maxBufferLength: 40,
            maxMaxBufferLength: 90,
          })
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
              else fail(new Error('HLS 加载失败'))
            }
          })
          hls.on(Hls.Events.MANIFEST_PARSED, () => done({ engine: hls, destroy: () => hls.destroy() }))
          hls.loadSource(url)
          hls.attachMedia(video)
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          native()
        } else {
          fail(new Error('当前浏览器不支持 HLS'))
        }
      }).catch(() => fail(new Error('HLS 引擎加载失败')))
    } else if (kind === 'dash') {
      import('dashjs').then(({ default: dashjs }) => {
        try {
          const player = dashjs.MediaPlayer().create()
          player.updateSettings({ streaming: { buffer: { fastSwitchEnabled: true } } })
          player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
            if (e.error && e.error.code === 27) fail(new Error('DASH 资源加载失败'))
          })
          player.initialize(video, url, true)
          done({ engine: player, destroy: () => { try { player.reset() } catch {} } })
        } catch {
          fail(new Error('DASH 初始化失败'))
        }
      }).catch(() => fail(new Error('DASH 引擎加载失败')))
    } else if (kind === 'flv' || kind === 'ts') {
      import('mpegts.js').then(({ default: mpegts }) => {
        if (!mpegts.isSupported()) return fail(new Error('当前浏览器不支持 MSE'))
        const player = mpegts.createPlayer({
          type: kind === 'flv' ? 'flv' : 'mpegts',
          url,
          isLive: false,
        }, {
          lazyLoadMaxDuration: 120,
          enableStashBuffer: true,
          autoCleanupSourceBuffer: true,
          seekType: 'range',
        })
        player.on(mpegts.Events.ERROR, (e, data) => {
          if (data.fatal) fail(new Error('FLV/TS 加载失败'))
        })
        player.attachMediaElement(video)
        player.load()
        player.play()
        done({
          engine: player,
          destroy: () => { try { player.destroy() } catch {} },
          seek: (t) => { player.currentTime = t },
        })
      }).catch(() => fail(new Error('FLV/TS 引擎加载失败')))
    } else {
      native()
    }
  })
}
