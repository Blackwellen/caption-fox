import { describe, expect, it } from 'vitest'
import { buildCalendarContext } from './entitlements'
import { parsePage, pickView, readParams, resolveRange } from './range'

const ctx = buildCalendarContext({
  workspaceId: 'ws', workspaceType: 'small_business', basePath: '/business',
  planId: 'team', role: 'owner', userId: 'user', timezone: 'Europe/London', weekStartsOn: 0,
})

describe('resolveRange', () => {
  it('month view fetches the whole visible grid and anchors on the 1st', () => {
    const range = resolveRange(ctx, { date: '2026-09-15' }, 'month')
    expect(range.anchorIso).toBe('2026-08-31T23:00:00.000Z') // 1 Sept 00:00 BST
    expect(range.startIso).toBe('2026-08-29T23:00:00.000Z')  // Sun 30 Aug 00:00 BST
    expect(range.selectedDate).toBe('2026-09-15')
  })

  it('agenda view starts on the focused day, not the week start', () => {
    const range = resolveRange(ctx, { date: '2026-10-01' }, 'agenda')
    expect(range.startIso).toBe('2026-09-30T23:00:00.000Z')  // Thu 1 Oct 00:00 BST
    expect(range.endIso).toBe('2026-10-07T22:59:59.999Z')    // end of Wed 7 Oct BST
    expect(range.selectedDate).toBe('2026-10-01')
  })

  it('agenda window is the week containing the focused date', () => {
    const range = resolveRange(ctx, { date: '2026-10-01' }, 'range')
    expect(range.startIso).toBe('2026-09-26T23:00:00.000Z')  // Sun 27 Sept 00:00 BST
    expect(range.selectedDate).toBe('2026-10-01')
  })

  it('an explicit start/end pair wins over the view', () => {
    const range = resolveRange(ctx, { start: '2026-09-01', end: '2026-09-10' }, 'month')
    expect(range.startIso).toBe('2026-08-31T23:00:00.000Z')
    expect(new Date(range.endIso).getTime()).toBeGreaterThan(new Date('2026-09-10T00:00:00Z').getTime())
  })

  it('ignores an inverted start/end pair instead of fetching an impossible window', () => {
    const range = resolveRange(ctx, { start: '2026-09-10', end: '2026-09-01', date: '2026-09-15' }, 'month')
    expect(range.anchorIso).toBe('2026-08-31T23:00:00.000Z')
  })

  it('bounds a hostile offset so a crafted URL cannot request an enormous scan', () => {
    const range = resolveRange(ctx, { date: '2026-09-15', offset: '999999' } as never, 'month')
    const years = (new Date(range.anchorIso).getTime() - new Date('2026-09-01').getTime()) / (365 * 86400000)
    expect(years).toBeLessThanOrEqual(10.1)
  })

  it('falls back to today for a malformed date', () => {
    expect(() => resolveRange(ctx, { date: 'not-a-date' }, 'week')).not.toThrow()
  })
})

describe('pickView / readParams / parsePage', () => {
  it('only accepts known views', () => {
    expect(pickView('week', ['month', 'week'] as const, 'month')).toBe('week')
    expect(pickView('<script>', ['month', 'week'] as const, 'month')).toBe('month')
  })
  it('drops oversized and array values from the query string', () => {
    const params = readParams({ owner: ['a', 'b'], search: 'x'.repeat(500) })
    expect(params.owner).toBe('a')
    expect(params.search).toBeUndefined()
  })
  it('clamps page and only allows the offered page sizes', () => {
    expect(parsePage({ page: 'abc', pageSize: '37' } as never)).toEqual({ page: 1, pageSize: 10 })
    expect(parsePage({ page: '3', pageSize: '25' } as never)).toEqual({ page: 3, pageSize: 25 })
  })
})
