import { chromium } from 'playwright'
import { writeFileSync, statSync } from 'node:fs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
const logs = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('[console.error] ' + msg.text())
  if (msg.type() === 'warning') logs.push('[warn] ' + msg.text())
})
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))

console.log('=== 1. 加载页面 ===')
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(500)

const ui = await page.evaluate(() => ({
  title: document.title,
  hasPlayer: !!document.querySelector('.player'),
  emptyStateVisible: !!document.querySelector('.empty-state') && getComputedStyle(document.querySelector('.empty-state')).display !== 'none',
  actions: [...document.querySelectorAll('[data-action]')].map((b) => b.dataset.action),
  ctrlButtons: [...document.querySelectorAll('.ctrl-btn')].map((b) => b.dataset.action),
  playlistPanel: !!document.querySelector('.playlist-panel'),
}))
console.log('UI 状态:', JSON.stringify(ui, null, 2))

console.log('\n=== 2. 逐个点击控制按钮 ===')
for (const action of [...new Set([...ui.actions, ...ui.ctrlButtons])]) {
  const before = errors.length
  try {
    await page.click(`[data-action="${action}"]`, { timeout: 2000 })
    await page.waitForTimeout(120)
    const newErrs = errors.slice(before)
    console.log(`click ${action}: ok${newErrs.length ? ' 但错误: ' + newErrs.join('|') : ''}`)
  } catch (e) {
    console.log(`click ${action}: 失败 ${e.message.split('\n')[0]}`)
  }
}
await page.keyboard.press('Escape')

console.log('\n=== 3. 页面内生成 webm 测试视频 ===')
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
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = ['red', 'green', 'blue', 'yellow'][i % 4]
    ctx.fillRect(0, 0, 320, 180)
    await new Promise((r) => setTimeout(r, 30))
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
console.log('测试 webm 已生成:', statSync('/tmp/opencode/test.webm').size, 'bytes')

console.log('\n=== 4. 通过文件选择器上传本地视频 ===')
const before = errors.length
await page.setInputFiles('input[type="file"]', '/tmp/opencode/test.webm')
await page.waitForTimeout(1500)
const afterUpload = await page.evaluate(() => ({
  playlistItems: document.querySelectorAll('.pl-item').length,
  videoSrc: document.querySelector('video').currentSrc || document.querySelector('video').src,
  hasMedia: document.querySelector('.player').classList.contains('has-media'),
  title: document.querySelector('.title')?.textContent,
}))
console.log('上传后:', JSON.stringify(afterUpload, null, 2))
console.log('上传产生新错误:', errors.slice(before).join('|') || '无')

console.log('\n=== 5. 点击播放按钮 ===')
await page.click('[data-action="play"]').catch((e) => console.log('click play 失败:', e.message.split('\n')[0]))
await page.waitForTimeout(800)
const playback = await page.evaluate(() => {
  const v = document.querySelector('video')
  return {
    paused: v.paused,
    readyState: v.readyState,
    error: v.error ? { code: v.error.code, message: v.error.message } : null,
    currentTime: v.currentTime,
    duration: v.duration,
  }
})
console.log('播放状态:', JSON.stringify(playback, null, 2))

console.log('\n=== 6. 测试更多控制按钮 ===')
for (const action of ['rewind', 'forward', 'mute', 'menu-speed', 'capture', 'loop', 'fullscreen']) {
  const before2 = errors.length
  try {
    await page.click(`[data-action="${action}"]`, { timeout: 2000 })
    await page.waitForTimeout(150)
    console.log(`click ${action}: ok${errors.length > before2 ? ' 但错误: ' + errors.slice(before2).join('|') : ''}`)
  } catch (e) {
    console.log(`click ${action}: 失败 ${e.message.split('\n')[0]}`)
  }
}

console.log('\n=== 收集到的所有错误 ===')
for (const e of errors) console.log(e)

await browser.close()
