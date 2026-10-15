import { sendToBackground } from '../shared/messages'
import type { ContentEvent } from '../shared/messages'
import type { Hit, IndexProgress } from '../shared/types'
import { PAGE_SIZE } from '../shared/const'
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
.aji-link { background: none; border: 0; color: var(--fgColor-accent, #0969da); cursor: pointer; font-size: 12px; padding: 0 2px; text-decoration: underline; }
.aji-link:disabled { opacity: .5; cursor: default; }
.aji-progress { height: 6px; border-radius: 4px; background: var(--bgColor-inset, #eaeef2); margin: 4px 0; overflow: hidden; }
.aji-bar { height: 100%; background: var(--bgColor-accent-emphasis, #0969da); transition: width .3s ease; }
.aji-proghead { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; color: var(--fgColor-muted, #656d76); margin: 10px 0 0; }
.aji-phase { font-weight: 600; }
.aji-pct { font-variant-numeric: tabular-nums; }
.aji-progress.aji-indet .aji-bar { width: 35%; animation: aji-indet 1.1s ease-in-out infinite; }
@keyframes aji-indet { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
.aji-results { display: flex; flex-direction: column; gap: 6px; }
.aji-hit { padding: 8px 10px; border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 8px; cursor: pointer; }
.aji-hit:hover { border-color: var(--fgColor-accent, #0969da); background: var(--bgColor-muted, #f6f8fa); }
.aji-hit.sel { border-color: var(--fgColor-accent, #0969da); background: var(--bgColor-muted, #f6f8fa); box-shadow: inset 3px 0 0 var(--fgColor-accent, #0969da); }
.aji-hit-top { display: flex; align-items: baseline; gap: 8px; }
.aji-sym { font-weight: 600; color: var(--fgColor-accent, #0969da); }
.aji-lines { color: var(--fgColor-success, #1a7f37); font-size: 11px; border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 6px; padding: 0 5px; }
.aji-score { margin-left: auto; color: var(--fgColor-muted, #656d76); font-size: 11px; font-variant-numeric: tabular-nums; }
.aji-path { color: var(--fgColor-muted, #656d76); font-size: 12px; margin: 3px 0 5px; word-break: break-all; }
.aji-dir { color: var(--fgColor-muted, #656d76); }
.aji-file { color: var(--fgColor-default, #1f2328); font-weight: 600; }
.aji-scorebar { height: 3px; border-radius: 2px; background: var(--bgColor-inset, #eaeef2); margin: 6px 0; overflow: hidden; }
.aji-scorebar > div { height: 100%; background: var(--fgColor-accent, #0969da); }
.aji-snip mark { background: var(--bgColor-attention-muted, #fff8c5); color: inherit; border-radius: 2px; }
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
let visible = PAGE_SIZE
let sel = 0
let lastQuery = ''
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
      <span class="aji-sub">Semantic code search · local vectors</span>
      <button class="aji-x" data-act="close">✕</button>
    </div>`

  if (!route) {
    return `<div class="aji-card">${header}<div class="aji-body"><div class="aji-hint">Open a GitHub repository page (e.g. github.com/owner/repo).</div></div></div>`
  }

  const repoLine = `<div class="aji-repo">${esc(route.owner)}/${esc(route.repo)}${route.ref ? ` <span class="aji-ref">@${esc(route.ref)}</span>` : ''}</div>`

  let body = ''
  if (loadingState) {
    body = `<div class="aji-hint">Reading repository state…</div>`
  } else if (busy && !indexed) {
    body = progress ? renderProgress() : `<div class="aji-hint">${esc(status || 'Building index…')}</div>`
  } else if (!indexed) {
    body = `
      <div class="aji-hint">${stale ? 'Repository changed — rebuild the index.' : 'This repository is not indexed yet.'}</div>
      <button class="aji-primary" data-act="index" ${busy ? 'disabled' : ''}>${stale ? 'Rebuild index' : 'Build index'}</button>
      ${status ? `<div class="aji-status">${esc(status)}</div>` : ''}
      ${renderProgress()}`
  } else {
    body = `
      <div class="aji-search"><input class="aji-input" type="text" placeholder="Describe the logic you are looking for… (Enter to search)" value="${esc(query)}" /></div>
      <div class="aji-meta">${chunkCount} chunks${device ? ` · ${esc(device)}` : ''} · ${esc(status || 'ready')} <button class="aji-link" data-act="index" ${busy ? 'disabled' : ''}>Update</button></div>
      ${renderResults()}`
  }

  return `<div class="aji-card">${header}${repoLine}<div class="aji-body">${body}</div><div class="aji-foot">Cmd/Ctrl+K to toggle · click a result to jump to the file and line</div></div>`
}

const PHASE_LABELS: Record<string, string> = {
  resolve: 'Resolving ref',
  tree: 'Fetching tree',
  prune: 'Pruning',
  download: 'Downloading',
  parse: 'Embedding',
}

function renderProgress(): string {
  if (!progress || progress.phase === 'done' || progress.phase === 'error') return ''
  const determinate = progress.total > 0
  const pct = determinate ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : null
  const label = PHASE_LABELS[progress.phase] || ''
  return `
    <div class="aji-proghead"><span class="aji-phase">${esc(label)}</span><span class="aji-pct">${pct != null ? pct + '%' : ''}</span></div>
    <div class="aji-progress${determinate ? '' : ' aji-indet'}"><div class="aji-bar"${determinate ? ` style="width:${pct}%"` : ''}></div></div>
    <div class="aji-status">${esc(progress.message)}</div>`
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function breadcrumb(path: string): string {
  const parts = path.split('/')
  const file = parts.pop() || ''
  const dir = parts.join('/')
  return `${dir ? `<span class="aji-dir">${esc(dir)}/</span>` : ''}<span class="aji-file">${esc(file)}</span>`
}

function highlightSnippet(text: string): string {
  const base = esc(text)
  const terms = [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => t.length >= 3))].sort(
    (a, b) => b.length - a.length,
  )
  if (!terms.length) return base
  return base.replace(new RegExp('(' + terms.map(escRe).join('|') + ')', 'gi'), '<mark>$1</mark>')
}

function renderResults(): string {
  if (!results.length) return `<div class="aji-hint">${busy ? 'Searching…' : 'Type a query and press Enter.'}</div>`
  const rows = results
    .slice(0, visible)
    .map((h, i) => {
      const pct = Math.max(6, Math.min(100, Math.round(h.score * 100)))
      return `
      <div class="aji-hit${i === sel ? ' sel' : ''}" data-act="hit" data-i="${i}">
        <div class="aji-hit-top">
          <span class="aji-sym">${esc(h.symbol)}</span>
          <span class="aji-lines">L${h.startLine}–${h.endLine}</span>
          <span class="aji-score">${h.score.toFixed(2)}</span>
        </div>
        <div class="aji-path">${breadcrumb(h.path)}</div>
        <div class="aji-scorebar"><div style="width:${pct}%"></div></div>
        <pre class="aji-snip">${highlightSnippet(h.snippet)}</pre>
      </div>`
    })
    .join('')
  const more =
    results.length > visible
      ? `<button class="aji-link" data-act="more">Show more (${results.length - visible} left)</button>`
      : ''
  return `<div class="aji-results">${rows}</div>${more}`
}

function bind() {
  if (!root) return
  root.querySelector('[data-act="close"]')?.addEventListener('click', close)
  root.querySelector('[data-act="index"]')?.addEventListener('click', doIndex)
  root.querySelector('[data-act="more"]')?.addEventListener('click', () => {
    visible += PAGE_SIZE
    render()
  })
  const input = root.querySelector('.aji-input') as HTMLInputElement | null
  if (input) {
    input.value = query
    input.addEventListener('input', () => (query = input.value))
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
    status = `Failed to read: ${e?.message || e}`
  } finally {
    loadingState = false
    render()
  }
}

async function doIndex() {
  const r = route
  if (!r || busy) return
  busy = true
  status = 'Building index…'
  render()
  try {
    const res: any = await sendToBackground({ to: 'bg', type: 'START_INDEX', owner: r.owner, repo: r.repo, ref: r.ref ?? '' })
    indexed = !!res?.ok
    stale = false
    commit = res?.commit ?? commit
    chunkCount = res?.chunkCount ?? 0
    device = res?.device || device
    status = indexed ? `Indexed (${chunkCount} chunks)` : `Index failed: ${res?.error || 'unknown error'}`
  } catch (e: any) {
    status = `Index failed: ${e?.message || e}`
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
  status = 'Searching…'
  render()
  try {
    const res: any = await sendToBackground({ to: 'bg', type: 'SEARCH', owner: r.owner, repo: r.repo, ref: r.ref ?? '', query: q })
    if (res?.needIndex) {
      indexed = false
      status = 'Repository changed or not indexed — build the index first.'
      results = []
    } else {
      results = res?.hits ?? []
      visible = PAGE_SIZE
      sel = 0
      lastQuery = q
      commit = res?.commit ?? commit
      status = results.length ? `Found ${results.length} results` : 'No matches'
    }
  } catch (e: any) {
    status = `Search failed: ${e?.message || e}`
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

// Keyboard handling. Registered at document_start so it fires before GitHub's
// own handlers. Keys typed inside our Shadow DOM panel are stopped here —
// GitHub's global shortcuts read the retargeted event target and otherwise
// mistake panel input (e.g. "w") for hotkeys.
window.addEventListener(
  'keydown',
  e => {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : []
    const fromPanel = !!host && path.includes(host)
    const target = path[0] as HTMLElement | undefined
    const isK = e.key === 'k' || e.key === 'K' || e.code === 'KeyK'

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && isK) {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!e.repeat) toggle()
      return
    }

    // Esc closes the panel whenever it is open (works regardless of focus).
    if (e.key === 'Escape' && panelOpen) {
      e.preventDefault()
      e.stopImmediatePropagation()
      close()
      return
    }

    if (!fromPanel) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length) {
        sel = e.key === 'ArrowDown' ? Math.min(results.length - 1, sel + 1) : Math.max(0, sel - 1)
        e.preventDefault()
        render()
      }
      e.stopImmediatePropagation()
      return
    }

    if (e.key === 'Enter' && target?.classList?.contains('aji-input')) {
      e.preventDefault()
      e.stopImmediatePropagation()
      // First Enter runs the search; Enter again (unchanged query) opens the selection.
      if (query.trim() && query.trim() !== lastQuery) doSearch()
      else if (results[sel]) jump(results[sel])
      return
    }

    // Keep every other key away from the page (GitHub's global hotkeys read the
    // retargeted target); do NOT preventDefault so text still reaches the input.
    e.stopImmediatePropagation()
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
    status = m.ok ? `Indexed (${m.chunkCount} chunks)` : `Index failed: ${m.error || ''}`
    render()
  }
})

onRouteChange(() => {
  const next = parseRoute(location.href)
  const changed = next?.owner !== route?.owner || next?.repo !== route?.repo || next?.ref !== route?.ref
  route = next
  if (changed) {
    results = []
    visible = PAGE_SIZE
    sel = 0
    lastQuery = ''
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
