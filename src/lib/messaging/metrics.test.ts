import { describe, expect, it } from 'vitest'
import {
  fmtCompact, fmtDelta, fmtRelative, pointChange, rate, ratesOf, relativeChange, resolvePeriod, sumTotals,
} from './metrics'

describe('resolvePeriod', () => {
  it('defaults to the last 30 days and an equal previous window', () => {
    const p = resolvePeriod(undefined, undefined, new Date('2026-09-16T12:00:00Z'))
    expect(p).toMatchObject({ from: '2026-08-18', to: '2026-09-16', prevFrom: '2026-07-19', prevTo: '2026-08-17', days: 30 })
  })

  it('swaps a reversed range and ignores invalid dates', () => {
    const p = resolvePeriod('2026-05-31', '2026-05-01', new Date('2026-09-16T00:00:00Z'))
    expect(p.from).toBe('2026-05-01')
    expect(p.to).toBe('2026-05-31')
    expect(resolvePeriod('nope', 'bad', new Date('2026-09-16T00:00:00Z')).days).toBe(30)
  })
})

describe('rates', () => {
  it('never reports 0% for an empty denominator', () => {
    expect(rate(5, 0)).toBeNull()
  })

  it('uses delivered as the engagement denominator and sent for delivery', () => {
    const r = ratesOf({ sent: 1000, delivered: 980, opened: 490, clicked: 98, converted: 49, opt_outs: 4 })
    expect(r.delivery).toBeCloseTo(98)
    expect(r.open).toBeCloseTo(50)
    expect(r.click).toBeCloseTo(10)
    expect(r.conversion).toBeCloseTo(5)
    expect(r.optOut).toBeCloseTo(0.4)
  })

  it('computes relative and point deltas', () => {
    expect(relativeChange(118.6, 100)).toBeCloseTo(18.6)
    expect(relativeChange(10, 0)).toBeNull()
    expect(pointChange(98.3, 96.2)).toBeCloseTo(2.1)
    expect(pointChange(null, 1)).toBeNull()
  })

  it('sums metric rows', () => {
    expect(sumTotals([{ sent: 1, delivered: 1 }, { sent: 2, opened: 3 }])).toMatchObject({ sent: 3, delivered: 1, opened: 3 })
  })
})

describe('formatting', () => {
  it('formats compact figures like the designs', () => {
    expect(fmtCompact(1_240_000)).toBe('1.24M')
    expect(fmtCompact(856_200)).toBe('856.2K')
    expect(fmtCompact(5_430_000)).toBe('5.43M')
  })

  it('formats deltas and relative times', () => {
    expect(fmtDelta(-0.06, 'pp')).toBe('0.06pp')
    expect(fmtDelta(18.64, '%')).toBe('18.6%')
    expect(fmtRelative(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago')
  })
})
