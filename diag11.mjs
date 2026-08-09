import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text().slice(0, 300)}`))
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message.slice(0, 300)))

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('#app', { timeout: 8000 })

const r = await page.evaluate(async () => {
  const t0 = performance.now()
  const steps = {}
  try {
    steps.coreImport = await Promise.race([
      (async () => {
        const m = await import('/ffmpeg-core/ffmpeg-core.js')
        return { ok: true, hasDefault: !!m.default, keys: Object.keys(m).slice(0, 5), ms: Math.round(performance.now() - t0) }
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('core import timeout 30s')), 30000)),
    ])
    const coreURL = '/ffmpeg-core/ffmpeg-core.js'
    const wasmURL = '/ffmpeg-core/ffmpeg-core.wasm'
    const workerURL = '/ffmpeg-core/ffmpeg-core.worker.js'
    const coreMod = await import('/ffmpeg-core/ffmpeg-core.js')
    steps.coreInit = await Promise.race([
      (async () => {
        const inst = await coreMod.default({ mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL }))}` })
        return { ok: true, ms: Math.round(performance.now() - t0) }
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('core init timeout 40s')), 40000)),
    ])
    return { ok: true, steps, totalMs: Math.round(performance.now() - t0) }
  } catch (e) {
    return { ok: false, steps, err: e.message, totalMs: Math.round(performance.now() - t0) }
  }
})
console.log('core 手动初始化:', JSON.stringify(r, null, 2))
console.log('日志:')
for (const l of logs.slice(-12)) console.log(l)
await browser.close()
