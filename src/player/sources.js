import { extname } from '../utils.js'

/**
 * 检测浏览器类型
 * @returns {'chrome'|'edge'|'360'|'qq'|'baidu'|'other'}
 */
export function getBrowserType() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  
  // Edge (Chromium-based) - UA 包含 "edg/"
  if (ua.includes('edg/')) return 'edge'
  
  // 360 浏览器 - UA 包含 "360" 和 "chrome"
  if (ua.includes('360') && ua.includes('chrome')) return '360'
  
  // Chrome - UA 包含 "chrome" 但不包含特殊标记
  if (ua.includes('chrome') && !ua.includes('chromium') && !ua.includes('qqbrowser') && !ua.includes('baidu')) return 'chrome'
  
  // QQ 浏览器
  if (ua.includes('qqbrowser')) return 'qq'
  
  // 百度浏览器
  if (ua.includes('baidu')) return 'baidu'
  
  return 'other'
}

/**
 * 是否为现代浏览器（Chrome/Edge/360）
 * 这些浏览器原生支持 MKV/AVI/WMV 等格式
 */
export function isModernBrowser() {
  const browser = getBrowserType()
  return browser === 'chrome' || browser === 'edge' || browser === '360'
}

/**
 * 浏览器是否原生支持指定格式
 * @param {string} ext - 文件扩展名（不含点号）
 * @returns {boolean}
 */
export function isNativeSupported(ext) {
  if (!ext) return false

  // 所有浏览器都支持的基础格式
  const universalNativeExts = new Set([
    'mp4', 'm4v', 'm4a', 'mov', 'webm', 'ogv', 'ogg', 'mp3', 'wav', 'aac', 'flac'
  ])

  // 现代浏览器额外支持的格式
  const modernNativeExts = new Set([
    'mkv', 'avi', 'wmv', 'asf', 'mpg', 'mpeg', 'flv', 'ts', 'mts', 'm2ts'
  ])

  if (universalNativeExts.has(ext)) return true
  if (isModernBrowser() && modernNativeExts.has(ext)) return true
  return false
}

/**
 * 判断资源需要转码
 * @param {string} ext - 文件扩展名（不含点号）
 * @returns {boolean}
 */
export function needTranscode(ext) {
  if (!ext) return true
  return !isNativeSupported(ext)
}

/**
 * 判定资源类型
 * @param {Object} options
 * @param {string} options.url - 资源 URL
 * @param {string} options.mime - MIME 类型
 * @param {string} options.name - 文件名
 * @returns {{kind:'native'|'transcode'|'hls'|'dash'|'flv'|'ts', ext:string}}
 */
export function detectKind({ url = '', mime = '', name = '' }) {
  const ext = extname(name || url)
  const m = mime.toLowerCase()
  
  // 流式格式检测
  if (ext === 'm3u8' || m === 'application/vnd.apple.mpegurl') return { kind: 'hls', ext }
  if (ext === 'mpd' || m === 'application/dash+xml') return { kind: 'dash', ext }
  if (ext === 'flv' || m === 'video/x-flv') return { kind: 'flv', ext }
  if (ext === 'ts' || m === 'video/mp2t') return { kind: 'ts', ext }
  
  // 判断是否原生支持
  if (isNativeSupported(ext)) {
    return { kind: 'native', ext }
  }
  
  // 需要转码
  return { kind: 'transcode', ext }
}

/**
 * 检查本地文件是否可被播放器处理
 * @param {File} file - 文件对象
 * @returns {boolean}
 */
export function isSupportedLocalFile(file) {
  if (!file || !file.name) return false

  const ext = extname(file.name)
  if (!ext) return false

  // 排除仅限网络流的格式
  if (ext === 'm3u8' || ext === 'mpd') return false

  // 检查 MIME 类型
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('video/') || type.startsWith('audio/')) return true

  // 检查扩展名 - 所有视频格式都允许（现代浏览器原生播放，旧浏览器转码）
  if (isNativeSupported(ext)) return true

  // 不支持的格式也允许选择（会触发转码）
  return false
}

/**
 * 挂载对应播放引擎
 * @param {HTMLVideoElement} video
 * @param {Object} options
 * @param {string} options.kind - 播放类型
 * @param {string} options.url - 资源 URL
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
      // native：直接交给 video 元素
      video.src = url
      done({ engine: null, destroy: () => { video.removeAttribute('src'); video.load() } })
    }
  })
}
