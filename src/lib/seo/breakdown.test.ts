import { describe, expect, it } from 'vitest'
import { breakdownBy } from './metrics'

interface Row { keyword: string; device: string | null; current_rank: number | null; search_volume: number }

const rows: Row[] = [
  { keyword: 'a', device: 'desktop', current_rank: 2, search_volume: 100 },
  { keyword: 'b', device: 'desktop', current_rank: 8, search_volume: 200 },
  { keyword: 'c', device: 'mobile', current_rank: null, search_volume: 50 },
  { keyword: 'd', device: null, current_rank: 5, search_volume: 30 },
]

describe('breakdownBy', () => {
  it('groups rows by the given dimension', () => {
    const result = breakdownBy(rows, r => r.device, r => r.current_rank, r => r.search_volume)
    expect(result.find(r => r.label === 'desktop')?.count).toBe(2)
    expect(result.find(r => r.label === 'mobile')?.count).toBe(1)
  })

  it('groups rows with no value under "Unknown" instead of dropping them', () => {
    const result = breakdownBy(rows, r => r.device, r => r.current_rank, r => r.search_volume)
    expect(result.find(r => r.label === 'Unknown')?.count).toBe(1)
  })

  it('excludes unranked rows from the group average rank', () => {
    const result = breakdownBy(rows, r => r.device, r => r.current_rank, r => r.search_volume)
    // desktop group: ranks 2 and 8 -> average 5
    expect(result.find(r => r.label === 'desktop')?.avgRank).toBe(5)
    // mobile group: only an unranked row -> null, not 0
    expect(result.find(r => r.label === 'mobile')?.avgRank).toBeNull()
  })

  it('sums volume per group', () => {
    const result = breakdownBy(rows, r => r.device, r => r.current_rank, r => r.search_volume)
    expect(result.find(r => r.label === 'desktop')?.volume).toBe(300)
  })

  it('computes each group\'s share of the total row count', () => {
    const result = breakdownBy(rows, r => r.device, r => r.current_rank, r => r.search_volume)
    expect(result.find(r => r.label === 'desktop')?.pct).toBe(50)
  })

  it('sorts groups by count, largest first', () => {
    const result = breakdownBy(rows, r => r.device, r => r.current_rank, r => r.search_volume)
    expect(result[0].label).toBe('desktop')
  })
})
