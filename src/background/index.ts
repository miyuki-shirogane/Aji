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
      justification: '在本机运行 tree-sitter 解析与本地 embedding 推理（不上传代码）。',
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
  if (indexing) throw new Error('已有索引任务在进行中')
  indexing = true
  const jobId = crypto.randomUUID()
  const repoKey = repoKeyOf(owner, repo)
  try {
    const pat = await getPat()

    progress(jobId, 'resolve', 0, 1, '解析分支…')
    const commit = await resolveCommit(owner, repo, ref, pat)

    progress(jobId, 'tree', 0, 1, '拉取文件树…')
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
      progress(jobId, 'prune', 0, 1, `清理 ${removed.length} 个已删除文件…`)
      await callOffscreen({ target: 'offscreen', op: 'deleteFiles', repoKey, blobShas: removed })
    }

    const pending = target.filter(b => !existing.has(b.sha)).slice(0, MAX_FILES)
    let added = 0
    let device = ''
    const tEmbed = Date.now()

    if (pending.length) {
      progress(jobId, 'download', 0, 1, `下载源码（新增/变更 ${pending.length} 个文件）…`)
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
        const eta = remain != null ? `，约剩 ${remain}s` : ''
        progress(jobId, 'parse', i, files.length, `解析与向量化 ${Math.min(i + BATCH, files.length)}/${files.length} 文件（${device || '…'}${eta}）`)
        const r = await callOffscreen({ target: 'offscreen', op: 'indexBatch', repoKey, files: batch })
        if (!r.ok) throw new Error(r.error || '解析/向量化失败')
        if (r.device) device = r.device
        added += r.chunkCount ?? 0
      }
    } else {
      progress(jobId, 'parse', 0, 0, '内容无变化，无需重新向量化')
    }

    const countRes = await callOffscreen({ target: 'offscreen', op: 'countChunks', repoKey })
    const total = countRes.chunkCount ?? 0
    await chrome.storage.local.set({
      [metaKeyOf(owner, repo)]: { commit, modelId: MODEL_ID, chunkCount: total, updatedAt: Date.now() },
    })

    const secs = Math.round((Date.now() - tEmbed) / 1000)
    const msg = pending.length
      ? `完成：新增/更新 ${added} 块，共 ${total} 块（${device || 'n/a'}，用时 ${secs}s）`
      : `索引已最新：共 ${total} 块（用时 ${secs}s）`
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
