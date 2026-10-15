import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { chunksFromTree } from '../src/offscreen/chunker'
import { GRAMMAR_FILES } from '../src/shared/const'

const require = createRequire(import.meta.url)
const Parser = require('web-tree-sitter')

// A representative snippet per language + the function/class name we expect to
// be extracted as a chunk symbol.
const SAMPLES: Record<string, { code: string; name: string }> = {
  python: { code: 'def compute_total(items):\n    total = 0\n    for x in items:\n        total += x\n    return total\n', name: 'compute_total' },
  javascript: { code: 'function computeTotal(items) { return items.reduce((a, b) => a + b, 0) }\n', name: 'computeTotal' },
  typescript: { code: 'export function computeTotal(items: number[]): number { return items.reduce((a, b) => a + b, 0) }\n', name: 'computeTotal' },
  tsx: { code: 'export function Widget(props: { value: number }) { return <div>{props.value}</div> }\n', name: 'Widget' },
  go: { code: 'package main\nfunc computeTotal(items []int) int { s := 0; for _, x := range items { s += x }; return s }\n', name: 'computeTotal' },
  rust: { code: 'fn compute_total(items: &[i32]) -> i32 { items.iter().sum() }\n', name: 'compute_total' },
  java: { code: 'class Calc { public int computeTotal(int[] items) { int s = 0; for (int x : items) s += x; return s; } }\n', name: 'Calc' },
  c: { code: 'int compute_total(int *items, int n) { int s = 0; for (int i = 0; i < n; i++) s += items[i]; return s; }\n', name: 'compute_total' },
  cpp: { code: 'int computeTotal(const std::vector<int>& items) { int s = 0; for (int x : items) s += x; return s; }\n', name: 'computeTotal' },
  c_sharp: { code: 'class Calc { public int ComputeTotal(int[] items) { int s = 0; foreach (var x in items) s += x; return s; } }\n', name: 'Calc' },
  php: { code: '<?php\nfunction compute_total(array $items) { $s = 0; foreach ($items as $x) { $s += $x; } return $s; }\n', name: 'compute_total' },
  kotlin: { code: 'fun computeTotal(items: List<Int>): Int { var s = 0; for (x in items) { s += x }; return s }\n', name: 'computeTotal' },
  swift: { code: 'func computeTotal(_ items: [Int]) -> Int { return items.reduce(0, +) }\n', name: 'computeTotal' },
  scala: { code: 'def computeTotal(items: List[Int]): Int = items.foldLeft(0)(_ + _)\n', name: 'computeTotal' },
  bash: { code: 'compute_total() {\n  local total=0\n  for x in "$@"; do total=$((total + x)); done\n  echo "$total"\n}\n', name: 'compute_total' },
  solidity: { code: 'contract Calc { function computeTotal(uint[] memory items) public pure returns (uint) { uint s = 0; for (uint i = 0; i < items.length; i++) { s += items[i]; } return s; } }\n', name: 'Calc' },
  zig: { code: 'fn computeTotal(items: []const i32) i32 { var s: i32 = 0; for (items) |x| { s += x; } return s; }\n', name: 'computeTotal' },
}

// Single test that walks every grammar once (keeps web-tree-sitter happy and
// gives one clear diff if a language regresses).
describe('bundled grammars', () => {
  it('parse & chunk a sample for every supported language', async () => {
    await Parser.init()
    const missingSamples = Object.keys(GRAMMAR_FILES).filter(l => !SAMPLES[l])
    const failures: string[] = []

    for (const [lang, sample] of Object.entries(SAMPLES)) {
      const wasm = readFileSync(`node_modules/tree-sitter-wasms/out/${GRAMMAR_FILES[lang]}`)
      const language = await Parser.Language.load(wasm)
      const parser = new Parser()
      parser.setLanguage(language)
      const tree = parser.parse(sample.code)
      const symbols = chunksFromTree(tree.rootNode, lang).map(c => c.symbol)
      tree.delete?.()
      parser.delete?.()
      if (!symbols.includes(sample.name)) failures.push(`${lang}: expected "${sample.name}", got [${symbols.join(', ')}]`)
    }

    expect(missingSamples, 'GRAMMAR_FILES without a test sample').toEqual([])
    expect(failures, 'grammar chunking').toEqual([])
  })
})
