import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
page.on('console', (m) => m.type() === 'error' && errors.push('[console] ' + m.text()))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(400)

// 生成 webm 并上传
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
    ctx.fillStyle = ['red', 'green', 'blue', 'yellow'][i % 4]
    ctx.fillRect(0, 0, 320, 180)
    await new Promise((r) => setTimeout(r, 40))
  }
  rec.stop()
  await done
  const blob = new Blob(chunks, { type: 'video/webm' })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  return 'data:video/webm;base64,' + btoa(bin)
})
writeFileSync('/tmp/opencode/test.webm', Buffer.from(dataUrl.split(',')[1], 'base64'))

await page.setInputFiles('input[type="file"]', '/tmp/opencode/test.webm')
await page.waitForTimeout(1200)

// 移动鼠标触发 UI 显示
await page.mouse.move(640, 400)
await page.mouse.move(650, 402)
await page.waitForTimeout(300)

const uiState = await page.evaluate(() => {
  const cb = document.querySelector('.control-bar')
  const cs = getComputedStyle(cb)
  const pl = document.querySelector('.player')
  return {
    playerClass: pl.className,
    controlBarOpacity: cs.opacity,
    controlBarPointerEvents: cs.pointerEvents,
    playlistItems: document.querySelectorAll('.pl-item').length,
    videoReady: document.querySelector('video').readyState,
  }
})
console.log('=== UI 状态 ===', JSON.stringify(uiState, null, 2))

// 点播放
console.log('=== 点击 play ===')
await page.click('[data-action="play"]', { timeout: 5000 }).catch((e) => console.log('play click fail:', e.message.split('\n')[0]))
await page.waitForTimeout(800)
let v = await page.evaluate(() => {
  const v = document.querySelector('video')
  return { paused: v.paused, currentTime: v.currentTime, duration: v.duration, error: v.error ? v.error.message : null }
})
console.log('播放状态:', JSON.stringify(v))

// 前进 10s（视频短，无效果但验证不抛错）
console.log('=== 点击 forward/rewind ===')
await page.click('[data-action="forward"]', { timeout: 3000 })
await page.click('[data-action="rewind"]', { timeout: 3000 })
console.log('ok')

// 静音
console.log('=== 点击 mute ===')
await page.click('[data-action="mute"]', { timeout: 3000 })
v = await page.evaluate(() => document.querySelector('video').muted)
console.log('muted:', v)

// 倍速菜单
console.log('=== 点击 menu-speed ===')
await page.click('[data-action="menu-speed"]', { timeout: 3000 })
await page.waitForTimeout(200)
const menu = await page.evaluate(() => ({
  open: document.querySelector('.menu').classList.contains('open'),
  items: [...document.querySelectorAll('.menu-item')].map((i) => i.textContent),
}))
console.log('菜单:', JSON.stringify(menu))

// 循环
console.log('=== 点击 loop ===')
await page.click('[data-action="loop"]', { timeout: 3000 })
v = await page.evaluate(() => document.querySelector('video').loop)
console.log('loop:', v)

// 全屏
console.log('=== 点击 fullscreen ===')
await page.click('[data-action="fullscreen"]', { timeout: 3000 }).catch((e) => console.log('fullscreen click fail'))
await page.waitForTimeout(400)
console.log('fullscreenElement:', await page.evaluate(() => !!document.fullscreenElement))

// 播放列表导航
console.log('=== 点击 next ===')
await page.click('[data-action="next"]', { timeout: 3000 })
await page.waitForTimeout(500)
console.log('next ok, items:', await page.evaluate(() => document.querySelectorAll('.pl-item').length))

// 播放列表面板 toggle
console.log('=== 点击 toggle-playlist ===')
await page.click('[data-action="toggle-playlist"]', { timeout: 3000 })
await page.waitForTimeout(300)
console.log('panel open:', await page.evaluate(() => document.querySelector('.playlist-panel').classList.contains('open')))

// 空状态 file chooser
console.log('=== 点击 open-file（filechooser）===')

console.log('\n=== 页面错误汇总 ===')
console.log(errors.length ? errors.join('\n') : '无 JS 错误')

await browser.close()
