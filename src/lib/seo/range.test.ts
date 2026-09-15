import { describe, expect, it } from 'vitest'
import { bucketSeries, matchPreset, resolveDateRange, resolveGranularity } from './range'

describe('resolveDateRange', () => {
  it('defaults to the 3-month preset', () => {
    const range = resolveDateRange(undefined)
    expect(range.days).toBe(90)
  })
  it('computes a comparison period immediately preceding the selected range', () => {
    const range = resolveDateRange({ range: '28d' })
    expect(range.days).toBe(28)
    // Comparison window ends the day before the range starts.
    const dayBeforeFrom = new Date(`${range.from}T00:00:00Z`)
    dayBeforeFrom.setUTCDate(dayBeforeFrom.getUTCDate() - 1)
    expect(range.compareTo).toBe(dayBeforeFrom.toISOString().slice(0, 10))
  })
  it('falls back to the default range for invalid custom dates rather than throwing', () => {
    const range = resolveDateRange({ from: 'not-a-date', to: 'also-not-a-date' })
    expect(range.days).toBe(90)
  })
  it('rejects a custom range where from is after to', () => {
    const range = resolveDateRange({ from: '2026-06-10', to: '2026-06-01' })
    expect(range.days).toBe(90)
  })
  it('accepts a valid custom range', () => {
    const range = resolveDateRange({ from: '2026-06-01', to: '2026-06-10' })
    expect(range.from).toBe('2026-06-01')
    expect(range.to).toBe('2026-06-10')
    expect(range.days).toBe(10)
  })
})

describe('matchPreset', () => {
  it('matches a known preset by day count', () => {
    const range = resolveDateRange({ range: '7d' })
    expect(matchPreset(range)).toBe('7d')
  })
  it('reports custom for an arbitrary day count', () => {
    const range = resolveDateRange({ from: '2026-06-01', to: '2026-06-15' })
    expect(matchPreset(range)).toBe('custom')
  })
})

describe('resolveGranularity', () => {
  it('defaults to daily', () => {
    expect(resolveGranularity(undefined)).toBe('daily')
  })
  it('accepts a valid override', () => {
    expect(resolveGranularity({ granularity: 'weekly' })).toBe('weekly')
  })
  it('ignores an invalid value', () => {
    expect(resolveGranularity({ granularity: 'fortnightly' })).toBe('daily')
  })
})

describe('bucketSeries', () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, value: i }))

  it('daily granularity returns one bucket per row', () => {
    expect(bucketSeries(rows, 'daily')).toHaveLength(14)
  })
  it('weekly granularity groups rows into fewer buckets', () => {
    const buckets = bucketSeries(rows, 'weekly')
    expect(buckets.length).toBeLessThan(14)
    expect(buckets.length).toBeGreaterThan(0)
  })
  it('monthly granularity collapses a single month into one bucket', () => {
    const buckets = bucketSeries(rows, 'monthly')
    expect(buckets).toHaveLength(1)
    expect(buckets[0]).toHaveLength(14)
  })
})
