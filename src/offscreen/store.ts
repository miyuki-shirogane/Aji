import { openDB, type IDBPDatabase } from 'idb'

export interface StoredChunk {
  id: string
  repoKey: string
  blobSha: string
  path: string
  lang: string
  symbol: string
  startLine: number
  endLine: number
  text: string
  vec: Float32Array
  dim: number
}

interface StoredFile {
  id: string
  repoKey: string
  blobSha: string
  path: string
  lang: string
  chunkCount: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB('aji', 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 2) {
          // v1 keyed chunks by commit; v2 is content-addressed by blobSha.
          if (d.objectStoreNames.contains('chunks')) d.deleteObjectStore('chunks')
          if (d.objectStoreNames.contains('files')) d.deleteObjectStore('files')
          const c = d.createObjectStore('chunks', { keyPath: 'id' })
          c.createIndex('byRepo', 'repoKey')
          c.createIndex('byFile', ['repoKey', 'blobSha'])
          const f = d.createObjectStore('files', { keyPath: 'id' })
          f.createIndex('byRepo', 'repoKey')
        }
      },
    })
  }
  return dbPromise
}

export async function putFileChunks(
  repoKey: string,
  file: { blobSha: string; path: string; lang: string },
  chunks: StoredChunk[],
): Promise<void> {
  const d = await db()
  const tx = d.transaction(['chunks', 'files'], 'readwrite')
  await Promise.all(chunks.map(c => tx.objectStore('chunks').put(c)))
  await tx.objectStore('files').put({
    id: `${repoKey}#${file.blobSha}`,
    repoKey,
    blobSha: file.blobSha,
    path: file.path,
    lang: file.lang,
    chunkCount: chunks.length,
  } as StoredFile)
  await tx.done
}

export async function listFileShas(repoKey: string): Promise<string[]> {
  const d = await db()
  const files = (await d.getAllFromIndex('files', 'byRepo', repoKey)) as StoredFile[]
  return files.map(f => f.blobSha)
}

export async function deleteFiles(repoKey: string, blobShas: string[]): Promise<void> {
  if (!blobShas.length) return
  const d = await db()
  const tx = d.transaction(['chunks', 'files'], 'readwrite')
  const chunkStore = tx.objectStore('chunks')
  const fileStore = tx.objectStore('files')
  for (const sha of blobShas) {
    let cursor = await chunkStore.index('byFile').openCursor([repoKey, sha])
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
    await fileStore.delete(`${repoKey}#${sha}`)
  }
  await tx.done
}

export async function getChunksByRepo(repoKey: string): Promise<StoredChunk[]> {
  const d = await db()
  return d.getAllFromIndex('chunks', 'byRepo', repoKey)
}

export async function countChunks(repoKey: string): Promise<number> {
  const d = await db()
  return d.countFromIndex('chunks', 'byRepo', repoKey)
}

export async function clearRepo(repoKey: string): Promise<void> {
  const d = await db()
  const tx = d.transaction(['chunks', 'files'], 'readwrite')
  let cur = await tx.objectStore('chunks').index('byRepo').openCursor(repoKey)
  while (cur) {
    await cur.delete()
    cur = await cur.continue()
  }
  let fcur = await tx.objectStore('files').index('byRepo').openCursor(repoKey)
  while (fcur) {
    await fcur.delete()
    fcur = await fcur.continue()
  }
  await tx.done
}
