import { describe, expect, it } from 'vitest'
import {
  canAccessMarketplaceModule, marketplaceCapabilities, visibleMarketplaceModules,
  type MarketplaceContext,
} from './entitlements'
import {
  activeFilterCount, buildMarketplaceHref, parseMarketplaceQuery, queryToParams,
} from './query'
import {
  deadlineState, matchScore, money, percent, responseTime, startingPrice, turnaround, MAX_COMPARE,
} from './module'

function ctx(overrides: Partial<MarketplaceContext> = {}): MarketplaceContext {
  return {
    workspaceId: 'ws-1', workspaceType: 'small_business', plan: 'team',
    planStatus: 'active', role: 'owner', ...overrides,
  } as MarketplaceContext
}

// ── Entitlements ─────────────────────────────────────────────────────────────

describe('marketplace entitlements', () => {
  it('opens every module for an active team-plan owner', () => {
    const modules = visibleMarketplaceModules(ctx())
    expect(modules).toContain('overview')
    expect(modules).toContain('requests')
    expect(modules).toContain('orders')
  })

  it('gates the plan-limited modules behind an upgrade rather than hiding them silently', () => {
    const access = canAccessMarketplaceModule(ctx({ plan: 'free' }), 'requests')
    expect(access.allowed).toBe(false)
    if (!access.allowed) {
      expect(access.reason).toBe('plan')
      expect(access.upgrade).toBe(true)
      expect(access.message).toMatch(/\w/)
    }
  })

  it('removes gated modules from the tab strip instead of rendering dead tabs', () => {
    expect(visibleMarketplaceModules(ctx({ plan: 'free' }))).not.toContain('requests')
  })

  it('never exceeds the comparison limit it advertises', () => {
    const caps = marketplaceCapabilities(ctx())
    expect(caps.compareLimit).toBeGreaterThan(0)
    expect(caps.compareLimit).toBeLessThanOrEqual(MAX_COMPARE + 1)
  })
})

// ── URL query state ──────────────────────────────────────────────────────────

describe('marketplace query state', () => {
  it('round-trips filters through the URL so a search can be shared and refreshed', () => {
    const query = parseMarketplaceQuery({
      q: 'voice over', category: 'voice-over', rating: '4.5', page: '2', view: 'list',
    }, { views: ['cards', 'list'], defaultView: 'cards' })

    expect(query.q).toBe('voice over')
    expect(query.category).toBe('voice-over')
    expect(query.page).toBe(2)
    expect(query.view).toBe('list')

    const params = queryToParams(query)
    expect(params.q).toBe('voice over')
    expect(params.category).toBe('voice-over')
  })

  it('falls back safely on invalid or hostile parameters', () => {
    const query = parseMarketplaceQuery({
      page: '-5', size: '99999', view: 'not-a-view', status: 'definitely-not-a-status',
      rating: 'DROP TABLE', compare: 'a,b,c,d,e,f,g,h',
    }, { views: ['cards', 'list'], defaultView: 'cards' })

    expect(query.page).toBeGreaterThanOrEqual(1)
    expect(query.view).toBe('cards')
    expect(query.status).toBe('')
    expect(query.compare.length).toBeLessThanOrEqual(MAX_COMPARE)
  })

  it('counts only the filters a user actually set', () => {
    const empty = parseMarketplaceQuery({})
    expect(activeFilterCount(empty)).toBe(0)
    expect(activeFilterCount(parseMarketplaceQuery({ category: 'seo', verified: '1' }))).toBeGreaterThan(0)
  })

  it('keeps unrelated state when a single filter changes', () => {
    const query = parseMarketplaceQuery({ q: 'video', category: 'video-editing', view: 'list' },
      { views: ['cards', 'list'], defaultView: 'cards' })
    const href = buildMarketplaceHref('/app/marketplace/discover', query, { category: 'seo' })
    expect(href).toContain('q=video')
    expect(href).toContain('category=seo')
    expect(href).not.toContain('category=video-editing')
  })
})

