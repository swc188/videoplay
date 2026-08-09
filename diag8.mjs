import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
page.on('console', (m) => m.type() === 'error' && errors.push('[console] ' + m.text()))

console.log('=== 测试 1: 正常 MP4-like 播放回归（webm）===')
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('.player video', { timeout: 8000 })

const dataUrl = await page.evaluate(async () => {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  const ctx = canvas.getContext('2d')
  const stream = canvas.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise((r) => { rec.onstop = r })
  rec.start()
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = ['red', 'green', 'blue'][i % 3]
    ctx.fillRect(0, 0, 320, 180)
    await new Promise((r) => setTimeout(r, 40))
  }
  rec.stop()
  await done
  return 'data:video/webm;base64,' + btoa(String.fromCharCode(...new Uint8Array(await new Blob(chunks).arrayBuffer())))
})
writeFileSync('/tmp/opencode/test.webm', Buffer.from(dataUrl.split(',')[1], 'base64'))

await page.setInputFiles('input[type="file"]', '/tmp/opencode/test.webm')
await page.waitForTimeout(1500)
await page.mouse.move(640, 400)
await page.waitForTimeout(300)
const ok = await page.evaluate(() => {
  const v = document.querySelector('video')
  return { readyState: v.readyState, error: v.error ? v.error.message : null, items: document.querySelectorAll('.pl-item').length }
})
console.log('正常播放回归:', JSON.stringify(ok))

console.log('\n=== 测试 2: 假 mp4 触发解码失败 → 自动转码回退 ===')
errors.length = 0
await page.setInputFiles('input[type="file"]', '/tmp/opencode/fake.mp4')
await page.waitForTimeout(1500)
await page.mouse.move(640, 400)
await page.waitForTimeout(300)
const pre = await page.evaluate(() => ({
  tpShow: document.querySelector('.tp')?.classList.contains('show'),
  tpMeta: document.querySelector('.tp-meta')?.textContent || '',
  errorToast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'),
}))
console.log('上传假 mp4 后状态:', JSON.stringify(pre))

console.log('等待转码流程响应（引擎已预加载，应很快失败）...')
await page.waitForTimeout(20000)
const post = await page.evaluate(() => ({
  tpShow: document.querySelector('.tp')?.classList.contains('show'),
  tpMeta: document.querySelector('.tp-meta')?.textContent || '',
  toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'),
  transcodeAbortActive: window.playerUI?.transcodeAbort ? true : false,
}))
console.log('15s 后状态:', JSON.stringify(post))
console.log('JS 错误:', errors.length ? errors.join('\n') : '无')

await browser.close()
