// Accuracy benchmark runner for the local extension.
//   npm i -D playwright-core && npx playwright install chromium   # one-time
//   npm run build
//   node scripts/eval.mjs [repoUrl]
// Loads dist/ into Chromium, indexes the repo, runs eval/cases.json and prints
// File/Symbol accuracy + MRR. Requires a GitHub PAT (extension options) for
// repeated runs to avoid the 60 req/h anonymous rate limit.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(root, 'dist')
const REPO_URL = process.argv[2] || 'https://github.com/miyuki-shirogane/Aji'
const PROFILE = process.env.PROFILE || '/tmp/aji-eval-profile'
const CASES = JSON.parse(readFileSync(join(root, 'eval/cases.json'), 'utf8'))

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: process.env.HEADLESS !== 'false',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-first-run', '--no-default-browser-check'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
const body = () =>
  page.evaluate(() =>
    document.getElementById('aji-root')?.shadowRoot?.querySelector('.aji-body')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) || '',
  )
const scrape = () =>
  page.evaluate(() =>
    Array.from(document.getElementById('aji-root').shadowRoot.querySelectorAll('.aji-hit')).map(h => ({
      sym: (h.querySelector('.aji-sym')?.textContent || '').trim(),
      path: (h.querySelector('.aji-path')?.textContent || '').replace(/\s+L\d+.*/, '').trim(),
    })),
  )

const rows = []
try {
  await page.goto(REPO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)
  await page.keyboard.press('Meta+KeyK')
  await page.waitForTimeout(4000)
  if (await page.locator('.aji-primary').count()) {
    await page.locator('.aji-primary').click()
    for (let i = 0; i < 160; i++) {
      await page.waitForTimeout(3000)
      if (/个代码块|失败/.test(await body())) break
    }
    console.log('index:', await body())
  }

  for (const c of CASES) {
    await page.locator('.aji-input').fill(c.q)
    await page.keyboard.press('Enter')
    let hits = []
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500)
      hits = await scrape()
      if (hits.length || /没有匹配|失败/.test(await body())) break
    }
    const inFile = hits.findIndex(h => c.files.some(f => h.path.includes(f))) + 1
    const inSym =
      hits.findIndex(
        h => c.files.some(f => h.path.includes(f)) && (!c.symbol || h.sym.toLowerCase().includes(c.symbol.toLowerCase())),
      ) + 1
    rows.push({ ...c, inFile, inSym, top1: hits[0] })
  }

  const n = rows.length
  const pct = k => `${rows.filter(k).length}/${n} = ${((rows.filter(k).length / n) * 100).toFixed(0)}%`
  console.log('\n=== ' + REPO_URL + ' (n=' + n + ') ===')
  console.log('File  Top1:', pct(r => r.inFile === 1))
  console.log('File  Top5:', pct(r => r.inFile >= 1 && r.inFile <= 5))
  console.log('Symbol Top5:', pct(r => r.inSym >= 1 && r.inSym <= 5))
  console.log('File MRR:', (rows.reduce((a, r) => a + (r.inFile ? 1 / r.inFile : 0), 0) / n).toFixed(3))
  const misses = rows.filter(r => !(r.inSym >= 1 && r.inSym <= 5))
  console.log('Misses(symbol>5):', misses.map(r => `${r.q} (f${r.inFile || '-'}/s${r.inSym || '-'})`).join(' | ') || '(none)')
} finally {
  await ctx.close()
}
