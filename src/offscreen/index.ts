import { EMBED_BATCH, EMBED_MAX_CHARS } from '../shared/const'
import type { OffscreenReply } from '../shared/messages'
import type { Hit, IndexFile } from '../shared/types'
import { chunkCode } from './chunker'
import { embed, getActiveDevice } from './embedder'
import { clearRepo, countChunks, getChunks, putChunks, type StoredChunk } from './store'

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

async function indexBatch(repoKey: string, commit: string, files: IndexFile[]): Promise<OffscreenReply> {
  let count = 0
  for (const f of files) {
    const raw = await chunkCode(f.lang, f.text)
    if (!raw.length) continue
    for (let i = 0; i < raw.length; i += EMBED_BATCH) {
      const slice = raw.slice(i, i + EMBED_BATCH)
      const vecs = await embed(slice.map(c => c.text.slice(0, EMBED_MAX_CHARS)))
      const stored: StoredChunk[] = slice.map((c, j) => ({
        id: `${repoKey}#${commit}#${f.path}#${c.startLine}`,
        repoKey,
        commit,
        path: f.path,
        blobSha: f.blobSha,
        lang: f.lang,
        symbol: c.symbol,
        startLine: c.startLine,
        endLine: c.endLine,
        text: c.text.slice(0, EMBED_MAX_CHARS),
        vec: vecs[j],
        dim: vecs[j].length,
      }))
      await putChunks(stored)
      count += slice.length
    }
  }
  return { ok: true, chunkCount: count, device: getActiveDevice() }
}

async function search(repoKey: string, commit: string, query: string, topN: number): Promise<OffscreenReply> {
  const [q] = await embed([query])
  const chunks = await getChunks(repoKey, commit)
  if (!chunks.length) return { ok: true, hits: [] }

  const scored = chunks.map(c => ({ c, score: dot(q, c.vec) }))
  scored.sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const hits: Hit[] = []
  for (const { c, score } of scored) {
    const key = `${c.path}#${c.symbol}`
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
          sendResponse(await indexBatch(msg.repoKey, msg.commit, msg.files))
          break
        case 'countChunks':
          sendResponse({ ok: true, chunkCount: await countChunks(msg.repoKey) })
          break
        case 'clearRepo':
          await clearRepo(msg.repoKey)
          sendResponse({ ok: true })
          break
        case 'search':
          sendResponse(await search(msg.repoKey, msg.commit, msg.query, msg.topN))
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
