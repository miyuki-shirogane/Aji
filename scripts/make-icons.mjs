// Rasterize assets/icon.svg into the PNG sizes Chrome needs.
//   node scripts/make-icons.mjs   (requires devDependencies: sharp)
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'assets/icon.svg')
const out = join(root, 'public/icons')
mkdirSync(out, { recursive: true })

const sharp = (await import('sharp')).default
for (const size of [16, 32, 48, 128]) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(join(out, `icon-${size}.png`))
}
console.log('[icons] wrote icon-{16,32,48,128}.png to public/icons')
