import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const logs = []
page.on('pageerror', (err) => logs.push('[pageerror] ' + err.stack?.split('\n').slice(0, 3).join(' | ') || err.message))
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[console.${m.type()}] ${m.text()}`) })

await page.goto('http://localhost:5173/?url=https://www.w3schools.com/html/mov_bbb.mp4', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForTimeout(3000)

const st = await page.evaluate(() => ({
  appHTML: document.getElementById('app')?.innerHTML.slice(0, 200) || 'null',
  appChildren: document.getElementById('app')?.children.length || 0,
  bodyLen: document.body.innerHTML.length,
  videoCount: document.querySelectorAll('video').length,
}))
console.log('DOM 状态:', JSON.stringify(st, null, 2))
console.log('\n=== 日志/错误 ===')
for (const l of logs) console.log(l)

// 再测一个无 ?url= 的对照
logs.length = 0
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForTimeout(1500)
console.log('\n=== 对照：无参数页面 ===')
console.log('appChildren:', await page.evaluate(() => document.getElementById('app').children.length))
console.log('videoCount:', await page.evaluate(() => document.querySelectorAll('video').length))
console.log('日志:', logs.length ? logs.join('\n') : '无')

await browser.close()
