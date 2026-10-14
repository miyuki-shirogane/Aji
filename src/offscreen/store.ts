import { openDB, type IDBPDatabase } from 'idb'

export interface StoredChunk {
  id: string
  repoKey: string
  commit: string
  path: string
  blobSha: string
  lang: string
  symbol: string
  startLine: number
  endLine: number
  text: string
  vec: Float32Array
  dim: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB('aji', 1, {
      upgrade(d) {
        const s = d.createObjectStore('chunks', { keyPath: 'id' })
        s.createIndex('byRepo', 'repoKey')
        s.createIndex('byCommit', ['repoKey', 'commit'])
      },
    })
  }
  return dbPromise
}

export async function putChunks(chunks: StoredChunk[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('chunks', 'readwrite')
  await Promise.all(chunks.map(c => tx.store.put(c)))
  await tx.done
}

export async function getChunks(repoKey: string, commit: string): Promise<StoredChunk[]> {
  const d = await db()
  return d.getAllFromIndex('chunks', 'byCommit', [repoKey, commit])
}

export async function countChunks(repoKey: string): Promise<number> {
  const d = await db()
  return d.countFromIndex('chunks', 'byRepo', repoKey)
}

export async function clearRepo(repoKey: string): Promise<void> {
  const d = await db()
  const tx = d.transaction('chunks', 'readwrite')
  let cursor = await tx.store.index('byRepo').openCursor(repoKey)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}
