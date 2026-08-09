import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('#app', { timeout: 8000 })

const r = await page.evaluate(async () => {
  const t0 = performance.now()
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(30)
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((res) => { rec.onstop = res })
    rec.start()
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = ['#f00', '#0f0', '#00f'][i % 3]
      ctx.fillRect(0, 0, 320, 180)
      await new Promise((res) => setTimeout(res, 40))
    }
    rec.stop()
    await done
    const file = new File(chunks, 'test.webm', { type: 'video/webm' })

    const mod = await import('/src/player/transcoder.js')
    const blob = await Promise.race([
      mod.transcodeFile(file, {
        onProgress: () => {},
        onEngineLoad: () => {},
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('转码超时 90s')), 90000)),
    ])
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.src = url
    await new Promise((res, rej) => {
      video.onloadedmetadata = res
      video.onerror = () => rej(new Error('转码产物无法解码'))
      setTimeout(() => rej(new Error('元数据加载超时')), 15000)
    })
    return {
      ok: true,
      transcodeMs: Math.round(performance.now() - t0),
      blobSize: blob.size,
      duration: video.duration,
      videoW: video.videoWidth,
      videoH: video.videoHeight,
    }
  } catch (e) {
    return { ok: false, err: e.message, ms: Math.round(performance.now() - t0) }
  }
})
console.log('转码链路验证:', JSON.stringify(r, null, 2))
console.log('JS 错误:', errors.length ? errors.join('\n') : '无')
await browser.close()
