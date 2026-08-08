import { extname } from '../utils.js'

// 浏览器 video 原生支持的容器
const NATIVE_EXTS = new Set([
  'mp4', 'm4v', 'm4a', 'mov', 'webm', 'ogv', 'ogg', 'oga', 'ogm',
  'mp3', 'wav', 'aac', 'flac', 'm4b', 'opus',
])

// 需要流式引擎（MSE）的格式
const HLS_EXTS = new Set(['m3u8'])
const DASH_EXTS = new Set(['mpd'])
const FLV_EXTS = new Set(['flv'])
const TS_EXTS = new Set(['ts', 'mts', 'm2ts'])

// 需要 ffmpeg.wasm 转码的格式（仅兼容浏览器不支持的格式）
const TRANSCODE_EXTS = new Set([
  'rm', 'rmvb', '3gp', 'vob', 'divx', 'xvid', 'dat', 'mxf', 'nsv',
])

// 现代浏览器（Chrome/Edge/360）原生支持的格式，可直接播放
const MODERN_BROWSER_NATIVE_EXTS = new Set([
  'mkv', 'avi', 'wmv', 'asf', 'mpg', 'mpeg',
])

const HLS_MIMES = [
  'application/vnd.apple.mpegurl', 'application/x-mpegurl',
  'application/mpegurl', 'audio/mpegurl', 'application/vnd.apple.mpegurl; charset=utf-8',
]
const DASH_MIMES = ['application/dash+xml']
const FLV_MIMES = ['video/x-flv', 'flv-application/octet-stream']
const TS_MIMES = ['video/mp2t', 'video/mpeg', 'video/mp2p']

/**
 * 检测是否为现代浏览器（Chrome/Edge/360）
 * 这些浏览器原生支持 MKV/AVI/WMV 等格式
 * QQ浏览器/百度浏览器虽然基于Chromium但解码能力有限，不走现代浏览器路径
 */
export function isModernBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // Edge (Chromium-based) - 必须在 Chrome 之前检测
  if (/Edg[e]/i.test(ua)) return true
  // 360 浏览器 - 必须包含 Chrome
  if (/360/.test(ua) && /Chrome/.test(ua)) return true
  // Chrome (排除 Chromium、QQ、百度等修改版)
  if (/Chrome/.test(ua) && !/Chromium/.test(ua) && !/QQBrowser/.test(ua) && !/Baidu/.test(ua) && !/Edge/.test(ua)) return true
  return false
}

export function isNativeMime(mime = '') {
  if (!mime) return false
  return mime.startsWith('video/') || mime.startsWith('audio/')
}

/**
 * 扩展名是否在播放器可处理范围内
 */
export function isSupportedExtName(name = '') {
  const e = extname(name)
  if (!e) return false
  return NATIVE_EXTS.has(e) || HLS_EXTS.has(e) || DASH_EXTS.has(e) ||
    FLV_EXTS.has(e) || TS_EXTS.has(e) || TRANSCODE_EXTS.has(e) ||
    (isModernBrowser() && MODERN_BROWSER_NATIVE_EXTS.has(e))
}

/**
 * 本地文件是否可被播放器处理（点击即可播放）。
 * 包含全部支持格式，但排除仅限网络流的 m3u8 / mpd。
 */
export function isSupportedLocalFile(file) {
  if (!file || !file.name) return false
  const e = extname(file.name)
  if (!e) return false
  // 排除仅限网络流的格式
  if (HLS_EXTS.has(e) || DASH_EXTS.has(e)) return false
  // 检查 MIME 类型
  const type = file.type || ''
  if (type.startsWith('video/') || type.startsWith('audio/')) return true
  // 检查扩展名
  if (NATIVE_EXTS.has(e)) return true
  if (FLV_EXTS.has(e) || TS_EXTS.has(e)) return true
  if (TRANSCODE_EXTS.has(e)) return true
  // 现代浏览器支持更多格式
  if (isModernBrowser() && MODERN_BROWSER_NATIVE_EXTS.has(e)) return true
  return false
}

/**
 * 判定资源类型
 * @returns {{kind:'native'|'hls'|'dash'|'flv'|'ts'|'transcode'|'unknown', ext:string}}
 */
export function detectKind({ url, mime, name }) {
  const ext = extname(name || url)
  const m = (mime || '').toLowerCase()
  const modern = isModernBrowser()

  // 流式格式
  if (ext && HLS_EXTS.has(ext) || HLS_MIMES.includes(m)) return { kind: 'hls', ext }
  if (ext && DASH_EXTS.has(ext) || DASH_MIMES.includes(m)) return { kind: 'dash', ext }
  if (ext && FLV_EXTS.has(ext) || FLV_MIMES.includes(m)) return { kind: 'flv', ext }
  if (ext && TS_EXTS.has(ext) || TS_MIMES.includes(m)) return { kind: 'ts', ext }

  // 现代浏览器：原生支持 MP4/WebM + MKV/AVI/WMV
  if (modern && (NATIVE_EXTS.has(ext) || MODERN_BROWSER_NATIVE_EXTS.has(ext))) {
    return { kind: 'native', ext }
  }

  // 旧浏览器：仅原生支持 MP4/WebM
  if (ext && NATIVE_EXTS.has(ext)) return { kind: 'native', ext }

  // 需要转码的格式
  if (ext && TRANSCODE_EXTS.has(ext)) return { kind: 'transcode', ext }
  if (ext && MODERN_BROWSER_NATIVE_EXTS.has(ext)) return { kind: 'transcode', ext }

  // 基于 MIME 类型判断
  if (isNativeMime(m)) return { kind: 'native', ext }

  // 无扩展名/未知：先尝试原生播放
  if (!ext) return { kind: 'unknown', ext }

  return { kind: 'transcode', ext }
}

export const needTranscode = (kind) => kind === 'transcode'

/**
 * 挂载对应播放引擎
 * @returns {Promise<{engine:any, destroy:()=>void}>}
 */
export function attachEngine(video, { kind, url }) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (r) => { if (!settled) { settled = true; resolve(r) } }
    const fail = (err) => { if (!settled) { settled = true; reject(err) } }

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
          video.src = url
          done({ engine: null, destroy: () => { video.removeAttribute('src'); video.load() } })
        } else {
          fail(new Error('当前浏览器不支持 HLS'))
        }
      }).catch(() => fail(new Error('HLS 引擎加载失败')))
    } else if (kind === 'dash') {
      import('dashjs').then(({ default: dashjs }) => {
        try {
          const player = dashjs.MediaPlayer().create()
          player.updateSettings({
            streaming: { buffer: { fastSwitchEnabled: true } },
          })
          player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
            if (e.error && e.error.code === 27) fail(new Error('DASH 资源加载失败'))
          })
          player.initialize(video, url, true)
          done({
            engine: player,
            destroy: () => { try { player.reset() } catch {} },
          })
        } catch (e) { fail(new Error('DASH 初始化失败')) }
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
        })
        player.on(mpegts.Events.ERROR, () => fail(new Error('FLV/TS 加载失败')))
        player.attachMediaElement(video)
        player.load()
        player.play()
        done({ engine: player, destroy: () => { try { player.destroy() } catch {} } })
      }).catch(() => fail(new Error('FLV/TS 引擎加载失败')))
    } else {
      // native / unknown：直接交给 video
      video.src = url
      done({ engine: null, destroy: () => { video.removeAttribute('src'); video.load() } })
    }
  })
}
