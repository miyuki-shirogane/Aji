import type { Hit, IndexFile, IndexProgress, RepoState } from './types'

// content script -> background
export type BgRequest =
  | { to: 'bg'; type: 'GET_STATE'; owner: string; repo: string; ref: string }
  | { to: 'bg'; type: 'START_INDEX'; owner: string; repo: string; ref: string }
  | { to: 'bg'; type: 'SEARCH'; owner: string; repo: string; ref: string; query: string }

// background -> content script (broadcast)
export type ContentEvent =
  | { to: 'content'; type: 'PROGRESS'; progress: IndexProgress }
  | { to: 'content'; type: 'INDEX_RESULT'; ok: boolean; chunkCount: number; device?: string; error?: string }

// background <-> offscreen document
export type OffscreenRequest =
  | { target: 'offscreen'; op: 'indexBatch'; repoKey: string; files: IndexFile[] }
  | { target: 'offscreen'; op: 'listFiles'; repoKey: string }
  | { target: 'offscreen'; op: 'deleteFiles'; repoKey: string; blobShas: string[] }
  | { target: 'offscreen'; op: 'countChunks'; repoKey: string }
  | { target: 'offscreen'; op: 'clearRepo'; repoKey: string }
  | { target: 'offscreen'; op: 'search'; repoKey: string; query: string; topN: number }

export interface OffscreenReply {
  ok: boolean
  error?: string
  chunkCount?: number
  device?: string
  embedMs?: number
  loadMs?: number
  blobShas?: string[]
  hits?: Hit[]
}

export async function sendToBackground<T = any>(msg: BgRequest): Promise<T> {
  return chrome.runtime.sendMessage(msg)
}

export async function sendToOffscreen(msg: OffscreenRequest): Promise<OffscreenReply> {
  return chrome.runtime.sendMessage(msg)
}

export function broadcast(msg: ContentEvent): void {
  // May reject if no content script is listening; ignore.
  chrome.runtime.sendMessage(msg).catch(() => {})
}

export type { RepoState, IndexProgress, IndexFile, Hit }
