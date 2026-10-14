// Build toolbar icons from assets/icon.svg.
// The mark is a black line drawing; on a dark toolbar that is invisible, so we
// composite it over a white rounded square (visible on both light and dark
// themes) and rasterize to the PNG sizes Chrome needs.
//   node scripts/make-icons.mjs   (requires devDependencies: sharp)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcFile = join(root, 'assets/icon.svg')
const appFile = join(root, 'assets/icon-app.svg')
const out = join(root, 'public/icons')
mkdirSync(out, { recursive: true })

const svg = readFileSync(srcFile, 'utf8')
const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
if (!m) throw new Error('assets/icon.svg: could not parse <svg>')
const inner = m[1]
const viewBox = (svg.match(/viewBox="([^"]*)"/) || [])[1] || '0 0 512 512'

const appSvg = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="496" height="496" rx="112" fill="#ffffff"/>
  ${inner}
</svg>
`
writeFileSync(appFile, appSvg)

const sharp = (await import('sharp')).default
for (const size of [16, 32, 48, 128]) {
  await sharp(appFile, { density: 384 }).resize(size, size).png().toFile(join(out, `icon-${size}.png`))
}
console.log('[icons] wrote assets/icon-app.svg and icon-{16,32,48,128}.png')
