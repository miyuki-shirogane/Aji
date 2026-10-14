import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { chunksFromTree } from '../src/offscreen/chunker'

const require = createRequire(import.meta.url)
const Parser = require('web-tree-sitter')

let ts: any
beforeAll(async () => {
  await Parser.init()
  ts = await Parser.Language.load(readFileSync('node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm'))
})

const parse = (src: string) => {
  const p = new Parser()
  p.setLanguage(ts)
  return p.parse(src).rootNode
}
const symbols = (src: string) => chunksFromTree(parse(src), 'typescript').map(c => c.symbol)

describe('chunksFromTree (typescript)', () => {
  const src = [
    "import x from 'y'",
    'const TABLE = { alpha: 1, beta: 2, gamma: 3, delta: 4, epsilon: 5 }',
    'export function computeTotal(items: number[]): number { return items.reduce((a, b) => a + b, 0) }',
    'const makeAdder = (base: number) => (value: number) => base + value * TABLE.alpha',
    'class Widget { render(scale: number): number { return 42 * scale } }',
    'export interface Opts { value: number; label: string }',
  ].join('\n')

  it('captures named functions, methods, classes and interfaces', () => {
    const s = symbols(src)
    expect(s).toContain('computeTotal')
    expect(s).toContain('Widget')
    expect(s).toContain('render')
    expect(s).toContain('Opts')
  })

  it('captures module-level const (incl. arrow) by variable name', () => {
    const s = symbols(src)
    expect(s).toContain('TABLE')
    expect(s).toContain('makeAdder')
  })

  it('skips imports/tiny statements and does not duplicate exported funcs', () => {
    const s = symbols(
      "import x from 'y'\nconst z = 1\nexport function computeTotal(items: number[]): number { return items.reduce((a, b) => a + b, 0) }",
    )
    expect(s).not.toContain('x')
    expect(s).not.toContain('z')
    expect(s.filter(v => v === 'computeTotal')).toHaveLength(1)
  })
})
