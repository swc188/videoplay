import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const workerLogs = []
page.on('worker', (w) => {
  console.log('=== Worker 创建:', w.url().slice(0, 120))
  w.on('console', (m) => workerLogs.push(`[worker.${m.type()}] ${m.text().slice(0, 300)}`))
  w.on('error', (e) => workerLogs.push('[worker.error] ' + e.message.slice(0, 300)))
})

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('#app', { timeout: 8000 })

const r = await page.evaluate(async () => {
  const t0 = performance.now()
  try {
    const mod = await import('/src/player/transcoder.js')
    const ff = await Promise.race([
      mod.getFFmpegInstance(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('45s 超时')), 45000)),
    ])
    return { ok: true, ms: Math.round(performance.now() - t0) }
  } catch (e) {
    return { ok: false, err: e.message, ms: Math.round(performance.now() - t0) }
  }
})
console.log('结果:', JSON.stringify(r))
console.log('Worker 日志:')
for (const l of workerLogs) console.log(l)
await browser.close()
