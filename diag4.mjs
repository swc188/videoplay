import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
page.on('console', (m) => m.type() === 'error' && errors.push('[console] ' + m.text()))

console.log('=== 测试 1: ?url= 直链播放 MP4 ===')
await page.goto('http://localhost:5173/?url=https://www.w3schools.com/html/mov_bbb.mp4', { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => console.log('goto timeout', e.message.split('\n')[0]))
await page.waitForTimeout(3000)
let st = await page.evaluate(() => {
  const v = document.querySelector('video')
  return {
    title: document.querySelector('.title')?.textContent,
    videoSrc: v.currentSrc,
    readyState: v.readyState,
    error: v.error ? { code: v.error.code, message: v.error.message } : null,
    paused: v.paused,
    duration: v.duration,
    playerClass: document.querySelector('.player').className,
    hasMedia: document.querySelector('.player').classList.contains('has-media'),
  }
})
console.log('状态:', JSON.stringify(st, null, 2))
console.log('错误:', errors.length ? errors.join('\n') : '无')

// 清空错误再测对话框
errors.length = 0
console.log('\n=== 测试 2: URL 对话框播放 ===')
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(500)
await page.click('[data-action="open-url"]', { timeout: 3000 })
await page.waitForTimeout(300)
const dlg = await page.evaluate(() => ({
  open: document.querySelector('.dialog-mask').classList.contains('open'),
  inputs: [...document.querySelectorAll('.dialog .input')].map((i) => i.placeholder),
}))
console.log('对话框:', JSON.stringify(dlg))
await page.fill('.dialog .input[placeholder*="https"]', 'https://www.w3schools.com/html/mov_bbb.mp4')
await page.click('.dialog .btn-primary', { timeout: 3000 })
await page.waitForTimeout(4000)
st = await page.evaluate(() => {
  const v = document.querySelector('video')
  return {
    title: document.querySelector('.title')?.textContent,
    readyState: v.readyState,
    error: v.error ? { code: v.error.code, message: v.error.message } : null,
    duration: v.duration,
    items: document.querySelectorAll('.pl-item').length,
    dialogOpen: document.querySelector('.dialog-mask').classList.contains('open'),
  }
})
console.log('播放状态:', JSON.stringify(st, null, 2))
console.log('错误:', errors.length ? errors.join('\n') : '无')

await browser.close()
