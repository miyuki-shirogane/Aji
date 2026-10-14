import { describe, expect, it } from 'vitest'
import { extOf, stripArchivePrefix } from '../src/background/github'

describe('extOf', () => {
  it('returns a lowercased extension', () => {
    expect(extOf('src/a/B.py')).toBe('.py')
    expect(extOf('X.TS')).toBe('.ts')
    expect(extOf('a/b/c.tar.gz')).toBe('.gz')
  })

  it('returns empty for extensionless or dotted directories', () => {
    expect(extOf('Makefile')).toBe('')
    expect(extOf('dir.d/file')).toBe('')
    expect(extOf('noext')).toBe('')
  })
})

describe('stripArchivePrefix', () => {
  const treePaths = new Set(['src/a.ts', 'b.js'])

  it('strips a normal "{repo}-{ref}" prefix', () => {
    expect(stripArchivePrefix('Gitako-develop/src/a.ts', treePaths)).toBe('src/a.ts')
  })

  it('strips multi-segment refs (branch names containing "/")', () => {
    expect(stripArchivePrefix('Gitako-feat/x/src/a.ts', treePaths)).toBe('src/a.ts')
  })

  it('falls back to dropping the first segment when unmatched', () => {
    expect(stripArchivePrefix('Gitako-develop/unknown.txt', treePaths)).toBe('unknown.txt')
  })
})
