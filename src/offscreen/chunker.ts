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
      const mod = await import('web-tree-sitter')
      ParserCtor = mod.Parser
      await ParserCtor.init({ locateFile: () => chrome.runtime.getURL(WASM_DIR + 'tree-sitter.wasm') })
    })()
  }
  return initPromise
}

async function getLanguage(lang: string): Promise<any | null> {
  if (!GRAMMAR_FILES[lang]) return null
  await ensureInit()
  if (langCache.has(lang)) return langCache.get(lang)
  const mod = await import('web-tree-sitter')
  const url = chrome.runtime.getURL(WASM_DIR + GRAMMAR_FILES[lang])
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  const language = await mod.Language.load(bytes)
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

    const types = NODE_TYPES[lang] || []
    const nodes = types.length ? root.descendantsOfType(types) : []
    const chunks: RawChunk[] = []
    for (const node of nodes) {
      if (!node.isNamed) continue
      const text = node.text
      if (text.length < MIN_CHUNK_CHARS) continue
      const symbol = symbolOf(node)
      if (text.length > MAX_CHUNK_CHARS) {
        chunks.push(...splitIntoWindows(text, node.startPosition.row, symbol))
      } else {
        chunks.push({ symbol, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, text })
      }
    }
    return chunks.length ? chunks : fixedChunks(code)
  } catch (e) {
    console.warn('[aji] parse failed, fallback', e)
    return fixedChunks(code)
  }
}
