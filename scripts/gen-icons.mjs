import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const OUT_DIR = resolve(process.cwd(), 'public/icons')

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function inRoundRect(x, y, size, r) {
  if (x < 0 || y < 0 || x >= size || y >= size) return false
  if (x >= r && x < size - r) return true
  if (y >= r && y < size - r) return true
  const cx = x < size / 2 ? r : size - r - 1
  const cy = y < size / 2 ? r : size - r - 1
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function inTriangle(px, py, a, b, c) {
  const sign = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
  const d1 = sign([px, py], a, b)
  const d2 = sign([px, py], b, c)
  const d3 = sign([px, py], c, a)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const r = Math.round(size * 0.22)
  const cx = size / 2
  const cy = size / 2
  const w = size * 0.34
  const h = size * 0.4
  const top = [cx - w / 2, cy - h / 2]
  const right = [cx + w / 2, cy]
  const bottom = [cx - w / 2, cy + h / 2]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (!inRoundRect(x, y, size, r)) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0
        continue
      }
      // 垂直渐变背景
      const t = y / size
      const rB = Math.round(124 + (62 - 124) * t)
      const gB = Math.round(92 + (36 - 92) * t)
      const bB = Math.round(255 + (140 - 255) * t)
      rgba[i] = rB
      rgba[i + 1] = gB
      rgba[i + 2] = bB
      rgba[i + 3] = 255
      // 播放三角
      if (inTriangle(x, y, top, right, bottom)) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = 255
      }
    }
  }
  return encodePng(size, size, rgba)
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7c5cff"/>
      <stop offset="1" stop-color="#3e248c"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="112" fill="url(#g)"/>
  <path d="M198 150v212l170-106z" fill="#ffffff"/>
</svg>`

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(resolve(OUT_DIR, 'icon.svg'), SVG)
writeFileSync(resolve(OUT_DIR, 'icon-192.png'), renderIcon(192))
writeFileSync(resolve(OUT_DIR, 'icon-512.png'), renderIcon(512))
console.log(`icons generated -> ${OUT_DIR}`)
