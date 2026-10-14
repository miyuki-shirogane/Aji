import { describe, expect, it } from 'vitest'
import { parseRoute } from '../src/content/route'

describe('parseRoute', () => {
  it('parses a repository root', () => {
    expect(parseRoute('https://github.com/EnixCoda/Gitako')).toEqual({
      owner: 'EnixCoda',
      repo: 'Gitako',
      ref: null,
      kind: 'root',
      path: null,
    })
  })

  it('parses a blob path with a ref', () => {
    const r = parseRoute('https://github.com/EnixCoda/Gitako/blob/develop/src/utils/hooks/useFastRedirect.ts')
    expect(r).toMatchObject({
      owner: 'EnixCoda',
      repo: 'Gitako',
      kind: 'blob',
      ref: 'develop',
      path: 'src/utils/hooks/useFastRedirect.ts',
    })
  })

  it('parses a tree path', () => {
    const r = parseRoute('https://github.com/EnixCoda/Gitako/tree/develop/src/components')
    expect(r?.kind).toBe('tree')
    expect(r?.ref).toBe('develop')
    expect(r?.path).toBe('src/components')
  })

  it('marks non-tree/blob repository subpages as other', () => {
    expect(parseRoute('https://github.com/EnixCoda/Gitako/pulls')?.kind).toBe('other')
  })

  it('ignores trailing query and hash', () => {
    const r = parseRoute('https://github.com/a/b/blob/main/x.py#L10-L20')
    expect(r?.path).toBe('x.py')
    expect(r?.ref).toBe('main')
  })

  it('returns null for non-github hosts', () => {
    expect(parseRoute('https://gitlab.com/a/b')).toBeNull()
  })

  it('returns null for reserved top-level owners', () => {
    expect(parseRoute('https://github.com/settings/profile')).toBeNull()
    expect(parseRoute('https://github.com/notifications')).toBeNull()
  })

  it('returns null when there is no repo segment', () => {
    expect(parseRoute('https://github.com/EnixCoda')).toBeNull()
  })
})
