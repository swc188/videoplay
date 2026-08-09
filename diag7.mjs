import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
page.on('console', (m) => m.type() === 'error' && errors.push('[console] ' + m.text()))

console.log('=== 测试 1: ?src= 直链播放 MP4 ===')
await page.goto('http://localhost:5173/?src=https://media.w3.org/2010/05/sintel/trailer.mp4', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('.player video', { timeout: 10000 })
await page.waitForTimeout(5000)
const st = await page.evaluate(() => {
  const v = document.querySelector('video')
  return {
    title: document.querySelector('.title')?.textContent || document.querySelector('[class*=title]')?.textContent || '',
    readyState: v.readyState,
    error: v.error ? { code: v.error.code, message: v.error.message } : null,
    paused: v.paused,
    duration: v.duration,
    currentTime: v.currentTime,
  }
})
console.log('状态:', JSON.stringify(st, null, 2))
console.log('JS 错误:', errors.length ? errors.join('\n') : '无')

await browser.close()
