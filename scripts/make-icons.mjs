// Build toolbar icons from assets/icon.webp.
// The source is a black line mark on a wide white canvas; crop to the mark and
// center it on a square (white background keeps it visible on dark toolbars).
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

// 2) crop with ~12% breathing room, then fit onto a square white canvas
const pad = Math.round(Math.max(maxx - minx, maxy - miny) * 0.12)
const left = Math.max(0, minx - pad)
const top = Math.max(0, miny - pad)
const width = Math.min(W - left, maxx - minx + 2 * pad)
const height = Math.min(H - top, maxy - miny + 2 * pad)

const master = await sharp(src)
  .extract({ left, top, width, height })
  .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
  .png()
  .toBuffer()

for (const size of [16, 32, 48, 128]) {
  await sharp(master).resize(size, size).png().toFile(join(out, `icon-${size}.png`))
}
console.log(`[icons] cropped ${width}x${height} -> public/icons/icon-{16,32,48,128}.png`)
