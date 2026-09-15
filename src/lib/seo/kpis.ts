// Builds the KPI strip for each SEO surface from the daily site aggregate.
// Every card carries its own source attribution and metric definition.

import { METRIC_DEFINITIONS } from './metrics'
import type { SeoKpi, SeoSiteDaily, SeoTabId } from './types'

type Field = keyof SeoSiteDaily

interface KpiSpec {
  id: string
  label: string
  field: Field
  agg: 'sum' | 'avg' | 'last'
  format: SeoKpi['format']
  invert?: boolean
  tooltip: string
}

function sum(rows: SeoSiteDaily[], field: Field): number | null {
  if (rows.length === 0) return null
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0)
}

function avg(rows: SeoSiteDaily[], field: Field): number | null {
  const values = rows.map(row => row[field]).filter(v => v != null).map(Number)
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

function last(rows: SeoSiteDaily[], field: Field): number | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = rows[i][field]
    if (value != null) return Number(value)
  }
  return null
}

function aggregate(rows: SeoSiteDaily[], spec: KpiSpec): number | null {
  if (spec.agg === 'sum') return sum(rows, spec.field)
  if (spec.agg === 'avg') return avg(rows, spec.field)
  return last(rows, spec.field)
}

function build(spec: KpiSpec, current: SeoSiteDaily[], previous: SeoSiteDaily[], source: string): SeoKpi {
  return {
    id: spec.id,
    label: spec.label,
    value: aggregate(current, spec),
    previous: aggregate(previous, spec),
    format: spec.format,
    invert: spec.invert,
    spark: current.map(row => ({ date: row.date, value: row[spec.field] == null ? null : Number(row[spec.field]) })),
    source,
    tooltip: spec.tooltip,
  }
}

const SPECS: Record<SeoTabId, KpiSpec[]> = {
  overview: [
    { id: 'clicks', label: 'Organic Clicks', field: 'clicks', agg: 'sum', format: 'compact', tooltip: METRIC_DEFINITIONS.organicClicks },
    { id: 'impressions', label: 'Impressions', field: 'impressions', agg: 'sum', format: 'compact', tooltip: METRIC_DEFINITIONS.impressions },
    { id: 'tracked', label: 'Tracked Keywords', field: 'tracked_keywords', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.trackedKeywords },
    { id: 'avg-rank', label: 'Average Rank', field: 'avg_position', agg: 'avg', format: 'decimal', invert: true, tooltip: METRIC_DEFINITIONS.averageRank },
    { id: 'visibility', label: 'Visibility Score', field: 'visibility_score', agg: 'avg', format: 'decimal', tooltip: METRIC_DEFINITIONS.visibilityScore },
  ],
  keywords: [
    { id: 'tracked', label: 'Tracked Keywords', field: 'tracked_keywords', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.trackedKeywords },
    { id: 'avg-rank', label: 'Average Rank', field: 'avg_position', agg: 'avg', format: 'decimal', invert: true, tooltip: METRIC_DEFINITIONS.averageRank },
    { id: 'winning', label: 'Winning Keywords', field: 'winning_keywords', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.winningKeywords },
    { id: 'declining', label: 'Declining Keywords', field: 'declining_keywords', agg: 'last', format: 'number', invert: true, tooltip: METRIC_DEFINITIONS.decliningKeywords },
  ],
  briefs: [],
  rankings: [
    { id: 'avg-rank', label: 'Average Rank', field: 'avg_position', agg: 'avg', format: 'decimal', invert: true, tooltip: METRIC_DEFINITIONS.averageRank },
    { id: 'top3', label: 'Top 3 Keywords', field: 'top3_keywords', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.top3Keywords },
    { id: 'top10', label: 'Top 10 Keywords', field: 'top10_keywords', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.top10Keywords },
    { id: 'visibility', label: 'Visibility Score', field: 'visibility_score', agg: 'avg', format: 'decimal', tooltip: METRIC_DEFINITIONS.visibilityScore },
    { id: 'clicks', label: 'Organic Clicks', field: 'clicks', agg: 'sum', format: 'compact', tooltip: METRIC_DEFINITIONS.organicClicks },
    { id: 'sov', label: 'Share of Voice', field: 'share_of_voice', agg: 'avg', format: 'percent', tooltip: METRIC_DEFINITIONS.shareOfVoice },
  ],
  local: [
    { id: 'map-pack', label: 'Map Pack Visibility', field: 'map_pack_visibility', agg: 'avg', format: 'percent', tooltip: METRIC_DEFINITIONS.mapPackVisibility },
    { id: 'local-rank', label: 'Average Local Rank', field: 'avg_local_rank', agg: 'avg', format: 'decimal', invert: true, tooltip: METRIC_DEFINITIONS.averageLocalRank },
    { id: 'review-score', label: 'Average Review Score', field: 'avg_review_score', agg: 'avg', format: 'decimal', tooltip: METRIC_DEFINITIONS.averageReviewScore },
    { id: 'profile-views', label: 'Profile Views', field: 'profile_views', agg: 'sum', format: 'compact', tooltip: METRIC_DEFINITIONS.profileViews },
  ],
  'ai-search': [
    { id: 'ai-visibility', label: 'AI Visibility Score', field: 'ai_visibility_score', agg: 'avg', format: 'decimal', tooltip: METRIC_DEFINITIONS.aiVisibilityScore },
    { id: 'citation-rate', label: 'Citation Rate', field: 'citation_rate', agg: 'avg', format: 'percent', tooltip: METRIC_DEFINITIONS.citationRate },
    { id: 'mentions', label: 'Brand Mentions', field: 'brand_mentions', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.brandMentions },
    { id: 'linked', label: 'Linked Sources', field: 'linked_sources', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.linkedSources },
  ],
  backlinks: [
    { id: 'total', label: 'Total Backlinks', field: 'total_backlinks', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.totalBacklinks },
    { id: 'domains', label: 'Referring Domains', field: 'referring_domains', agg: 'last', format: 'number', tooltip: METRIC_DEFINITIONS.referringDomains },
    { id: 'authority', label: 'Authority Score', field: 'authority_score', agg: 'last', format: 'decimal', tooltip: METRIC_DEFINITIONS.authorityScore },
    { id: 'new', label: 'New Links', field: 'new_links', agg: 'sum', format: 'number', tooltip: METRIC_DEFINITIONS.newLinks },
    { id: 'lost', label: 'Lost Links', field: 'lost_links', agg: 'sum', format: 'number', invert: true, tooltip: METRIC_DEFINITIONS.lostLinks },
    { id: 'toxic', label: 'Toxic Links', field: 'toxic_links', agg: 'last', format: 'number', invert: true, tooltip: METRIC_DEFINITIONS.toxicLinks },
  ],
}

export function buildKpis(
  tab: SeoTabId,
  current: SeoSiteDaily[],
  previous: SeoSiteDaily[],
  source: string,
): SeoKpi[] {
  return SPECS[tab].map(spec => build(spec, current, previous, source))
}

/** Appends a non-daily KPI (counts that come from their own query). */
export function extraKpi(
  id: string,
  label: string,
  value: number | null,
  previous: number | null,
  tooltip: string,
  source: string,
  format: SeoKpi['format'] = 'number',
  invert = false,
): SeoKpi {
  return { id, label, value, previous, format, invert, spark: [], source, tooltip }
}
