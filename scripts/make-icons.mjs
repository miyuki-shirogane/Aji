// Build icons from assets/icon.webp (a black line mark on a wide white canvas).
// Output: cropped mark on a rounded white square, for both the toolbar
// (public/icons/*.png) and the README (assets/logo.png).
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
const RADIUS = Math.round(SIZE * 0.225) // rounded-corner radius

// 1) non-white content bounding box
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

// 2) crop the mark with ~18% breathing room (smaller mark on a padded tile)
const pad = Math.round(Math.max(maxx - minx, maxy - miny) * 0.18)
const left = Math.max(0, minx - pad)
const top = Math.max(0, miny - pad)
const width = Math.min(W - left, maxx - minx + 2 * pad)
const height = Math.min(H - top, maxy - miny + 2 * pad)
const cropped = await sharp(src).extract({ left, top, width, height }).png().toBuffer()

// 3) the mark on a transparent background (white -> alpha), sized to fit inside
const g = await sharp(cropped)
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const mark = Buffer.alloc(SIZE * SIZE * 4)
for (let i = 0; i < SIZE * SIZE; i++) {
  const lum = 0.299 * g.data[i * 3] + 0.587 * g.data[i * 3 + 1] + 0.114 * g.data[i * 3 + 2]
  mark[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(255 - lum)))
}
const markPng = await sharp(mark, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer()

// 4) rounded white square + mark
const baseSvg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="#ffffff"/></svg>`
const base = await sharp(Buffer.from(baseSvg)).png().toBuffer()
const master = await sharp(base).composite([{ input: markPng, gravity: 'center' }]).png().toBuffer()

for (const size of [16, 32, 48, 128]) {
  await sharp(master).resize(size, size).png().toFile(join(out, `icon-${size}.png`))
}
await sharp(master).resize(256, 256).png().toFile(join(root, 'assets/logo.png'))

console.log(`[icons] cropped ${width}x${height} -> public/icons/*.png + assets/logo.png (rounded white)`)
