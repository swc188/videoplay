import { FFmpeg } from '@ffmpeg/ffmpeg'
import { extname } from '../utils.js'

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

function parseTimeToSeconds(str) {
  const m = str.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    const instance = new FFmpeg()
    // 使用 public 目录下的本地文件，避免 package exports 限制
    const coreURL = new URL('/ffmpeg-core/ffmpeg-core.js', import.meta.url).href
    const wasmURL = new URL('/ffmpeg-core/ffmpeg-core.wasm', import.meta.url).href
    await instance.load({ coreURL, wasmURL })
    ffmpeg = instance
    return instance
  })()
  return loadingPromise
}

/**
 * 用 ffmpeg.wasm 把任意格式转码为 MP4
 * @param {File|Blob} file 源文件
 * @param {Object} opts { onProgress(pct), onEngineLoad, signal }
 * @returns {Promise<Blob>}
 */
export async function transcodeFile(file, { onProgress, onEngineLoad, signal } = {}) {
  if (file.size > MAX_TRANSCODE_SIZE) {
    throw new Error(`文件过大（${(file.size / 1048576).toFixed(0)}MB），超过 ${MAX_TRANSCODE_SIZE / 1048576}MB 上限，浏览器内存不足，无法转码`)
  }
  const key = transcodeKey(file)
  if (transcodeCache.has(key)) return transcodeCache.get(key)

  const engineWasReady = isTranscoderReady()
  const ff = await loadFFmpeg()
  if (signal && signal.aborted) throw new Error('aborted')
  if (!engineWasReady) onEngineLoad?.()

  const inName = `in${extname(file.name) ? '.' + extname(file.name) : ''}`
  const outName = 'out.mp4'

  lastDuration = 0
  ff.on('log', ({ message }) => {
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

  await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()))

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
    await ff.exec(args)
    const data = await ff.readFile(outName, 'binary')
    const blob = new Blob([data], { type: 'video/mp4' })
    if (transcodeCache.size >= TRANSCODE_CACHE_MAX) {
      transcodeCache.delete(transcodeCache.keys().next().value)
    }
    transcodeCache.set(key, blob)
    return blob
  } finally {
    try { await ff.deleteFile(inName) } catch {}
    try { await ff.deleteFile(outName) } catch {}
  }
}

export function isTranscoderReady() {
  return !!ffmpeg
}

/**
 * 空闲预加载 ffmpeg.wasm，避免首次转码时现场下载 24MB core 造成长时间无反馈等待
 */
export function preloadTranscoder() {
  if (ffmpeg || loadingPromise) return loadingPromise || Promise.resolve()
  const p = loadFFmpeg()
  p.catch(() => {})
  return p
}

/**
 * 获取 ffmpeg.wasm 实例（供测试或高级用法执行任意命令）
 */
export function getFFmpegInstance() {
  return loadFFmpeg()
}
