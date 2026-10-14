import { EMBED_BATCH, EMBED_MAX_CHARS, PASSAGE_PREFIX, QUERY_PREFIX } from '../shared/const'
import type { OffscreenReply } from '../shared/messages'
import type { Hit, IndexFile } from '../shared/types'
import { chunkCode } from './chunker'
import { embed, getActiveDevice, getEmbedMs, getLoadMs } from './embedder'
import { clearRepo, countChunks, deleteFiles, getChunksByRepo, listFileShas, putFileChunks, type StoredChunk } from './store'

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

function snippet(text: string): string {
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length > 220 ? s.slice(0, 220) + '…' : s
}

function dedupKey(symbol: string, text: string): string {
  return `${symbol}|${text.replace(/\s+/g, ' ').slice(0, 300)}`
}

// --- lexical side of the hybrid ranker --------------------------------
const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'for', 'in', 'on', 'with', 'from', 'by', 'is', 'are',
  'be', 'this', 'that', 'it', 'as', 'at', 'we', 'you', 'do', 'does', 'how', 'what', 'where', 'when',
  'into', 'them', 'they', 'then', 'than', 'use', 'used', 'using', 'get', 'gets', 'set', 'file',
])

function expandFold(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-./]+/g, ' ').toLowerCase()
}

function tokens(s: string): string[] {
  return expandFold(s).split(/[^a-z0-9]+/).filter(t => t.length >= 3)
}

function queryTerms(q: string): string[] {
  return [...new Set(tokens(q).filter(t => !STOP.has(t)))]
}

const COS_WEIGHT = 0.6
const LEX_WEIGHT = 0.4


async function indexBatch(repoKey: string, files: IndexFile[]): Promise<OffscreenReply> {
  let count = 0
  for (const f of files) {
    const raw = await chunkCode(f.lang, f.text)
    if (!raw.length) {
      await putFileChunks(repoKey, f, [])
      continue
    }
    const stored: StoredChunk[] = []
    for (let i = 0; i < raw.length; i += EMBED_BATCH) {
      const slice = raw.slice(i, i + EMBED_BATCH)
      // Inject the symbol name so the vector is aware of the function name.
      const vecs = await embed(slice.map(c => (PASSAGE_PREFIX + (c.symbol ? c.symbol + '\n' : '') + c.text).slice(0, EMBED_MAX_CHARS)))
      for (let j = 0; j < slice.length; j++) {
        const c = slice[j]
        stored.push({
          id: `${repoKey}#${f.blobSha}#${c.startLine}`,
          repoKey,
          blobSha: f.blobSha,
          path: f.path,
          lang: f.lang,
          symbol: c.symbol,
          startLine: c.startLine,
          endLine: c.endLine,
          text: c.text.slice(0, EMBED_MAX_CHARS),
          vec: vecs[j],
          dim: vecs[j].length,
        })
      }
    }
    await putFileChunks(repoKey, f, stored)
    count += stored.length
  }
  return { ok: true, chunkCount: count, device: getActiveDevice(), embedMs: getEmbedMs(), loadMs: getLoadMs() }
}

async function search(repoKey: string, query: string, topN: number): Promise<OffscreenReply> {
  const [q] = await embed([QUERY_PREFIX + query])
  const chunks = await getChunksByRepo(repoKey)
  if (!chunks.length) return { ok: true, hits: [] }

  const terms = queryTerms(query)
  const tokenSets = chunks.map(c => new Set(tokens(`${c.symbol} ${c.path} ${c.text}`)))

  const cos = chunks.map(c => dot(q, c.vec))
  const lex = chunks.map(() => 0)
  if (terms.length) {
    const N = chunks.length
    const df = new Map<string, number>()
    for (const t of terms) {
      let n = 0
      for (const s of tokenSets) if (s.has(t)) n++
      df.set(t, n)
    }
    for (let i = 0; i < chunks.length; i++) {
      let s = 0
      for (const t of terms) {
        if (tokenSets[i].has(t)) {
          const d = df.get(t) || 0
          s += Math.log(1 + (N - d + 0.5) / (d + 0.5))
        }
      }
      lex[i] = s
    }
  }

  let cosMax = 0
  let lexMax = 0
  for (let i = 0; i < chunks.length; i++) {
    if (cos[i] > cosMax) cosMax = cos[i]
    if (lex[i] > lexMax) lexMax = lex[i]
  }

  const scored = chunks.map((c, i) => {
    const cosN = cosMax > 0 ? Math.max(0, cos[i]) / cosMax : 0
    const lexN = lexMax > 0 ? lex[i] / lexMax : 0
    const score = terms.length ? COS_WEIGHT * cosN + LEX_WEIGHT * lexN : cos[i]
    return { c, score }
  })
  scored.sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const hits: Hit[] = []
  for (const { c, score } of scored) {
    const key = dedupKey(c.symbol, c.text)
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({
      path: c.path,
      symbol: c.symbol || c.path.split('/').pop() || c.path,
      lang: c.lang,
      startLine: c.startLine,
      endLine: c.endLine,
      score,
      snippet: snippet(c.text),
    })
    if (hits.length >= topN) break
  }
  return { ok: true, hits }
}

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return false
  ;(async () => {
    try {
      switch (msg.op) {
        case 'indexBatch':
          sendResponse(await indexBatch(msg.repoKey, msg.files))
          break
        case 'listFiles':
          sendResponse({ ok: true, blobShas: await listFileShas(msg.repoKey) })
          break
        case 'deleteFiles':
          await deleteFiles(msg.repoKey, msg.blobShas || [])
          sendResponse({ ok: true })
          break
        case 'countChunks':
          sendResponse({ ok: true, chunkCount: await countChunks(msg.repoKey) })
          break
        case 'clearRepo':
          await clearRepo(msg.repoKey)
          sendResponse({ ok: true })
          break
        case 'search':
          sendResponse(await search(msg.repoKey, msg.query, msg.topN))
          break
        default:
          sendResponse({ ok: false, error: `unknown op ${msg.op}` })
      }
    } catch (e: any) {
      sendResponse({ ok: false, error: String(e?.message || e) })
    }
  })()
  return true
})
