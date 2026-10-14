// Copies runtime wasm assets from node_modules into public/wasm so Vite serves
// them from the extension root (referenced via chrome.runtime.getURL).
import { mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'wasm')
const ort = join(out, 'ort')

rmSync(out, { recursive: true, force: true })
mkdirSync(ort, { recursive: true })

const copies = [
  ['node_modules/web-tree-sitter/web-tree-sitter.wasm', 'tree-sitter.wasm'],
  ['node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm', 'tree-sitter-python.wasm'],
  ['node_modules/tree-sitter-wasms/out/tree-sitter-javascript.wasm', 'tree-sitter-javascript.wasm'],
  ['node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm', 'tree-sitter-typescript.wasm'],
  ['node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm', 'tree-sitter-tsx.wasm'],
]

for (const [src, dst] of copies) {
  copyFileSync(join(root, src), join(out, dst))
}

const ortDir = join(root, 'node_modules/onnxruntime-web/dist')
let ortCount = 0
for (const f of readdirSync(ortDir)) {
  if (/^ort-wasm-.*\.(wasm|mjs)$/.test(f)) {
    copyFileSync(join(ortDir, f), join(ort, f))
    ortCount++
  }
}

console.log(`[assets] copied ${copies.length} tree-sitter files and ${ortCount} onnxruntime files -> public/wasm`)
