import { describe, expect, it, vi } from 'vitest'

// The engine is server-only; stub the guards and the query module it borrows labels from.
vi.mock('server-only', () => ({}))
vi.mock('./queries', () => ({ CHANNEL_LABELS: {} }))

const { calculateSeverity } = await import('./conflicts')

const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString()

describe('calculateSeverity', () => {
  it('is critical when a clash already blocks delivery and is overdue', () => {
    expect(calculateSeverity({ type: 'duplicate_slot', startAt: inDays(-1), affectedCount: 2, blocksDelivery: true })).toBe('critical')
  })
  it('stays low for a distant, single-record capacity note', () => {
    expect(calculateSeverity({ type: 'capacity_clash', startAt: inDays(30), affectedCount: 1, blocksDelivery: false })).toBe('low')
  })
  it('drops to informational when the clash can be resolved automatically', () => {
    expect(calculateSeverity({ type: 'capacity_clash', startAt: inDays(30), affectedCount: 1, blocksDelivery: false, autoResolvable: true })).toBe('info')
  })
  it('rises as the clash gets closer and touches more records', () => {
    const far = calculateSeverity({ type: 'approval_delay', startAt: inDays(10), affectedCount: 1, blocksDelivery: false })
    const near = calculateSeverity({ type: 'approval_delay', startAt: inDays(0.5), affectedCount: 5, blocksDelivery: false })
    const rank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 }
    expect(rank[near]).toBeGreaterThan(rank[far])
  })
  it('does not label every conflict high', () => {
    const results = new Set([
      calculateSeverity({ type: 'channel_saturation', startAt: inDays(20), affectedCount: 1, blocksDelivery: false }),
      calculateSeverity({ type: 'launch_collision', startAt: inDays(2), affectedCount: 3, blocksDelivery: false }),
      calculateSeverity({ type: 'date_invalid', startAt: inDays(-2), affectedCount: 1, blocksDelivery: true }),
    ])
    expect(results.size).toBeGreaterThan(1)
  })
})
