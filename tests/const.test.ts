import { describe, expect, it } from 'vitest'
import { EXT_TO_LANG, GRAMMAR_FILES, NODE_TYPES } from '../src/shared/const'

describe('language coverage', () => {
  it('every mapped extension resolves to a grammar', () => {
    for (const lang of Object.values(EXT_TO_LANG)) {
      expect(GRAMMAR_FILES[lang], `grammar for ${lang}`).toBeTruthy()
    }
  })

  it('every mapped extension has AST node types', () => {
    for (const lang of Object.values(EXT_TO_LANG)) {
      expect(NODE_TYPES[lang]?.length, `node types for ${lang}`).toBeGreaterThan(0)
    }
  })

  it('maps the MVP languages', () => {
    expect(EXT_TO_LANG['.py']).toBe('python')
    expect(EXT_TO_LANG['.ts']).toBe('typescript')
    expect(EXT_TO_LANG['.tsx']).toBe('tsx')
    expect(EXT_TO_LANG['.js']).toBe('javascript')
  })
})
