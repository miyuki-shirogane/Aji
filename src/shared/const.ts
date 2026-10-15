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

// Code file extensions we parse/index. Grammars are lazy-loaded, so a repo only
// pays for the languages it actually contains.
export const EXT_TO_LANG: Record<string, string> = {
  '.py': 'python',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.hxx': 'cpp',
  '.cs': 'c_sharp',
  '.php': 'php',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.scala': 'scala',
  '.sc': 'scala',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.sol': 'solidity',
  '.zig': 'zig',
}

// Language -> bundled grammar wasm filename (copied from tree-sitter-wasms).
export const GRAMMAR_FILES: Record<string, string> = {
  python: 'tree-sitter-python.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  java: 'tree-sitter-java.wasm',
  c: 'tree-sitter-c.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  c_sharp: 'tree-sitter-c_sharp.wasm',
  php: 'tree-sitter-php.wasm',
  kotlin: 'tree-sitter-kotlin.wasm',
  swift: 'tree-sitter-swift.wasm',
  scala: 'tree-sitter-scala.wasm',
  bash: 'tree-sitter-bash.wasm',
  solidity: 'tree-sitter-solidity.wasm',
  zig: 'tree-sitter-zig.wasm',
}

// AST node types that count as a "chunk" per language (functions / classes /
// methods / types). Anonymous arrow functions are intentionally excluded.
export const NODE_TYPES: Record<string, string[]> = {
  python: ['function_definition', 'class_definition', 'decorated_definition'],
  javascript: [
    'function_declaration',
    'function_expression',
    'method_definition',
    'class_declaration',
    'generator_function_declaration',
  ],
  typescript: ['function_declaration', 'method_definition', 'class_declaration', 'interface_declaration'],
  tsx: ['function_declaration', 'method_definition', 'class_declaration', 'interface_declaration'],
  go: ['function_declaration', 'method_declaration', 'type_declaration'],
  rust: ['function_item', 'struct_item', 'enum_item', 'trait_item', 'impl_item'],
  java: [
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'method_declaration',
    'constructor_declaration',
  ],
  c: ['function_definition', 'struct_specifier', 'enum_specifier', 'type_definition'],
  cpp: [
    'function_definition',
    'class_specifier',
    'struct_specifier',
    'enum_specifier',
    'namespace_definition',
    'template_declaration',
  ],
  c_sharp: [
    'class_declaration',
    'interface_declaration',
    'struct_declaration',
    'enum_declaration',
    'method_declaration',
    'constructor_declaration',
    'record_declaration',
  ],
  php: ['function_definition', 'class_declaration', 'interface_declaration', 'trait_declaration', 'method_declaration'],
  kotlin: ['function_declaration', 'class_declaration', 'object_declaration'],
  swift: ['function_declaration', 'class_declaration', 'protocol_declaration', 'protocol_function_declaration'],
  scala: ['function_definition', 'class_definition', 'object_definition', 'trait_definition'],
  bash: ['function_definition'],
  solidity: ['contract_declaration', 'function_definition'],
  zig: ['function_declaration'],
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
