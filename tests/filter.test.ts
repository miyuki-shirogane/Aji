import { describe, expect, it } from 'vitest'
import { isIgnoredPath } from '../src/background/filter'

describe('isIgnoredPath', () => {
  it('keeps normal source files', () => {
    expect(isIgnoredPath('src/utils/hooks/useFastRedirect.ts')).toBe(false)
    expect(isIgnoredPath('src/components/SideBar.tsx')).toBe(false)
    expect(isIgnoredPath('app/models/user.py')).toBe(false)
  })

  it('ignores test/spec files', () => {
    expect(isIgnoredPath('e2e/feature.code-fold.spec.ts')).toBe(true)
    expect(isIgnoredPath('src/foo.test.ts')).toBe(true)
    expect(isIgnoredPath('pkg/handler_test.go')).toBe(true)
    expect(isIgnoredPath('tests/test_user.py')).toBe(true)
    expect(isIgnoredPath('src/main/FooTest.java')).toBe(true)
  })

  it('ignores noise directories', () => {
    expect(isIgnoredPath('node_modules/x/index.js')).toBe(true)
    expect(isIgnoredPath('vendor/lib/a.go')).toBe(true)
    expect(isIgnoredPath('__mocks__/api.ts')).toBe(true)
    expect(isIgnoredPath('fixtures/sample.js')).toBe(true)
    expect(isIgnoredPath('dist/bundle.js')).toBe(true)
    expect(isIgnoredPath('examples/demo.ts')).toBe(true)
  })

  it('ignores generated and lock files', () => {
    expect(isIgnoredPath('src/foo.d.ts')).toBe(true)
    expect(isIgnoredPath('public/app.min.js')).toBe(true)
    expect(isIgnoredPath('yarn.lock')).toBe(true)
    expect(isIgnoredPath('proto/user_pb2.py')).toBe(true)
    expect(isIgnoredPath('src/proto/user.pb.go')).toBe(true)
  })

  it('does not treat a directory word inside a filename as a segment', () => {
    expect(isIgnoredPath('src/testutils.ts')).toBe(false)
    expect(isIgnoredPath('src/contest.ts')).toBe(false)
  })
})
