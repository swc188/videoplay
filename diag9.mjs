import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text().slice(0, 200)}`))
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message.slice(0, 200)))

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('#app', { timeout: 8000 })

const result = await page.evaluate(async () => {
  const t0 = performance.now()
  try {
    const mod = await import('/src/player/transcoder.js')
    const ff = await Promise.race([
      mod.getFFmpegInstance(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('ffmpeg 加载超时 45s')), 45000)),
    ])
    return { ok: true, loadedMs: Math.round(performance.now() - t0) }
  } catch (e) {
    return { ok: false, err: e.message, ms: Math.round(performance.now() - t0) }
  }
})
console.log('引擎加载结果:', JSON.stringify(result, null, 2))
console.log('页面日志:')
for (const l of logs.slice(-15)) console.log(l)

await browser.close()
