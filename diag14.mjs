import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
page.on('console', (m) => m.type() === 'error' && errors.push('[console] ' + m.text()))

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('#app', { timeout: 8000 })

// 清掉可能持久化的目录句柄，避免 _initLocalLibrary 自动扫描干扰
await page.evaluate(async () => {
  localStorage.clear()
  if (indexedDB.databases) {
    const dbs = await indexedDB.databases()
    for (const { name } of dbs) if (name === 'uvp:library') indexedDB.deleteDatabase(name)
  }
})

await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.player video', { timeout: 8000 })

// 注入 mock 目录句柄：2000 个视频文件 + 子目录
await page.evaluate(() => {
  const mkFile = (name) => ({ name, kind: 'file', getFile: async () => new File(['x'], name, { type: 'video/mp4' }) })
  const mkDir = (name, children) => ({ name, kind: 'directory', values: async function* () { for (const c of children) yield c } })
  const sub = mkDir('sub', Array.from({ length: 100 }, (_, i) => mkFile(`sub_${i}.mp4`)))
  const children = [sub, ...Array.from({ length: 1900 }, (_, i) => mkFile(`video_${String(i).padStart(4, '0')}.mp4`))]
  window.__mockHandle = mkDir('videos', children)
  window.showDirectoryPicker = async () => window.__mockHandle
})

// 开始 rAF 监控检测主线程卡顿
await page.evaluate(() => {
  window.__rafDrops = []
  let last = performance.now()
  const tick = (t) => {
    const dt = t - last
    if (dt > 100) window.__rafDrops.push(Math.round(dt))
    last = t
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

const t0 = Date.now()
await page.click('.playlist-clear')
console.log('点击文件夹按钮，等待扫描完成...')

let items = 0
let toastText = ''
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500)
  items = await page.evaluate(() => document.querySelectorAll('.pl-item').length)
  toastText = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'))
  if (items >= 2000) break
}
console.log('耗时:', Date.now() - t0, 'ms, 列表项:', items, ', toast:', toastText)
console.log('主线程卡顿(>100ms 的 rAF 间隔):', await page.evaluate(() => window.__rafDrops.slice(0, 20)))
console.log('JS 错误:', errors.length ? errors.join('\n') : '无')

await browser.close()
