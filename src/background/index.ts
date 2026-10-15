import { EXT_TO_LANG, MAX_FILE_BYTES, MAX_FILES, MODEL_ID, OFFSCREEN_PATH, SEARCH_LIMIT } from '../shared/const'
import { broadcast } from '../shared/messages'
import type { BgRequest, OffscreenReply, OffscreenRequest } from '../shared/messages'
import type { IndexFile, IndexProgress, RepoState } from '../shared/types'
import { extOf, fetchSourcesZip, fetchTree, getPat, resolveCommit } from './github'
import { isIgnoredPath } from './filter'

const repoKeyOf = (o: string, r: string) => `${o}/${r}`
const metaKeyOf = (o: string, r: string) => `idx:${o}/${r}`

let indexing = false

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(OFFSCREEN_PATH),
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run tree-sitter parsing and local embedding inference on-device (code is never uploaded).',
    })
  } catch (e) {
    if (!/single offscreen document|already exists/i.test(String(e))) throw e
  }
}

async function callOffscreen(req: OffscreenRequest): Promise<OffscreenReply> {
  await ensureOffscreen()
  let lastErr: unknown
  for (let i = 0; i < 6; i++) {
    try {
      return await chrome.runtime.sendMessage(req)
    } catch (e) {
      lastErr = e
      await new Promise(r => setTimeout(r, 300))
    }
  }
  throw lastErr
}

function progress(jobId: string, phase: IndexProgress['phase'], done: number, total: number, message: string) {
  const payload: IndexProgress = { jobId, phase, done, total, message }
  broadcast({ to: 'content', type: 'PROGRESS', progress: payload })
}

async function getState(owner: string, repo: string, ref: string): Promise<RepoState> {
  const pat = await getPat()
  const commit = await resolveCommit(owner, repo, ref, pat)
  const key = metaKeyOf(owner, repo)
  const meta = (await chrome.storage.local.get(key))[key]
  const countRes = await callOffscreen({ target: 'offscreen', op: 'countChunks', repoKey: repoKeyOf(owner, repo) }).catch(
    () => ({ ok: false }) as OffscreenReply,
  )
  const indexed = !!meta && meta.commit === commit && meta.modelId === MODEL_ID
  return {
    repoKey: repoKeyOf(owner, repo),
    ref,
    commit,
    indexed,
    stale: !!meta && !indexed,
    chunkCount: countRes.chunkCount ?? 0,
    modelId: MODEL_ID,
  }
}

