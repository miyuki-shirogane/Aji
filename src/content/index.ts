import { sendToBackground } from '../shared/messages'
import type { ContentEvent } from '../shared/messages'
import type { Hit, IndexProgress } from '../shared/types'
import { onRouteChange, parseRoute } from './route'

const HOST_ID = 'aji-root'

const CSS = `
:host { all: initial; }
.aji-card {
  position: fixed; top: 72px; left: 50%; transform: translateX(-50%);
  width: min(720px, 92vw); max-height: 76vh; z-index: 2147483000;
  display: flex; flex-direction: column;
  background: var(--bgColor-default, #ffffff); color: var(--fgColor-default, #1f2328);
  border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.22); overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 13px;
}
.aji-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--borderColor-muted, #d8dee4); }
.aji-title { font-weight: 700; letter-spacing: .3px; }
.aji-sub { color: var(--fgColor-muted, #656d76); font-size: 12px; }
.aji-x { margin-left: auto; border: 0; background: transparent; cursor: pointer; font-size: 14px; color: var(--fgColor-muted, #656d76); }
.aji-repo { padding: 6px 14px; font-size: 12px; color: var(--fgColor-muted, #656d76); border-bottom: 1px solid var(--borderColor-muted, #d8dee4); }
.aji-ref { color: var(--fgColor-accent, #0969da); }
.aji-body { padding: 12px 14px; overflow: auto; }
.aji-search { margin-bottom: 8px; }
.aji-input { width: 100%; box-sizing: border-box; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--borderColor-default, #d0d7de); background: var(--bgColor-default, #fff); color: inherit; font-size: 13px; outline: none; }
.aji-input:focus { border-color: var(--fgColor-accent, #0969da); box-shadow: 0 0 0 2px rgba(9,105,218,.2); }
.aji-hint { color: var(--fgColor-muted, #656d76); padding: 8px 0; }
.aji-status { color: var(--fgColor-muted, #656d76); font-size: 12px; margin-top: 6px; }
.aji-meta { color: var(--fgColor-muted, #656d76); font-size: 12px; margin: 4px 0 8px; }
.aji-primary { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--fgColor-accent, #0969da); background: var(--bgColor-accent-emphasis, #0969da); color: #fff; cursor: pointer; font-size: 13px; }
.aji-primary:disabled { opacity: .5; cursor: default; }
.aji-progress { height: 6px; border-radius: 4px; background: var(--bgColor-inset, #eaeef2); margin: 10px 0 4px; overflow: hidden; }
.aji-bar { height: 100%; background: var(--bgColor-accent-emphasis, #0969da); transition: width .2s; }
.aji-results { display: flex; flex-direction: column; gap: 6px; }
.aji-hit { padding: 8px 10px; border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 8px; cursor: pointer; }
.aji-hit:hover { border-color: var(--fgColor-accent, #0969da); background: var(--bgColor-muted, #f6f8fa); }
.aji-hit-top { display: flex; align-items: baseline; gap: 8px; }
.aji-sym { font-weight: 600; color: var(--fgColor-accent, #0969da); }
.aji-score { margin-left: auto; color: var(--fgColor-muted, #656d76); font-size: 11px; font-variant-numeric: tabular-nums; }
.aji-path { color: var(--fgColor-muted, #656d76); font-size: 12px; margin: 2px 0 4px; word-break: break-all; }
.aji-lines { color: var(--fgColor-success, #1a7f37); }
.aji-snip { margin: 0; padding: 6px 8px; background: var(--bgColor-muted, #f6f8fa); border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; max-height: 96px; overflow: hidden; }
.aji-foot { padding: 8px 14px; border-top: 1px solid var(--borderColor-muted, #d8dee4); color: var(--fgColor-muted, #656d76); font-size: 11px; }
`

let host: HTMLDivElement | null = null
let root: ShadowRoot | null = null
let route: ReturnType<typeof parseRoute> = null
let panelOpen = false
let loadingState = false
let indexed = false
let stale = false
let chunkCount = 0
let device = ''
let commit: string | null = null
let results: Hit[] = []
let status = ''
let progress: IndexProgress | null = null
let query = ''
let busy = false

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function ensureMount() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', ensureMount, { once: true })
    return
  }
  if (!host) {
    host = document.createElement('div')
    host.id = HOST_ID
    root = host.attachShadow({ mode: 'open' })
  }
  if (!host.isConnected) document.body.appendChild(host)
}

