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
      const vecs = await embed(slice.map(c => PASSAGE_PREFIX + c.text.slice(0, EMBED_MAX_CHARS)))
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

  const scored = chunks.map(c => ({ c, score: dot(q, c.vec) }))
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