// ── Formatting and scoring ───────────────────────────────────────────────────

describe('marketplace formatting', () => {
  it('formats money for UK users and never rounds a per-word rate away', () => {
    expect(money(120000)).toBe('£1,200')
    expect(startingPrice({ starting_price_cents: 10, price_unit: 'word', currency: 'GBP' })).toBe('£0.10/word')
  })

  it('renders a missing value as an em dash rather than a fake zero', () => {
    expect(money(null)).toBe('—')
    expect(turnaround(null)).toBe('—')
    expect(responseTime(null)).toBe('—')
    expect(percent(null)).toBe('—')
  })

  it('describes deadlines with the right urgency', () => {
    const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
    expect(deadlineState(iso(-2)).tone).toBe('danger')
    expect(deadlineState(iso(0)).tone).toBe('danger')
    expect(deadlineState(iso(2)).tone).toBe('warn')
    expect(deadlineState(iso(30)).tone).toBe('neutral')
    expect(deadlineState(null).label).toBe('No deadline')
  })
})

describe('proposal match score', () => {
  const base = { cheapestCents: 100_000, dearestCents: 300_000, capability: 80, availability: 80, rating: 4.5 }

  it('is deterministic — the same proposal always scores the same', () => {
    const a = matchScore({ ...base, amountCents: 150_000 })
    const b = matchScore({ ...base, amountCents: 150_000 })
    expect(a).toBe(b)
  })

  it('rewards the cheaper of two otherwise identical proposals', () => {
    const cheap = matchScore({ ...base, amountCents: 100_000 })
    const dear = matchScore({ ...base, amountCents: 300_000 })
    expect(cheap).toBeGreaterThan(dear)
  })

  it('stays within 0-100', () => {
    for (const amountCents of [100_000, 180_000, 300_000]) {
      const score = matchScore({ ...base, amountCents })
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })
})

// ── On-time delivery regression ──────────────────────────────────────────────
//
// The insights query used to count a delivered order as on-time only while its
// due date was still in the future, so every correctly delivered order flipped
// to "late" the day after its deadline and the headline rate decayed to 0%.
// This pins the intended rule: delivered on or before the deadline.

function onTimeRate(rows: { delivery_status: string; due_date: string | null; completed_at: string | null }[]) {
  const delivered = rows.filter(row => row.delivery_status === 'delivered')
  const onTime = delivered.filter(row => {
    if (!row.due_date) return true
    if (!row.completed_at) return false
    return row.completed_at.slice(0, 10) <= row.due_date
  }).length
  return delivered.length ? Number(((onTime / delivered.length) * 100).toFixed(1)) : 0
}

describe('on-time delivery', () => {
  it('counts an order delivered before its deadline as on-time, however long ago that was', () => {
    expect(onTimeRate([
      { delivery_status: 'delivered', due_date: '2020-01-10', completed_at: '2020-01-08T09:00:00Z' },
    ])).toBe(100)
  })

  it('counts an order delivered after its deadline as late', () => {
    expect(onTimeRate([
      { delivery_status: 'delivered', due_date: '2020-01-10', completed_at: '2020-01-14T09:00:00Z' },
    ])).toBe(0)
  })

  it('mixes both into a real percentage and ignores orders still in flight', () => {
    expect(onTimeRate([
      { delivery_status: 'delivered', due_date: '2020-01-10', completed_at: '2020-01-09T09:00:00Z' },
      { delivery_status: 'delivered', due_date: '2020-01-10', completed_at: '2020-01-09T09:00:00Z' },
      { delivery_status: 'delivered', due_date: '2020-01-10', completed_at: '2020-01-09T09:00:00Z' },
      { delivery_status: 'delivered', due_date: '2020-01-10', completed_at: '2020-01-15T09:00:00Z' },
      { delivery_status: 'in_progress', due_date: '2020-01-10', completed_at: null },
    ])).toBe(75)
  })
})
