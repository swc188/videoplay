import { extname } from '../utils.js'

// 非 crossOriginIsolated 环境（缺少 COOP/COEP 响应头）下 SharedArrayBuffer 不可用，
// Emscripten 运行时会无条件引用该标识符，这里用 ArrayBuffer 兜底避免初始化抛错
if (typeof globalThis.SharedArrayBuffer === 'undefined') {
  globalThis.SharedArrayBuffer = globalThis.ArrayBuffer
}

let ffmpeg = null
let loadingPromise = null
let lastDuration = 0

// 转码需要把整个文件读入内存并在 wasm 内存中复制一份，
// 超大文件会导致浏览器标签页内存耗尽而崩溃白屏，这里设置安全上限
export const MAX_TRANSCODE_SIZE = 400 * 1024 * 1024

// 转码结果缓存：同一文件（按 文件名|大小 区分）只转码一次，重复点击秒播
const transcodeCache = new Map()
const TRANSCODE_CACHE_MAX = 12

function transcodeKey(file) {
  return `${file.name}|${file.size}`
}

function toAbs(url) {
  return new URL(url, import.meta.url).href
}

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    const { createFFmpeg } = await import('@ffmpeg/ffmpeg')
    const coreJs = (await import('@ffmpeg/core/dist/ffmpeg-core.js?url')).default
    const coreWasm = (await import('@ffmpeg/core/dist/ffmpeg-core.wasm?url')).default
    const coreWorker = (await import('@ffmpeg/core/dist/ffmpeg-core.worker.js?url')).default
    const instance = createFFmpeg({
      corePath: toAbs(coreJs),
      wasmPath: toAbs(coreWasm),
      workerPath: toAbs(coreWorker),
      log: true,
    })
    await instance.load()
    ffmpeg = instance
    return instance
  })()
  return loadingPromise
}

function parseTimeToSeconds(str) {
  const m = str.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

/**
 * 用 ffmpeg.wasm 把任意格式转码为 MP4
 * @param {File|Blob} file 源文件
 * @param {Object} opts { onProgress(pct), signal }
 * @returns {Promise<Blob>}
 */
export async function transcodeFile(file, { onProgress, signal } = {}) {
  if (file.size > MAX_TRANSCODE_SIZE) {
    throw new Error(`文件过大（${(file.size / 1048576).toFixed(0)}MB），超过 ${MAX_TRANSCODE_SIZE / 1048576}MB 上限，浏览器内存不足，无法转码`)
  }
  const key = transcodeKey(file)
  if (transcodeCache.has(key)) return transcodeCache.get(key)

  const ff = await loadFFmpeg()
  if (signal && signal.aborted) throw new Error('aborted')

  const inName = `in${extname(file.name) ? '.' + extname(file.name) : ''}`
  const outName = 'out.mp4'

  lastDuration = 0
  ff.setLogger(({ message }) => {
    if (!message) return
    const d = message.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/)
    if (d) lastDuration = parseTimeToSeconds(d[1]) || 0
    const t = message.match(/time=(\d+:\d+:\d+(?:\.\d+)?)/)
    if (t && lastDuration > 0) {
      const now = parseTimeToSeconds(t[1]) || 0
      const pct = Math.min(100, Math.round((now / lastDuration) * 100))
      onProgress?.({ pct, eta: Math.round((lastDuration - now) / Math.max(1, now)) })
    }
  })

  ff.FS('writeFile', inName, new Uint8Array(await file.arrayBuffer()))

  const args = [
    '-i', inName,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    '-map', '0:v:0',
    '-map', '0:a?',
    '-sn',
    '-y', outName,
  ]

  try {
    await ff.run(...args)
    const data = ff.FS('readFile', outName)
    const view = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    const blob = new Blob([view], { type: 'video/mp4' })
    if (transcodeCache.size >= TRANSCODE_CACHE_MAX) {
      transcodeCache.delete(transcodeCache.keys().next().value)
    }
    transcodeCache.set(key, blob)
    return blob
  } finally {
    try { ff.FS('unlink', inName) } catch {}
    try { ff.FS('unlink', outName) } catch {}
  }
}

export function isTranscoderReady() {
  return !!ffmpeg
}

/**
 * 获取 ffmpeg.wasm 实例（供测试或高级用法执行任意命令）
 */
export function getFFmpegInstance() {
  return loadFFmpeg()
}
