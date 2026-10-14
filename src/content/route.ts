import type { Route } from '../shared/types'

const RESERVED = new Set([
  'settings', 'marketplace', 'sponsors', 'notifications', 'explore', 'topics', 'collections',
  'orgs', 'users', 'pulls', 'issues', 'search', 'new', 'login', 'signup', 'about', 'features',
  'pricing', 'apps', 'contact', 'site', 'security', 'enterprise', 'trending', 'events', 'readme',
  'codespaces', 'discussions', 'account', 'dashboard', 'organizations', 'sessions',
])

export function parseRoute(url: string): Route | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.hostname !== 'github.com') return null
  const seg = u.pathname.split('/').filter(Boolean)
  if (seg.length < 2) return null
  const [owner, repo, kind, ...rest] = seg
  if (RESERVED.has(owner)) return null

  if (!kind) return { owner, repo, ref: null, kind: 'root', path: null }
  if (kind !== 'tree' && kind !== 'blob') {
    return { owner, repo, ref: null, kind: 'other', path: null }
  }
  // NOTE: a branch containing "/" is ambiguous here; MVP takes the first
  // segment as the ref (the commit sha is resolved server-side anyway).
  const ref = rest[0] ?? null
  const path = rest.length > 1 ? rest.slice(1).join('/') : null
  return { owner, repo, ref, kind, path }
}

export function onRouteChange(cb: () => void): void {
  let last = location.href
  const fire = () => {
    if (location.href !== last) {
      last = location.href
      cb()
    }
  }
  document.addEventListener('turbo:load', fire)
  document.addEventListener('pjax:end', fire)
  window.addEventListener('popstate', fire)
  setInterval(fire, 500)
}
