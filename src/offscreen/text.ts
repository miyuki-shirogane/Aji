import { CHUNK_OVERLAP_CHARS, MAX_CHUNK_CHARS, MIN_CHUNK_CHARS } from '../shared/const'

export interface RawChunk {
  symbol: string
  startLine: number
  endLine: number
  text: string
}

export function countLines(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++
  return n
}

/**
 * Split `text` into windows of at most `max` chars, preferring to break on a
 * newline, with `overlap` chars of context between consecutive windows. Line
 * numbers are 1-based and relative to `startRow` (0-based row of the text).
 */
export function splitIntoWindows(
  text: string,
  startRow: number,
  symbol: string,
  opts: { max?: number; overlap?: number } = {},
): RawChunk[] {
  const max = opts.max ?? MAX_CHUNK_CHARS
  const overlap = opts.overlap ?? CHUNK_OVERLAP_CHARS
  const out: RawChunk[] = []
  let offset = 0
  let lineOffset = 0
  const n = text.length

  while (offset < n) {
    let end = Math.min(offset + max, n)
    if (end < n) {
      const nl = text.lastIndexOf('\n', end)
      if (nl > offset + max * 0.5) end = nl
    }
    const piece = text.slice(offset, end)
    const startLine = startRow + lineOffset + 1
    out.push({
      symbol,
      startLine,
      endLine: startLine + countLines(piece),
      text: piece,
    })
    const windowLen = end - offset
    const ov = windowLen > overlap ? overlap : 0
    const consumed = Math.max(1, windowLen - ov)
    lineOffset += countLines(text.slice(offset, offset + consumed))
    offset += consumed
  }
  return out
}

/** Fixed-size fallback chunking for files without an AST (or parse failure). */
export function fixedChunks(code: string): RawChunk[] {
  if (code.length < MIN_CHUNK_CHARS) return []
  return splitIntoWindows(code, 0, '')
}
