import { unzipSync } from 'fflate'

export const API = 'https://api.github.com'

export function extOf(path: string): string {
  const i = path.lastIndexOf('.')
  const j = path.lastIndexOf('/')
  if (i < 0 || i < j) return ''
  return path.slice(i).toLowerCase()
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export async function getPat(): Promise<string | undefined> {
  const { pat } = await chrome.storage.local.get('pat')
  return pat || undefined
}

function headers(pat?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (pat) h.Authorization = `Bearer ${pat}`
  return h
}

/** fetch with primary/secondary rate-limit aware backoff. */
export async function ghFetch(url: string, pat?: string): Promise<Response> {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: headers(pat) })
    if (res.status !== 403 && res.status !== 429) return res
    const retryAfter = Number(res.headers.get('retry-after'))
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    const remaining = res.headers.get('x-ratelimit-remaining')
    let wait = Math.min(30_000, 1000 * 2 ** i)
    if (retryAfter) wait = (retryAfter + 1) * 1000
    else if (remaining === '0' && reset) wait = reset * 1000 - Date.now() + 500
    if (wait > 30_000) {
      throw new Error(`GitHub 限流，请稍后重试或配置 Personal Access Token（约 ${Math.ceil(wait / 1000)}s 后恢复）`)
    }
    await sleep(Math.max(1000, wait))
  }
  throw new Error('GitHub 请求多次失败（可能触发限流）')
}

export async function resolveCommit(owner: string, repo: string, ref: string, pat?: string): Promise<string> {
  const res = await ghFetch(`${API}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, pat)
  if (!res.ok) throw new Error(`解析分支失败：HTTP ${res.status}`)
  const j = await res.json()
  return j.sha as string
}

interface TreeBlob {
  path: string
  sha: string
  size: number
}

export async function fetchTree(owner: string, repo: string, commit: string, pat?: string): Promise<TreeBlob[]> {
  const res = await ghFetch(`${API}/repos/${owner}/${repo}/git/trees/${commit}?recursive=1`, pat)
  if (!res.ok) throw new Error(`拉取文件树失败：HTTP ${res.status}`)
  const j = await res.json()
  if (j.truncated) return fetchTreeBfs(owner, repo, commit, pat)
  return (j.tree as any[]).filter(e => e.type === 'blob').map(e => ({ path: e.path, sha: e.sha, size: e.size ?? 0 }))
}

async function fetchTreeBfs(owner: string, repo: string, rootSha: string, pat?: string): Promise<TreeBlob[]> {
  const out: TreeBlob[] = []
  const queue: string[] = [rootSha]
  while (queue.length) {
    const sha = queue.shift()!
    const res = await ghFetch(`${API}/repos/${owner}/${repo}/git/trees/${sha}`, pat)
    if (!res.ok) continue
    const j = await res.json()
    for (const e of j.tree as any[]) {
      if (e.type === 'tree') queue.push(e.sha)
      else if (e.type === 'blob') out.push({ path: e.path, sha: e.sha, size: e.size ?? 0 })
    }
  }
  return out
}

/**
 * Download the whole tree as a single zip from codeload (1 request, not the
 * REST API bucket) and decode supported text files. `treePaths` lets us strip
 * the archive's top-level "{repo}-{ref}" prefix even when the ref contains "/".
 */
export async function fetchSourcesZip(
  owner: string,
  repo: string,
  ref: string,
  treePaths: Set<string>,
  maxBytes: number,
  pat?: string,
): Promise<Map<string, string>> {
  const url = `https://codeload.github.com/${owner}/${repo}/zip/${encodeURIComponent(ref)}`
  const res = await fetch(url, { headers: pat ? { Authorization: `Bearer ${pat}` } : {} })
  if (!res.ok) throw new Error(`下载压缩包失败：HTTP ${res.status}（私有仓库需配置 PAT）`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const entries = unzipSync(buf)
  const dec = new TextDecoder('utf-8')
  const out = new Map<string, string>()

  for (const name of Object.keys(entries)) {
    if (name.endsWith('/')) continue
    const rel = stripArchivePrefix(name, treePaths)
    if (out.has(rel)) continue
    const data = entries[name]
    if (data.length > maxBytes) continue
    out.set(rel, dec.decode(data))
  }
  return out
}

function stripArchivePrefix(name: string, treePaths: Set<string>): string {
  const parts = name.split('/')
  for (let i = 1; i < parts.length; i++) {
    const cand = parts.slice(i).join('/')
    if (treePaths.has(cand)) return cand
  }
  return parts.slice(1).join('/')
}
