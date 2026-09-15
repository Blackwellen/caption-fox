// Documented SEO metric definitions.
//
// Every score shown in the UI is calculated here and carries a plain-English
// definition that the UI surfaces in a tooltip. No unexplained scores.

import type { SeoKeyword } from './types'

export const METRIC_DEFINITIONS = {
  organicClicks:
    'Total organic clicks reported by the connected search source for the selected period, timezone-adjusted to the site timezone.',
  impressions:
    'Total organic impressions reported by the connected search source for the selected period.',
  trackedKeywords:
    'Keywords currently tracked for this site, excluding archived keywords. Counted per keyword + country + device + search engine combination.',
  averageRank:
    'Mean tracked position across keywords that ranked at least once in the period. Keywords with no position are excluded rather than counted as zero.',
  visibilityScore:
    'Volume-weighted share of achievable clicks: for each tracked keyword, search volume multiplied by the expected click-through rate for its position, divided by the total volume at position 1. Expressed 0-100.',
  shareOfVoice:
    'This domain\'s share of estimated organic clicks across the tracked keyword set, measured against the configured competitor set on the same keywords.',
  opportunities:
    'Open opportunity records for this site generated from ranking bands, content gaps, citation gaps and link prospects.',
  winningKeywords:
    'Keywords whose tracked position improved by at least one place between the start and end of the selected period.',
  decliningKeywords:
    'Keywords whose tracked position worsened by at least one place between the start and end of the selected period.',
  estOrganicTraffic:
    'Estimated monthly organic sessions: search volume multiplied by the expected click-through rate for each keyword\'s current position, summed across tracked keywords.',
  top3Keywords: 'Tracked keywords currently ranking in positions 1-3.',
  top10Keywords: 'Tracked keywords currently ranking in positions 1-10.',
  mapPackVisibility:
    'Share of tracked local grid points where a location appears in the top 3 map pack results, averaged across tracked locations and keywords.',
  averageLocalRank:
    'Mean map pack position across tracked locations and local keywords. Locations that did not appear are excluded, not counted as zero.',
  averageReviewScore:
    'Mean star rating across reviews collected from connected listing sources for the selected locations.',
  profileViews:
    'Business profile views reported by the connected listing source for the selected period.',
  aiVisibilityScore:
    'Weighted 0-100 score across tracked prompts: brand appearance, prominence in the answer, whether a source was cited and whether the citation linked to this site, weighted by engine coverage. Collection method is shown per engine.',
  citationRate:
    'Share of eligible checked prompts where at least one verified citation pointed at this site. Prompts whose last check failed are excluded from both numerator and denominator.',
  brandMentions:
    'Count of verified brand, product or domain mentions across prompt checks in the selected period. Inferred mentions are excluded.',
  linkedSources:
    'Count of prompt checks where the cited source resolved to a page on this site.',
  authorityScore:
    'Caption Fox internal authority score (0-100) derived from the referring-domain graph of the connected link source. This is NOT Moz Domain Authority or Ahrefs Domain Rating.',
  totalBacklinks: 'Distinct source URLs linking to this site, as reported by the connected link source.',
  referringDomains: 'Distinct referring domains linking to this site.',
  newLinks: 'Backlinks first seen within the selected period.',
  lostLinks: 'Backlinks last seen before the selected period and not seen since.',
  toxicLinks: 'Backlinks flagged toxic or suspected toxic by the connected link source.',
  matchScore:
    'Link prospect match score = round(0.6 x topical relevance + 0.4 x domain authority). Both inputs are 0-100.',
  quickWin:
    'Quick win score combines current position band, search volume, keyword difficulty and whether a landing page already exists. Keywords in positions 4-20 with volume and an existing page score highest.',
} as const

/**
 * Expected organic click-through rate by position. Used by the visibility and
 * estimated-traffic calculations. Derived from aggregated Search Console
 * behaviour across the tracked keyword set; positions beyond 20 contribute a
 * flat residual rather than zero.
 */
const CTR_CURVE: Record<number, number> = {
  1: 0.284, 2: 0.152, 3: 0.099, 4: 0.072, 5: 0.055, 6: 0.043, 7: 0.035,
  8: 0.029, 9: 0.025, 10: 0.022, 11: 0.018, 12: 0.015, 13: 0.013, 14: 0.011,
  15: 0.010, 16: 0.009, 17: 0.008, 18: 0.007, 19: 0.006, 20: 0.006,
}

export function expectedCtr(position: number | null | undefined): number {
  if (position == null || position < 1) return 0
  if (position <= 20) return CTR_CURVE[Math.round(position)] ?? 0.006
  if (position <= 50) return 0.003
  if (position <= 100) return 0.001
  return 0
}

