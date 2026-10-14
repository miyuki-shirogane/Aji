// Central tunables and static maps.

// English model (small & fast). Swap `MODEL_ID` for a multilingual one
// (e.g. Xenova/multilingual-e5-small) with the matching task prefixes to
// support non-English queries, at ~2x the embedding cost.
export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
export const EMBED_DIM = 384
export const QUERY_PREFIX = ''
export const PASSAGE_PREFIX = ''

// Extension-root paths (relative to dist root after build).
export const WASM_DIR = 'wasm/'
export const OFFSCREEN_PATH = 'src/offscreen/offscreen.html'

// Code file extensions we will parse/index for the MVP.
export const EXT_TO_LANG: Record<string, string> = {
  '.py': 'python',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
}

// Language -> bundled grammar wasm filename.
export const GRAMMAR_FILES: Record<string, string> = {
  python: 'tree-sitter-python.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
}

// AST node types that count as a "chunk" per language.
export const NODE_TYPES: Record<string, string[]> = {
  python: ['function_definition', 'class_definition', 'decorated_definition'],
  javascript: [
    'function_declaration',
    'function_expression',
    'method_definition',
    'class_declaration',
    'arrow_function',
    'generator_function_declaration',
  ],
  typescript: [
    'function_declaration',
    'method_definition',
    'class_declaration',
    'interface_declaration',
    'arrow_function',
  ],
  tsx: [
    'function_declaration',
    'method_definition',
    'class_declaration',
    'interface_declaration',
    'arrow_function',
  ],
}

// Indexing limits.
export const MAX_FILE_BYTES = 500_000
export const MAX_FILES = 5000
export const MIN_CHUNK_CHARS = 40
export const MAX_CHUNK_CHARS = 2000
export const CHUNK_OVERLAP_CHARS = 300
export const ERR_NODE_RATIO = 0.2

// Embedding / search.
export const EMBED_MAX_CHARS = 1024
export const EMBED_BATCH = 32
export const SEARCH_LIMIT = 20 // max candidates fetched per query
export const PAGE_SIZE = 20 // results shown per page in the panel
export const MIN_SCORE = 0.2
