import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('#app', { timeout: 8000 })

const r = await page.evaluate(async () => {
  const out = {}
  let t = performance.now()
  const resp = await fetch('/ffmpeg-core/ffmpeg-core.wasm')
  const buf = await resp.arrayBuffer()
  out.fetchMs = Math.round(performance.now() - t)
  out.wasmBytes = buf.byteLength
  t = performance.now()
  out.compile = await Promise.race([
    (async () => {
      await WebAssembly.compile(buf)
      return { ok: true, compileMs: Math.round(performance.now() - t) }
    })(),
    new Promise((r) => setTimeout(() => r({ ok: false, timeout: true, compileMs: Math.round(performance.now() - t) }), 60000)),
  ])
  return out
})
console.log('诊断结果:', JSON.stringify(r, null, 2))
await browser.close()