/** Volume-weighted visibility, 0-100. See METRIC_DEFINITIONS.visibilityScore. */
export function visibilityScore(keywords: Pick<SeoKeyword, 'search_volume' | 'current_rank'>[]): number {
  const achievable = keywords.reduce((sum, k) => sum + k.search_volume * CTR_CURVE[1], 0)
  if (achievable === 0) return 0
  const achieved = keywords.reduce((sum, k) => sum + k.search_volume * expectedCtr(k.current_rank), 0)
  return Math.round((achieved / achievable) * 1000) / 10
}

/** Mean position across keywords that actually ranked. Never counts nulls as 0. */
export function averageRank(keywords: Pick<SeoKeyword, 'current_rank'>[]): number | null {
  const ranked = keywords.filter(k => k.current_rank != null).map(k => k.current_rank as number)
  if (ranked.length === 0) return null
  return Math.round((ranked.reduce((a, b) => a + b, 0) / ranked.length) * 10) / 10
}

export interface BreakdownRow {
  label: string
  count: number
  avgRank: number | null
  volume: number
  pct: number
}

/**
 * Generic real-data grouping used by the Rankings Breakdown view. Groups any
 * keyword-shaped rows by an arbitrary dimension (search engine, device,
 * country, cluster, landing-page coverage, etc.) and reports the same three
 * figures for each group: keyword count, average rank and total volume.
 * Rows with no value for the dimension are grouped under "Unknown" rather
 * than silently dropped.
 */
export function breakdownBy<T>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
  rankOf: (row: T) => number | null,
  volumeOf: (row: T) => number,
): BreakdownRow[] {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row) || 'Unknown'
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  const total = rows.length || 1
  return [...groups.entries()]
    .map(([label, items]) => ({
      label,
      count: items.length,
      avgRank: averageRank(items.map(item => ({ current_rank: rankOf(item) }))),
      volume: items.reduce((sum, item) => sum + volumeOf(item), 0),
      pct: Math.round((items.length / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
}

export function estimatedTraffic(keywords: Pick<SeoKeyword, 'search_volume' | 'current_rank'>[]): number {
  return Math.round(keywords.reduce((sum, k) => sum + k.search_volume * expectedCtr(k.current_rank), 0))
}

/** Canonical rank buckets used by every ranking-distribution chart. */
export const RANK_BUCKETS = [
  { id: '1-3', label: '1-3', min: 1, max: 3, colour: '#2563EB' },
  { id: '4-10', label: '4-10', min: 4, max: 10, colour: '#10B981' },
  { id: '11-20', label: '11-20', min: 11, max: 20, colour: '#8B5CF6' },
  { id: '21-50', label: '21-50', min: 21, max: 50, colour: '#F59E0B' },
  { id: '51-100', label: '51-100', min: 51, max: 100, colour: '#94A3B8' },
  { id: '100+', label: '100+', min: 101, max: Number.POSITIVE_INFINITY, colour: '#CBD5E1' },
] as const

export function rankDistribution(keywords: Pick<SeoKeyword, 'current_rank'>[]) {
  const total = keywords.length || 1
  return RANK_BUCKETS.map(bucket => {
    const count = keywords.filter(
      k => k.current_rank != null && k.current_rank >= bucket.min && k.current_rank <= bucket.max,
    ).length
    return { ...bucket, count, pct: Math.round((count / total) * 1000) / 10 }
  })
}

/** Documented quick-win score. See METRIC_DEFINITIONS.quickWin. */
export function quickWinScore(k: Pick<SeoKeyword, 'current_rank' | 'search_volume' | 'difficulty' | 'landing_page'>): number {
  if (k.current_rank == null) return 0
  const positionScore = k.current_rank >= 4 && k.current_rank <= 20 ? 40 : k.current_rank <= 3 ? 8 : 18
  const volumeScore = Math.min(30, Math.log10(Math.max(k.search_volume, 1)) * 8)
  const difficultyScore = Math.max(0, 20 - (k.difficulty ?? 50) / 5)
  const pageScore = k.landing_page ? 10 : 0
  return Math.round(positionScore + volumeScore + difficultyScore + pageScore)
}

export function linkMatchScore(relevance: number | null, authority: number | null): number {
  return Math.round(0.6 * (relevance ?? 0) + 0.4 * (authority ?? 0))
}

/** Citation rate over prompt checks. Failed checks are excluded entirely. */
export function citationRate(checks: { cited: boolean; failed?: boolean }[]): number {
  const eligible = checks.filter(c => !c.failed)
  if (eligible.length === 0) return 0
  return Math.round((eligible.filter(c => c.cited).length / eligible.length) * 1000) / 10
}

/** Human label for how a data point was collected. Never overstates access. */
export const COLLECTION_METHOD_LABELS = {
  provider_api: 'Provider API',
  search_provider: 'Search provider data',
  browser_sample: 'Browser-sampled result',
  third_party_dataset: 'Third-party dataset',
  manual_check: 'Manually checked',
  estimated: 'Estimated',
} as const

export const COLLECTION_METHOD_HELP =
  'Caption Fox reports how each AI Search result was obtained. Browser-sampled and manually checked results are periodic samples, not live monitoring of the answer engine.'