async function startIndex(owner: string, repo: string, ref: string) {
  if (indexing) throw new Error('An indexing job is already running')
  indexing = true
  const jobId = crypto.randomUUID()
  const repoKey = repoKeyOf(owner, repo)
  try {
    const pat = await getPat()

    progress(jobId, 'resolve', 0, 1, 'Resolving ref…')
    const commit = await resolveCommit(owner, repo, ref, pat)

    progress(jobId, 'tree', 0, 1, 'Fetching file tree…')
    const allBlobs = await fetchTree(owner, repo, commit, pat)
    const target = allBlobs.filter(
      b => b.size > 0 && b.size <= MAX_FILE_BYTES && EXT_TO_LANG[extOf(b.path)] && !isIgnoredPath(b.path),
    )

    // Incremental: skip files whose content (blobSha) is already indexed,
    // and drop chunks for files that no longer exist in the tree.
    const targetShas = new Set(target.map(b => b.sha))
    const listed = await callOffscreen({ target: 'offscreen', op: 'listFiles', repoKey })
    const existing = new Set(listed.blobShas || [])

    const removed = [...existing].filter(sha => !targetShas.has(sha))
    if (removed.length) {
      progress(jobId, 'prune', 0, 1, `Removing ${removed.length} deleted files…`)
      await callOffscreen({ target: 'offscreen', op: 'deleteFiles', repoKey, blobShas: removed })
    }

    const pending = target.filter(b => !existing.has(b.sha)).slice(0, MAX_FILES)
    let added = 0
    let device = ''
    let embedMs = 0
    let loadMs = 0
    const tEmbed = Date.now()

    if (pending.length) {
      progress(jobId, 'download', 0, 1, `Downloading sources (${pending.length} new/changed files)…`)
      // Use the resolved commit sha (not the branch name) so refs with "/" and
      // root pages without an explicit ref both work.
      const treePaths = new Set(allBlobs.map(b => b.path))
      const sources = await fetchSourcesZip(owner, repo, commit, treePaths, MAX_FILE_BYTES, pat)
      const files: IndexFile[] = []
      for (const b of pending) {
        const text = sources.get(b.path)
        if (text == null) continue
        files.push({ path: b.path, blobSha: b.sha, lang: EXT_TO_LANG[extOf(b.path)], text })
      }

      const BATCH = 25
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH)
        const remain = i > 0 ? Math.round((((Date.now() - tEmbed) / i) * (files.length - i)) / 1000) : null
        const eta = remain != null ? `, ~${remain}s left` : ''
        progress(jobId, 'parse', i, files.length, `Indexing ${Math.min(i + BATCH, files.length)}/${files.length} files (${device || '…'}${eta})`)
        const r = await callOffscreen({ target: 'offscreen', op: 'indexBatch', repoKey, files: batch })
        if (!r.ok) throw new Error(`embed failed: ${r.error || 'unknown'}`)
        if (r.device) device = r.device
        embedMs = r.embedMs ?? embedMs
        loadMs = r.loadMs ?? loadMs
        added += r.chunkCount ?? 0
      }
    } else {
      progress(jobId, 'parse', 0, 0, 'No changes — nothing to re-embed')
    }

    const countRes = await callOffscreen({ target: 'offscreen', op: 'countChunks', repoKey })
    const total = countRes.chunkCount ?? 0
    await chrome.storage.local.set({
      [metaKeyOf(owner, repo)]: { commit, modelId: MODEL_ID, chunkCount: total, updatedAt: Date.now() },
    })

    const secs = Math.round((Date.now() - tEmbed) / 1000)
    if (added) console.log(`[aji] embed-only ${(embedMs / 1000).toFixed(1)}s for ${added} chunks (${(embedMs / Math.max(1, added)).toFixed(0)}ms/chunk), model load ${(loadMs / 1000).toFixed(1)}s, device ${device}`)
    const msg = pending.length
      ? `Done: +${added} chunks, ${total} total (${device || 'n/a'}, ${secs}s)`
      : `Up to date: ${total} chunks (${secs}s)`
    progress(jobId, 'done', 1, 1, msg)
    broadcast({ to: 'content', type: 'INDEX_RESULT', ok: true, chunkCount: total, device })
    return { ok: true, chunkCount: total, commit, device, added, pending: pending.length }
  } catch (e) {
    progress(jobId, 'error', 1, 1, String(e))
    broadcast({ to: 'content', type: 'INDEX_RESULT', ok: false, chunkCount: 0, error: String(e) })
    throw e
  } finally {
    indexing = false
  }
}

async function doSearch(owner: string, repo: string, ref: string, query: string) {
  const pat = await getPat()
  const commit = await resolveCommit(owner, repo, ref, pat)
  const key = metaKeyOf(owner, repo)
  const meta = (await chrome.storage.local.get(key))[key]
  if (!meta || meta.commit !== commit || meta.modelId !== MODEL_ID) return { ok: true, needIndex: true, hits: [] }
  const r = await callOffscreen({ target: 'offscreen', op: 'search', repoKey: repoKeyOf(owner, repo), query, topN: SEARCH_LIMIT })
  return { ...r, commit }
}

async function handle(msg: BgRequest) {
  switch (msg.type) {
    case 'GET_STATE':
      return getState(msg.owner, msg.repo, msg.ref)
    case 'START_INDEX':
      return startIndex(msg.owner, msg.repo, msg.ref)
    case 'SEARCH':
      return doSearch(msg.owner, msg.repo, msg.ref, msg.query)
    default:
      return { ok: false, error: 'unknown request' }
  }
}

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (!msg || msg.to !== 'bg') return false
  handle(msg as BgRequest)
    .then(sendResponse)
    .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }))
  return true
})
