export interface Route {
  owner: string
  repo: string
  ref: string | null
  kind: 'root' | 'tree' | 'blob' | 'other'
  path: string | null
}

export interface IndexFile {
  path: string
  blobSha: string
  lang: string
  text: string
}

export interface Hit {
  path: string
  symbol: string
  lang: string
  startLine: number
  endLine: number
  score: number
  snippet: string
}

export interface RepoState {
  repoKey: string
  ref: string
  commit: string | null
  indexed: boolean
  stale: boolean
  chunkCount: number
  modelId: string
}

export interface IndexProgress {
  jobId: string
  phase: 'resolve' | 'tree' | 'download' | 'parse' | 'embed' | 'done' | 'error'
  done: number
  total: number
  message: string
}
