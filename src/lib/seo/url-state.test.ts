import { describe, expect, it } from 'vitest'
import {
  activeFilters, buildExportHref, buildHref, readBool, readEnum, readNumber, readParam, withFilter,
} from './url-state'

describe('readParam / readNumber / readEnum / readBool', () => {
  it('reads a plain string param', () => {
    expect(readParam({ q: 'hello' }, 'q')).toBe('hello')
  })
  it('takes the first value of an array param', () => {
    expect(readParam({ q: ['a', 'b'] }, 'q')).toBe('a')
  })
  it('treats an empty string as absent', () => {
    expect(readParam({ q: '' }, 'q')).toBeUndefined()
  })
  it('parses a number and rejects non-numeric input', () => {
    expect(readNumber({ page: '3' }, 'page')).toBe(3)
    expect(readNumber({ page: 'abc' }, 'page')).toBeUndefined()
  })
  it('only accepts an allowed enum value', () => {
    expect(readEnum({ view: 'table' }, 'view', ['table', 'cards'] as const)).toBe('table')
    expect(readEnum({ view: 'bogus' }, 'view', ['table', 'cards'] as const, 'table')).toBe('table')
  })
  it('reads a boolean flag as exactly "1"', () => {
    expect(readBool({ archived: '1' }, 'archived')).toBe(true)
    expect(readBool({ archived: 'true' }, 'archived')).toBe(false)
  })
})

describe('buildHref', () => {
  it('preserves existing params and applies overrides', () => {
    const href = buildHref('/app/seo/keywords', { q: 'ai', status: 'winning' }, { status: 'declining' })
    const url = new URL(href, 'http://x')
    expect(url.searchParams.get('q')).toBe('ai')
    expect(url.searchParams.get('status')).toBe('declining')
  })
  it('removes a key when the override is null or undefined', () => {
    const href = buildHref('/app/seo/keywords', { q: 'ai' }, { q: undefined })
    expect(href).toBe('/app/seo/keywords')
  })
  it('returns a bare pathname when there is no query state', () => {
    expect(buildHref('/app/seo', undefined, {})).toBe('/app/seo')
  })
})

describe('withFilter', () => {
  it('resets pagination when a filter key changes', () => {
    const href = withFilter('/app/seo/keywords', { page: '4', intent: 'informational' }, 'intent', 'transactional')
    const url = new URL(href, 'http://x')
    expect(url.searchParams.get('page')).toBeNull()
    expect(url.searchParams.get('intent')).toBe('transactional')
  })
  it('does not reset pagination for a key outside the reset list', () => {
    const href = withFilter('/app/seo/keywords', { page: '4' }, 'unrelatedKey', 'value')
    const url = new URL(href, 'http://x')
    expect(url.searchParams.get('page')).toBe('4')
  })
})

describe('buildExportHref', () => {
  it('carries the current filters through to the export endpoint', () => {
    const href = buildExportHref('keywords', { q: 'caption', status: 'winning' })
    const url = new URL(href, 'http://x')
    expect(url.pathname).toBe('/api/seo/export')
    expect(url.searchParams.get('surface')).toBe('keywords')
    expect(url.searchParams.get('q')).toBe('caption')
    expect(url.searchParams.get('status')).toBe('winning')
  })
})

describe('activeFilters', () => {
  it('lists only filters that are actually set', () => {
    const filters = activeFilters({ intent: 'informational' }, { intent: 'Intent', status: 'Status' })
    expect(filters).toEqual([{ key: 'intent', label: 'Intent', value: 'informational' }])
  })
  it('applies a value label transform when provided', () => {
    const filters = activeFilters(
      { status: 'winning' },
      { status: 'Status' },
      { status: value => value.toUpperCase() },
    )
    expect(filters[0].value).toBe('WINNING')
  })
})
