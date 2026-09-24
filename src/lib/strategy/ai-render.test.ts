import { describe, expect, it } from 'vitest'
import { answerLines, moduleFromPath, safeInternalHref, splitCitations } from './ai-render'

describe('splitCitations', () => {
  it('separates text and citation tags in order', () => {
    expect(splitCitations('Two at risk [O1][O3] and one late [P2].')).toEqual([
      { kind: 'text', value: 'Two at risk ' }, { kind: 'cite', ref: 'O1' }, { kind: 'cite', ref: 'O3' },
      { kind: 'text', value: ' and one late ' }, { kind: 'cite', ref: 'P2' }, { kind: 'text', value: '.' },
    ])
  })
  it('leaves non-citation brackets alone', () => {
    expect(splitCitations('Use [draft] mode')).toEqual([{ kind: 'text', value: 'Use [draft] mode' }])
  })
})

describe('answerLines', () => {
  it('detects bullets and drops blank lines', () => {
    expect(answerLines('Summary\n\n- one\n  - two')).toEqual([
      { bullet: false, text: 'Summary' }, { bullet: true, text: 'one' }, { bullet: true, text: 'two' },
    ])
  })
})

describe('moduleFromPath', () => {
  it('reads the module after /strategy', () => {
    expect(moduleFromPath('/brand/strategy/plans')).toBe('plans')
    expect(moduleFromPath('/agency/strategy/forecasts/abc')).toBe('forecasts')
  })
  it('falls back to overview', () => {
    expect(moduleFromPath('/business/strategy')).toBe('overview')
    expect(moduleFromPath('/business/strategy/unknown')).toBe('overview')
  })
})

describe('safeInternalHref', () => {
  it('accepts same-origin relative links only', () => {
    expect(safeInternalHref('/brand/strategy/objectives?id=abc')).toBe('/brand/strategy/objectives?id=abc')
    for (const bad of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/a b', undefined, 42]) {
      expect(safeInternalHref(bad)).toBeNull()
    }
  })
})
