import { describe, expect, it } from 'vitest'
import { buildKpis, extraKpi } from './kpis'
import type { SeoSiteDaily } from './types'

function daily(overrides: Partial<SeoSiteDaily> & { date: string }): SeoSiteDaily {
  return {
    clicks: 0, impressions: 0, ctr: 0, avg_position: null, visibility_score: null, share_of_voice: null,
    tracked_keywords: 0, top3_keywords: 0, top10_keywords: 0, winning_keywords: 0, declining_keywords: 0,
    est_organic_traffic: 0, map_pack_visibility: null, avg_local_rank: null, profile_views: 0,
    avg_review_score: null, ai_visibility_score: null, citation_rate: null, brand_mentions: 0,
    linked_sources: 0, tracked_prompts: 0, authority_score: null, total_backlinks: 0, referring_domains: 0,
    new_links: 0, lost_links: 0, toxic_links: 0, source: 'internal_tracker',
    ...overrides,
  }
}

describe('buildKpis', () => {
  it('sums clicks and impressions across the period', () => {
    const current = [daily({ date: '2026-06-01', clicks: 100, impressions: 1000 }), daily({ date: '2026-06-02', clicks: 200, impressions: 2000 })]
    const kpis = buildKpis('overview', current, [], 'google_search_console')
    expect(kpis.find(k => k.id === 'clicks')?.value).toBe(300)
    expect(kpis.find(k => k.id === 'impressions')?.value).toBe(3000)
  })

  it('averages average-rank rather than summing it', () => {
    const current = [daily({ date: '2026-06-01', avg_position: 10 }), daily({ date: '2026-06-02', avg_position: 20 })]
    const kpis = buildKpis('overview', current, [], 'google_search_console')
    expect(kpis.find(k => k.id === 'avg-rank')?.value).toBe(15)
  })

  it('uses the last value for a point-in-time metric like tracked keywords', () => {
    const current = [daily({ date: '2026-06-01', tracked_keywords: 100 }), daily({ date: '2026-06-02', tracked_keywords: 120 })]
    const kpis = buildKpis('keywords', current, [], 'internal_tracker')
    expect(kpis.find(k => k.id === 'tracked')?.value).toBe(120)
  })

  it('flags average rank and declining keywords as inverted (lower is better)', () => {
    const kpis = buildKpis('keywords', [daily({ date: '2026-06-01' })], [], 'internal_tracker')
    expect(kpis.find(k => k.id === 'avg-rank')?.invert).toBe(true)
    expect(kpis.find(k => k.id === 'declining')?.invert).toBe(true)
    expect(kpis.find(k => k.id === 'winning')?.invert).toBeUndefined()
  })

  it('reports null rather than 0 when there is no data at all', () => {
    const kpis = buildKpis('backlinks', [], [], 'ahrefs')
    expect(kpis.find(k => k.id === 'authority')?.value).toBeNull()
  })

  it('attaches the given source to every card', () => {
    const kpis = buildKpis('rankings', [daily({ date: '2026-06-01' })], [], 'semrush')
    expect(kpis.every(k => k.source === 'semrush')).toBe(true)
  })
})

describe('extraKpi', () => {
  it('builds a KPI card with an empty sparkline', () => {
    const kpi = extraKpi('opportunities', 'Opportunities', 12, 8, 'Open opportunities', 'internal_tracker')
    expect(kpi).toMatchObject({ id: 'opportunities', value: 12, previous: 8, format: 'number', spark: [] })
  })
})