function render() {
  ensureMount()
  if (!root) return
  const inner = renderBody()
  root.innerHTML = `<style>${CSS}</style>${inner}`
  bind()
}

function renderBody(): string {
  if (!panelOpen) return ''
  const header = `
    <div class="aji-head">
      <span class="aji-title">Aji</span>
      <span class="aji-sub">语义代码检索 · 本地向量</span>
      <button class="aji-x" data-act="close">✕</button>
    </div>`

  if (!route) {
    return `<div class="aji-card">${header}<div class="aji-body"><div class="aji-hint">请在某个 GitHub 仓库页面使用（如 github.com/owner/repo）。</div></div></div>`
  }

  const repoLine = `<div class="aji-repo">${esc(route.owner)}/${esc(route.repo)}${route.ref ? ` <span class="aji-ref">@${esc(route.ref)}</span>` : ''}</div>`

  let body = ''
  if (loadingState) {
    body = `<div class="aji-hint">读取仓库状态…</div>`
  } else if (busy && !indexed) {
    body = `<div class="aji-hint">${esc(status || '建立索引中…')}</div>${renderProgress()}`
  } else if (!indexed) {
    body = `
      <div class="aji-hint">${stale ? '仓库已更新，需要重建索引。' : '该仓库尚未建立本地索引。'}</div>
      <button class="aji-primary" data-act="index" ${busy ? 'disabled' : ''}>${stale ? '重建索引' : '建立索引'}</button>
      ${status ? `<div class="aji-status">${esc(status)}</div>` : ''}
      ${renderProgress()}`
  } else {
    body = `
      <div class="aji-search"><input class="aji-input" type="text" placeholder="用自然语言描述你要找的逻辑…（Enter 检索）" value="${esc(query)}" /></div>
      <div class="aji-meta">${chunkCount} 个代码块${device ? ` · ${esc(device)}` : ''} · ${esc(status || '就绪')}</div>
      ${renderResults()}`
  }

  return `<div class="aji-card">${header}${repoLine}<div class="aji-body">${body}</div><div class="aji-foot">Cmd/Ctrl+K 唤起 · Esc 关闭 · 结果点击后跳转到文件对应行号</div></div>`
}

function renderProgress(): string {
  if (!progress || progress.phase === 'done' || progress.phase === 'error') return ''
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return `
    <div class="aji-progress">
      <div class="aji-bar" style="width:${Math.max(4, pct)}%"></div>
    </div>
    <div class="aji-status">${esc(progress.message)}</div>`
}

function renderResults(): string {
  if (!results.length) return `<div class="aji-hint">${busy ? '检索中…' : '输入关键词后回车检索。'}</div>`
  const rows = results
    .map(
      (h, i) => `
      <div class="aji-hit" data-act="hit" data-i="${i}">
        <div class="aji-hit-top">
          <span class="aji-sym">${esc(h.symbol)}</span>
          <span class="aji-score">${h.score.toFixed(3)}</span>
        </div>
        <div class="aji-path">${esc(h.path)} <span class="aji-lines">L${h.startLine}-${h.endLine}</span></div>
        <pre class="aji-snip">${esc(h.snippet)}</pre>
      </div>`,
    )
    .join('')
  return `<div class="aji-results">${rows}</div>`
}

function bind() {
  if (!root) return
  root.querySelector('[data-act="close"]')?.addEventListener('click', close)
  root.querySelector('[data-act="index"]')?.addEventListener('click', doIndex)
  const input = root.querySelector('.aji-input') as HTMLInputElement | null
  if (input) {
    input.value = query
    input.addEventListener('input', () => (query = input.value))
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch()
    })
    input.focus()
  }
  root.querySelectorAll('[data-act="hit"]').forEach(el => {
    el.addEventListener('click', () => {
      const i = Number((el as HTMLElement).dataset.i)
      jump(results[i])
    })
  })
}

function open() {
  panelOpen = true
  render()
  void refreshState()
}

