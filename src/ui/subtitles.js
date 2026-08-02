const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/

function parseTime(str) {
  const m = str.match(TIME_RE)
  if (!m) return 0
  const ms = Number(m[4].padEnd(3, '0'))
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + ms / 1000
}

/**
 * 解析 SRT / WebVTT 文本为 cue 数组
 * @returns {Array<{start:number,end:number,text:string}>}
 */
export function parseSubtitle(text) {
  const normalized = (text || '').replace(/\r\n/g, '\n')
  if (normalized.startsWith('\uFEFF')) { }
  const lines = normalized.split('\n')
  const cues = []
  let i = 0

  const skipBlock = () => {
    i++
    while (i < lines.length && lines[i].trim() !== '') i++
  }

  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '' || line === 'WEBVTT' || /^\d+$/.test(line)) {
      i++
      continue
    }
    if (line === 'NOTE' || line.startsWith('NOTE ')) { skipBlock(); continue }
    if (line.includes('-->')) {
      const m = line.match(/^\s*([\d:,.]+)\s*-->\s*([\d:,.]+)/)
      if (m) {
        const start = parseTime(m[1])
        const end = parseTime(m[2])
        const textParts = []
        i++
        while (i < lines.length && lines[i].trim() !== '') {
          textParts.push(lines[i])
          i++
        }
        cues.push({ start, end, text: textParts.join('\n').trim() })
      } else i++
    } else i++
  }
  return cues.filter((c) => c.text && c.end > c.start)
}

export class SubtitleManager {
  constructor(layerEl, video) {
    this.layer = layerEl
    this.video = video
    this.cues = []
    this.enabled = false
    this.textEl = null
    this.update = this.update.bind(this)
    this._bound = false
  }

  loadText(text) {
    this.cues = parseSubtitle(text)
    this.enabled = this.cues.length > 0
    if (!this._bound) {
      this.video.addEventListener('timeupdate', this.update)
      this.video.addEventListener('seeking', this.update)
      this._bound = true
    }
    this.update()
    return this.cues.length
  }

  setEnabled(on) {
    this.enabled = !!on && this.cues.length > 0
    if (!this.enabled) this.render(null)
  }

  clear() {
    this.cues = []
    this.enabled = false
    this.render(null)
  }

  setSize(size) {
    this.layer.classList.remove('size-small', 'size-normal', 'size-large')
    if (size) this.layer.classList.add(`size-${size}`)
  }

  update() {
    if (!this.enabled || this.cues.length === 0) return
    const t = this.video.currentTime
    const cue = this.cues.find((c) => t >= c.start && t <= c.end)
    this.render(cue ? cue.text : null)
  }

  render(text) {
    if (text) {
      if (!this.textEl) {
        this.textEl = document.createElement('div')
        this.textEl.className = 'subtitle-text'
        this.layer.append(this.textEl)
      }
      if (this.textEl.textContent !== text) this.textEl.textContent = text
    } else if (this.textEl) {
      this.textEl.remove()
      this.textEl = null
    }
  }
}
