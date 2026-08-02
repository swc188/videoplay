import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

// ---- PNG encoder ----
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
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4)
    raw[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      const di = rowStart + 1 + x * 4
      raw[di] = rgba[si]
      raw[di + 1] = rgba[si + 1]
      raw[di + 2] = rgba[si + 2]
      raw[di + 3] = rgba[si + 3]
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---- Rounded rect SDF ----
function roundRectAlpha(x, y, w, h, r) {
  const hw = w / 2, hh = h / 2
  const qx = Math.abs(x - hw) - (hw - r)
  const qy = Math.abs(y - hh) - (hh - r)
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0)
  const inside = Math.min(Math.max(qx, qy), 0)
  const dist = Math.hypot(ox, oy) + inside - r
  return Math.max(0, Math.min(1, 0.5 - dist))
}

function triangleContains(px, py, a, b, c) {
  const d1 = (px - a[0]) * (b[1] - a[1]) - (py - a[1]) * (b[0] - a[0])
  const d2 = (px - b[0]) * (c[1] - b[1]) - (py - b[1]) * (c[0] - b[0])
  const d3 = (px - c[0]) * (a[1] - c[1]) - (py - c[1]) * (a[0] - c[0])
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t) }

function render(size) {
  const rgba = new Uint8Array(size * size * 4)
  const SS = 3 // supersample
  const cx = size / 2
  const cy = size / 2
  const tW = size * 0.5   // 三角宽
  const tH = size * 0.62  // 三角高
  const A = [cx - tW / 2, cy - tH / 2]
  const B = [cx - tW / 2, cy + tH / 2]
  const C = [cx + tW * 0.62, cy]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgA = 0, tri = 0, samples = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          bgA += roundRectAlpha(px, py, size, size, size * 0.225)
          if (triangleContains(px, py, A, B, C)) tri++
          samples++
        }
      }
      bgA /= samples
      const triA = tri / samples
      const t = (x + y) / (2 * size)
      const bgR = 255
      const bgG = lerp(77, 122, t)
      const bgB = lerp(79, 69, t)
      const R = bgR * (1 - triA) + 255 * triA
      const G = bgG * (1 - triA) + 255 * triA
      const Bb = bgB * (1 - triA) + 255 * triA
      const alpha = Math.round(bgA * 255)
      const idx = (y * size + x) * 4
      if (alpha > 0) {
        rgba[idx] = Math.round(R)
        rgba[idx + 1] = Math.round(G)
        rgba[idx + 2] = Math.round(Bb)
        rgba[idx + 3] = alpha
      }
    }
  }
  return rgba
}

const outDir = path.resolve('public/icons')
fs.mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), encodePNG(size, size, render(size)))
}
console.log('icons generated ->', outDir)
