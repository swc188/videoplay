import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
page.on('console', (m) => m.type() === 'error' && errors.push('[console] ' + m.text()))

console.log('=== 测试 1: 正常打开页面 ===')
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('.player video', { timeout: 10000 })
console.log('video 元素存在:', await page.evaluate(() => !!document.querySelector('.player video')))

console.log('\n=== 测试 2: ?url= 直链播放 MP4 ===')
errors.length = 0
await page.goto('http://localhost:5173/?url=https://www.w3schools.com/html/mov_bbb.mp4', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('.player video', { timeout: 10000 })
await page.waitForFunction(() => document.querySelector('.player video').src !== '' || document.querySelector('.player video').error, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(4000)
const st = await page.evaluate(() => {
  const v = document.querySelector('video')
  return {
    title: document.querySelector('.title')?.textContent,
    videoSrc: (v.currentSrc || v.src || '').slice(0, 60),
    readyState: v.readyState,
    error: v.error ? { code: v.error.code, message: v.error.message } : null,
    paused: v.paused,
    duration: v.duration,
    playerClass: document.querySelector('.player').className,
  }
})
console.log('状态:', JSON.stringify(st, null, 2))
console.log('JS 错误:', errors.length ? errors.join('\n') : '无')

await browser.close()
