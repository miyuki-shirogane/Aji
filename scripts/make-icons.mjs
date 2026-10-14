// Build icons from assets/icon.webp (a black line mark on a wide white canvas).
//  - toolbar icons: cropped mark on a square white background (visible on dark)
//  - assets/logo.png: cropped mark, transparent background (for the README)
//   node scripts/make-icons.mjs   (requires devDependencies: sharp)
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'assets/icon.webp')
const out = join(root, 'public/icons')
mkdirSync(out, { recursive: true })

const sharp = (await import('sharp')).default
const SIZE = 512

// 1) find the non-white content bounding box
const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info
let minx = W, miny = H, maxx = -1, maxy = -1
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (lum < 235) {
      if (x < minx) minx = x
      if (x > maxx) maxx = x
      if (y < miny) miny = y
      if (y > maxy) maxy = y
    }
  }
}
if (maxx < 0) { minx = 0; miny = 0; maxx = W - 1; maxy = H - 1 }

// 2) crop with ~12% breathing room
const pad = Math.round(Math.max(maxx - minx, maxy - miny) * 0.12)
const left = Math.max(0, minx - pad)
const top = Math.max(0, miny - pad)
const width = Math.min(W - left, maxx - minx + 2 * pad)
const height = Math.min(H - top, maxy - miny + 2 * pad)
const cropped = await sharp(src).extract({ left, top, width, height }).png().toBuffer()

// 3) toolbar icons: fit onto a square white canvas
const master = await sharp(cropped)
  .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
  .png()
  .toBuffer()
for (const size of [16, 32, 48, 128]) {
  await sharp(master).resize(size, size).png().toFile(join(out, `icon-${size}.png`))
}

// 4) README logo: same crop, transparent background (white -> alpha)
const LOGO = 256
const g = await sharp(cropped)
  .resize(LOGO, LOGO, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const rgba = Buffer.alloc(g.info.width * g.info.height * 4)
for (let i = 0; i < g.info.width * g.info.height; i++) {
  const r = g.data[i * 3], gg = g.data[i * 3 + 1], b = g.data[i * 3 + 2]
  const lum = 0.299 * r + 0.587 * gg + 0.114 * b
  rgba[i * 4] = 0
  rgba[i * 4 + 1] = 0
  rgba[i * 4 + 2] = 0
  rgba[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(255 - lum)))
}
await sharp(rgba, { raw: { width: g.info.width, height: g.info.height, channels: 4 } })
  .png()
  .toFile(join(root, 'assets/logo.png'))

console.log(`[icons] cropped ${width}x${height} -> public/icons/*.png + assets/logo.png`)
