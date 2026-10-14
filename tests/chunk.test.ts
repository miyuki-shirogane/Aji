import { describe, expect, it } from 'vitest'
import { countLines, fixedChunks, splitIntoWindows } from '../src/offscreen/text'

describe('countLines', () => {
  it('counts newline characters', () => {
    expect(countLines('abc')).toBe(0)
    expect(countLines('a\nb')).toBe(1)
    expect(countLines('a\nb\n')).toBe(2)
  })
})

describe('fixedChunks', () => {
  it('drops code shorter than the minimum chunk size', () => {
    expect(fixedChunks('x'.repeat(10))).toEqual([])
  })

  it('keeps a short single-line body as one chunk', () => {
    const out = fixedChunks('x'.repeat(200))
    expect(out).toHaveLength(1)
    expect(out[0].startLine).toBe(1)
    expect(out[0].endLine).toBe(1)
    expect(out[0].text).toHaveLength(200)
  })
})

describe('splitIntoWindows', () => {
  const lines = Array.from({ length: 50 }, (_, i) => `line${String(i).padStart(2, '0')}`)
  const text = lines.join('\n')

  it('splits into multiple bounded windows', () => {
    const out = splitIntoWindows(text, 0, 'sym', { max: 100, overlap: 20 })
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) expect(c.text.length).toBeLessThanOrEqual(100)
  })

  it('reports increasing 1-based line numbers anchored at startRow', () => {
    const out = splitIntoWindows(text, 0, 'sym', { max: 100, overlap: 20 })
    expect(out[0].startLine).toBe(1)
    expect(out[0].text).toContain('line00')
    for (let i = 1; i < out.length; i++) {
      expect(out[i].startLine).toBeGreaterThan(out[i - 1].startLine)
    }
  })

  it('covers the tail of the text', () => {
    const out = splitIntoWindows(text, 0, 'sym', { max: 100, overlap: 20 })
    expect(out[out.length - 1].text).toContain('line49')
  })

  it('honours a custom startRow offset', () => {
    const out = splitIntoWindows('a\nb\nc', 10, 's')
    expect(out).toHaveLength(1)
    expect(out[0].startLine).toBe(11)
    expect(out[0].endLine).toBe(13)
  })

  it('hard-splits a single line longer than max', () => {
    const out = splitIntoWindows('y'.repeat(2500), 0, 's', { max: 2000, overlap: 0 })
    expect(out).toHaveLength(2)
    expect(out[0].text).toHaveLength(2000)
    expect(out[1].text).toHaveLength(500)
  })
})
