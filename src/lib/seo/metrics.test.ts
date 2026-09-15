import { describe, expect, it } from 'vitest'
import {
  averageRank, citationRate, estimatedTraffic, expectedCtr, linkMatchScore,
  quickWinScore, rankDistribution, visibilityScore,
} from './metrics'

describe('expectedCtr', () => {
  it('returns 0 for no position', () => {
    expect(expectedCtr(null)).toBe(0)
    expect(expectedCtr(undefined)).toBe(0)
  })
  it('is highest at position 1 and decreases with position', () => {
    expect(expectedCtr(1)).toBeGreaterThan(expectedCtr(2))
    expect(expectedCtr(2)).toBeGreaterThan(expectedCtr(10))
  })
  it('falls back to a flat residual beyond the curve', () => {
    expect(expectedCtr(35)).toBe(0.003)
    expect(expectedCtr(80)).toBe(0.001)
    expect(expectedCtr(150)).toBe(0)
  })
})

describe('averageRank', () => {
  it('returns null when nothing has ranked', () => {
    expect(averageRank([{ current_rank: null }, { current_rank: null }])).toBeNull()
  })
  it('excludes unranked keywords rather than treating them as position 0', () => {
    const result = averageRank([{ current_rank: 10 }, { current_rank: null }, { current_rank: 20 }])
    expect(result).toBe(15)
  })
})

describe('visibilityScore', () => {
  it('is 0 when nothing ranks', () => {
    expect(visibilityScore([{ search_volume: 1000, current_rank: null }])).toBe(0)
  })
  it('is 100 when every keyword ranks position 1', () => {
    const score = visibilityScore([{ search_volume: 1000, current_rank: 1 }, { search_volume: 500, current_rank: 1 }])
    expect(score).toBe(100)
  })
  it('is between 0 and 100 for a mixed set', () => {
    const score = visibilityScore([{ search_volume: 1000, current_rank: 1 }, { search_volume: 1000, current_rank: 50 }])
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })
})

describe('estimatedTraffic', () => {
  it('sums expected clicks across keywords', () => {
    const traffic = estimatedTraffic([{ search_volume: 1000, current_rank: 1 }, { search_volume: 1000, current_rank: 1 }])
    // 2 x 1000 x 0.284 = 568
    expect(traffic).toBe(568)
  })
  it('is 0 for keywords with no rank', () => {
    expect(estimatedTraffic([{ search_volume: 1000, current_rank: null }])).toBe(0)
  })
})

describe('rankDistribution', () => {
  it('buckets keywords into the canonical rank bands', () => {
    const dist = rankDistribution([
      { current_rank: 2 }, { current_rank: 8 }, { current_rank: 15 },
      { current_rank: 40 }, { current_rank: 75 }, { current_rank: 150 }, { current_rank: null },
    ])
    expect(dist.find(d => d.id === '1-3')?.count).toBe(1)
    expect(dist.find(d => d.id === '4-10')?.count).toBe(1)
    expect(dist.find(d => d.id === '11-20')?.count).toBe(1)
    expect(dist.find(d => d.id === '21-50')?.count).toBe(1)
    expect(dist.find(d => d.id === '51-100')?.count).toBe(1)
    expect(dist.find(d => d.id === '100+')?.count).toBe(1)
  })
  it('percentages sum close to 100 across all buckets (excluding unranked)', () => {
    const dist = rankDistribution([{ current_rank: 1 }, { current_rank: 1 }, { current_rank: null }])
    const total = dist.reduce((sum, d) => sum + d.pct, 0)
    expect(total).toBeCloseTo((2 / 3) * 100, 0)
  })
})

describe('quickWinScore', () => {
  it('scores an unranked keyword as 0', () => {
    expect(quickWinScore({ current_rank: null, search_volume: 1000, difficulty: 40, landing_page: null })).toBe(0)
  })
  it('rewards positions 4-20 more than positions 1-3', () => {
    const midBand = quickWinScore({ current_rank: 10, search_volume: 1000, difficulty: 40, landing_page: null })
    const topBand = quickWinScore({ current_rank: 2, search_volume: 1000, difficulty: 40, landing_page: null })
    expect(midBand).toBeGreaterThan(topBand)
  })
  it('rewards having an existing landing page', () => {
    const withPage = quickWinScore({ current_rank: 10, search_volume: 1000, difficulty: 40, landing_page: '/x' })
    const withoutPage = quickWinScore({ current_rank: 10, search_volume: 1000, difficulty: 40, landing_page: null })
    expect(withPage).toBeGreaterThan(withoutPage)
  })
})

describe('linkMatchScore', () => {
  it('matches the documented formula: 0.6 x relevance + 0.4 x authority', () => {
    expect(linkMatchScore(90, 80)).toBe(Math.round(0.6 * 90 + 0.4 * 80))
  })
  it('treats missing inputs as 0', () => {
    expect(linkMatchScore(null, null)).toBe(0)
  })
})

describe('citationRate', () => {
  it('excludes failed checks from both numerator and denominator', () => {
    const rate = citationRate([
      { cited: true, failed: false },
      { cited: false, failed: false },
      { cited: true, failed: true },
    ])
    expect(rate).toBe(50)
  })
  it('is 0 when there are no eligible checks', () => {
    expect(citationRate([{ cited: true, failed: true }])).toBe(0)
  })
})
