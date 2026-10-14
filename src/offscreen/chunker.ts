import {
  ERR_NODE_RATIO,
  GRAMMAR_FILES,
  MAX_CHUNK_CHARS,
  MIN_CHUNK_CHARS,
  NODE_TYPES,
  WASM_DIR,
} from '../shared/const'
import { fixedChunks, splitIntoWindows, type RawChunk } from './text'

export type { RawChunk }

let ParserCtor: any = null
let initPromise: Promise<void> | null = null
const langCache = new Map<string, any>()

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const mod: any = await import('web-tree-sitter')
      // v0.20.x exports the Parser constructor (Language is attached after init()).
      ParserCtor = mod.default ?? mod
      await ParserCtor.init({ locateFile: () => chrome.runtime.getURL(WASM_DIR + 'tree-sitter.wasm') })
    })()
  }
  return initPromise
}

async function getLanguage(lang: string): Promise<any | null> {
  if (!GRAMMAR_FILES[lang]) return null
  await ensureInit()
  if (langCache.has(lang)) return langCache.get(lang)
  const url = chrome.runtime.getURL(WASM_DIR + GRAMMAR_FILES[lang])
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  const language = await ParserCtor.Language.load(bytes)
  langCache.set(lang, language)
  return language
}

function countNodes(root: any): number {
  let n = 0
  const stack: any[] = [root]
  while (stack.length) {
    const cur = stack.pop()
    n++
    const kids = cur.children
    for (let i = 0; i < kids.length; i++) stack.push(kids[i])
  }
  return n
}

function symbolOf(node: any): string {
  const named = node.childForFieldName?.('name')
  if (named) return named.text
  for (const c of node.namedChildren || []) {
    if (/identifier/.test(c.type)) return c.text
  }
  return (node.text.split('\n')[0] || '').trim().slice(0, 80) || node.type
}

// Symbol for a module-level declaration: variable/const name where possible,
// so `const foo = () => {}` and `const TABLE = [...]` become named chunks.
function moduleSymbol(node: any): string {
  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
    const d = (node.namedChildren || []).find((c: any) => c.type === 'variable_declarator')
    const nameNode = d?.childForFieldName?.('name')
    if (nameNode) return nameNode.text
  }
  const named = node.childForFieldName?.('name')
  if (named) return named.text
  return (node.text.split('\n')[0] || '').trim().slice(0, 80) || node.type
}

const SKIP_TOP_TYPES = new Set(['import_statement', 'comment', 'hash_bang_line', 'import_export_clause'])

// Toggle for the module-level chunk pass (const/enum/etc.).
const MODULE_CHUNKS_ENABLED = true

function pushNode(chunks: RawChunk[], node: any, symbol: string) {
  const text = node.text
  if (text.length < MIN_CHUNK_CHARS) return
  if (text.length > MAX_CHUNK_CHARS) {
    chunks.push(...splitIntoWindows(text, node.startPosition.row, symbol))
  } else {
    chunks.push({ symbol, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, text })
  }
}

/**
 * Pure: turn a parsed tree into chunks (function/class/method/interface nodes
 * plus module-level declarations). Kept free of chrome/wasm so it is testable.
 */
export function chunksFromTree(root: any, lang: string): RawChunk[] {
  const types = NODE_TYPES[lang] || []
  const chunks: RawChunk[] = []

  for (const node of types.length ? root.descendantsOfType(types) : []) {
    if (!node.isNamed) continue
    pushNode(chunks, node, symbolOf(node))
  }

  for (const node of MODULE_CHUNKS_ENABLED ? root.namedChildren : []) {
    if (SKIP_TOP_TYPES.has(node.type)) continue
    let inner = node
    if (node.type === 'export_statement') {
      inner = node.childForFieldName?.('declaration') || node
    }
    if (types.includes(inner.type)) continue // already captured above
    pushNode(chunks, node, moduleSymbol(inner))
  }

  return chunks
}

export async function chunkCode(lang: string, code: string): Promise<RawChunk[]> {
  if (!code || code.length < MIN_CHUNK_CHARS) return []

  let language: any = null
  try {
    language = await getLanguage(lang)
  } catch (e) {
    console.warn('[aji] grammar load failed', lang, e)
    language = null
  }
  if (!language) return fixedChunks(code)

  try {
    const parser = new ParserCtor()
    parser.setLanguage(language)
    const tree = parser.parse(code)
    if (!tree) return fixedChunks(code)
    const root = tree.rootNode
    const total = countNodes(root)
    const errors = root.descendantsOfType('ERROR').length
    if (total > 0 && errors / total > ERR_NODE_RATIO) return fixedChunks(code)

    const chunks = chunksFromTree(root, lang)
    return chunks.length ? chunks : fixedChunks(code)
  } catch (e) {
    console.warn('[aji] parse failed, fallback', e)
    return fixedChunks(code)
  }
}