function close() {
  panelOpen = false
  render()
}

function toggle() {
  panelOpen ? close() : open()
}

async function refreshState() {
  const r = route
  if (!r) return
  loadingState = true
  status = ''
  render()
  try {
    const res: any = await sendToBackground({ to: 'bg', type: 'GET_STATE', owner: r.owner, repo: r.repo, ref: r.ref ?? '' })
    indexed = !!res?.indexed
    stale = !!res?.stale
    chunkCount = res?.chunkCount ?? 0
    commit = res?.commit ?? null
  } catch (e: any) {
    indexed = false
    status = `读取失败：${e?.message || e}`
  } finally {
    loadingState = false
    render()
  }
}

async function doIndex() {
  const r = route
  if (!r || busy) return
  busy = true
  status = '开始建立索引…'
  render()
  try {
    const res: any = await sendToBackground({ to: 'bg', type: 'START_INDEX', owner: r.owner, repo: r.repo, ref: r.ref ?? '' })
    indexed = !!res?.ok
    stale = false
    commit = res?.commit ?? commit
    chunkCount = res?.chunkCount ?? 0
    device = res?.device || device
    status = indexed ? `索引完成（${chunkCount} 块）` : `索引失败：${res?.error || '未知错误'}`
  } catch (e: any) {
    status = `索引失败：${e?.message || e}`
  } finally {
    busy = false
    render()
  }
}

async function doSearch() {
  const r = route
  if (!r || busy) return
  const q = query.trim()
  if (!q) return
  busy = true
  status = '检索中…'
  render()
  try {
    const res: any = await sendToBackground({ to: 'bg', type: 'SEARCH', owner: r.owner, repo: r.repo, ref: r.ref ?? '', query: q })
    if (res?.needIndex) {
      indexed = false
      status = '仓库有更新或未索引，请先建立索引。'
      results = []
    } else {
      results = res?.hits ?? []
      commit = res?.commit ?? commit
      status = results.length ? `找到 ${results.length} 个结果` : '没有匹配结果'
    }
  } catch (e: any) {
    status = `检索失败：${e?.message || e}`
    results = []
  } finally {
    busy = false
    render()
  }
}

function jump(hit?: Hit) {
  if (!hit || !route || !commit) return
  const path = hit.path.split('/').map(encodeURIComponent).join('/')
  const url = `https://github.com/${route.owner}/${route.repo}/blob/${commit}/${path}#L${hit.startLine}-L${hit.endLine}`
  window.location.assign(url)
}

// Keyboard shortcut: Cmd/Ctrl+K toggles the panel. Registered at document_start
// so it fires before GitHub's own Cmd+K command palette handler.
window.addEventListener(
  'keydown',
  e => {
    const isK = e.key === 'k' || e.key === 'K' || e.code === 'KeyK'
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && isK) {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!e.repeat) toggle()
      return
    }
    if (e.key === 'Escape' && panelOpen) {
      e.preventDefault()
      close()
    }
  },
  true,
)

// Progress / result broadcasts from the background.
chrome.runtime.onMessage.addListener((msg: any) => {
  const m = msg as ContentEvent
  if (!m || m.to !== 'content') return
  if (m.type === 'PROGRESS') {
    progress = m.progress
    if (m.progress.phase === 'error') status = m.progress.message
    render()
  } else if (m.type === 'INDEX_RESULT') {
    busy = false
    indexed = m.ok
    if (m.ok) chunkCount = m.chunkCount
    if (m.device) device = m.device
    status = m.ok ? `索引完成（${m.chunkCount} 块）` : `索引失败：${m.error || ''}`
    render()
  }
})

onRouteChange(() => {
  const next = parseRoute(location.href)
  const changed = next?.owner !== route?.owner || next?.repo !== route?.repo || next?.ref !== route?.ref
  route = next
  if (changed) {
    results = []
    commit = null
    indexed = false
    stale = false
    chunkCount = 0
    progress = null
    status = ''
  }
  ensureMount()
  if (panelOpen) {
    render()
    if (changed) void refreshState()
  }
})

route = parseRoute(location.href)
ensureMount()
console.info('[aji] content script ready — press Cmd/Ctrl+K')
