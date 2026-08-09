import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message))
page.on('console', (m) => m.type() === 'error' && errors.push('[console] ' + m.text()))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(400)

const diag = await page.evaluate(() => {
  const out = []
  const actions = [...new Set([
    ...document.querySelectorAll('[data-action]'),
    ...document.querySelectorAll('.ctrl-btn'),
  ])]
  for (const btn of actions) {
    const r = btn.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) {
      out.push({ action: btn.dataset.action, class: btn.className, size: '0x0', style: btn.getAttribute('style') })
      continue
    }
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const top = document.elementFromPoint(cx, cy)
    out.push({
      action: btn.dataset.action,
      class: btn.className,
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      topElement: top ? `${top.tagName}.${top.className}` : 'null',
      self: top === btn,
    })
  }
  // 检查 player 的 class
  const player = document.querySelector('.player')
  const cs = getComputedStyle(player)
  return {
    playerClass: player.className,
    playerDisplay: cs.display,
    buttons: out,
    uiHiddenDefined: !!document.querySelector('style,link'),
  }
})
console.log(JSON.stringify(diag, null, 2))
console.log('页面错误:', errors.length ? errors : '无')
await browser.close()
