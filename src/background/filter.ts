// Paths we skip when indexing: tests, vendored/generated code, lockfiles, etc.
// Kept dependency-free so it is unit-testable.

const IGNORED_DIR_SEGMENTS = new Set([
  'node_modules',
  'vendor',
  'vendors',
  'third_party',
  'thirdparty',
  'bower_components',
  'dist',
  'build',
  'out',
  'coverage',
  'test',
  'tests',
  '__tests__',
  '__test__',
  'spec',
  'specs',
  'e2e',
  'mock',
  'mocks',
  '__mocks__',
  'fixture',
  'fixtures',
  '__fixtures__',
  'snapshot',
  'snapshots',
  '__snapshots__',
  'generated',
  '__generated__',
  'autogen',
  'examples',
  'example',
  'samples',
])

const IGNORED_FILE_PATTERNS = [
  /\.(test|spec)\.[a-z0-9]+$/i, // foo.test.ts / foo.spec.js
  /(^|\/)[a-z0-9_.-]*_test\.[a-z0-9]+$/i, // foo_test.go / foo_test.py
  /(^|\/)test_[a-z0-9_.-]*\.[a-z0-9]+$/i, // test_foo.py
  /(^|\/)[a-z0-9_.-]*(test|tests|it)\.(java|kt|kts|cs|scala|swift)$/i, // FooTest.java
  /\.(min|bundle|generated)\.[a-z0-9]+$/i, // foo.min.js
  /\.d\.ts$/i, // type declarations
  /\.(snap|map)$/i,
  /(_pb2|_pb2_grpc)\.py$/i, // protobuf generated
  /\.pb\.(go|ts|js|cc|h)$/i,
  /\.(g|designer)\.(cs|dart)$/i,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|gemfile\.lock|cargo\.lock|poetry\.lock|pipfile\.lock)$/i,
]

export function isIgnoredPath(path: string): boolean {
  const segs = path.split('/')
  // Any directory segment (not the file name itself) that is a known noise dir.
  for (let i = 0; i < segs.length - 1; i++) {
    if (IGNORED_DIR_SEGMENTS.has(segs[i].toLowerCase())) return true
  }
  return IGNORED_FILE_PATTERNS.some(re => re.test(path))
}
