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

// Manual tree walk (web-tree-sitter 0.20.x's descendantsOfType is unreliable
// after loading several languages in one context).
function treeStats(root: any): { total: number; errors: number } {
  let total = 0
  let errors = 0
  const stack: any[] = [root]
  while (stack.length) {
    const cur = stack.pop()
    total++
    if (cur.type === 'ERROR') errors++
    const kids = cur.children
    for (let i = 0; i < kids.length; i++) stack.push(kids[i])
  }
  return { total, errors }
}

function collectNodes(root: any, types: Set<string>): any[] {
  const out: any[] = []
  const stack: any[] = [root]
  while (stack.length) {
    const cur = stack.pop()
    if (cur !== root && cur.isNamed && types.has(cur.type)) out.push(cur)
    const kids = cur.namedChildren || []
    for (let i = 0; i < kids.length; i++) stack.push(kids[i])
  }
  return out
}

// First name-like identifier in a subtree, skipping parameter/body subtrees
// (used for C/C++ where the name lives inside the declarator chain).
const NAME_TYPES = /^(identifier|type_identifier|field_identifier|property_identifier|simple_identifier|name|constant|word)$/
const SKIP_SUBTREE = new Set(['parameter_list', 'parameter_declaration', 'formal_parameters', 'compound_statement', 'block', 'function_body', 'class_body', 'declaration_list'])

function firstIdentifier(node: any, depth = 0): string | null {
  if (!node || depth > 8) return null
  if (NAME_TYPES.test(node.type)) return node.text
  if (SKIP_SUBTREE.has(node.type)) return null
  for (const c of node.namedChildren || []) {
    const r = firstIdentifier(c, depth + 1)
    if (r) return r
  }
  return null
}

function symbolOf(node: any): string {
  const named = node.childForFieldName?.('name')
  if (named) return named.text
  const decl = node.childForFieldName?.('declarator')
  if (decl) {
    const r = firstIdentifier(decl)
    if (r) return r
  }
  return firstIdentifier(node) || (node.text.split('\n')[0] || '').trim().slice(0, 80) || node.type
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
  const types = new Set(NODE_TYPES[lang] || [])
  const chunks: RawChunk[] = []

  for (const node of collectNodes(root, types)) {
    pushNode(chunks, node, symbolOf(node))
  }

  for (const node of MODULE_CHUNKS_ENABLED ? root.namedChildren : []) {
    if (SKIP_TOP_TYPES.has(node.type)) continue
    let inner = node
    if (node.type === 'export_statement') {
      inner = node.childForFieldName?.('declaration') || node
    }
    if (types.has(inner.type)) continue // already captured above
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

  const parser = new ParserCtor()
  try {
    parser.setLanguage(language)
    const tree = parser.parse(code)
    if (!tree) return fixedChunks(code)
    try {
      const root = tree.rootNode
      const { total, errors } = treeStats(root)
      if (total > 0 && errors / total > ERR_NODE_RATIO) return fixedChunks(code)

      const chunks = chunksFromTree(root, lang)
      return chunks.length ? chunks : fixedChunks(code)
    } finally {
      // web-tree-sitter keeps the syntax tree in wasm memory; without this the
      // heap grows across files (and can corrupt later parses).
      tree.delete?.()
    }
  } catch (e) {
    console.warn('[aji] parse failed, fallback', e)
    return fixedChunks(code)
  } finally {
    parser.delete?.()
  }
}

