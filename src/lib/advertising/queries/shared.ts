import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EMPTY_RAW, addRaw, change, changePoints, integrity, normalise,
  type AttributionWindow, type NormalisedMetrics, type RawMetrics,
} from '../metrics'

// Shared reporting primitives: date-range resolution, metric aggregation by
// entity, period comparison and time series. Every page's KPI strip and chart
// is built from these, so a number means the same thing everywhere.

export type DateRange = { since: string; until: string; label: string }

export type RangePreset = 'last_7' | 'last_14' | 'last_28' | 'last_30' | 'last_90' | 'this_month' | 'last_month' | 'custom'

const DAY = 24 * 60 * 60 * 1000

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Resolves the requested range, defaulting to the last 30 complete days. */
export function resolveRange(params: { preset?: string | null; from?: string | null; to?: string | null }, now = new Date()): DateRange {
  const isDay = (value: string | null | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

  if (params.preset === 'custom' && isDay(params.from) && isDay(params.to)) {
    return { since: params.from, until: params.to, label: 'Custom range' }
  }

  const until = new Date(now)
  const since = new Date(now)

  switch (params.preset) {
    case 'last_7': since.setUTCDate(since.getUTCDate() - 6); return { since: toDay(since), until: toDay(until), label: 'Last 7 days' }
    case 'last_14': since.setUTCDate(since.getUTCDate() - 13); return { since: toDay(since), until: toDay(until), label: 'Last 14 days' }
    case 'last_28': since.setUTCDate(since.getUTCDate() - 27); return { since: toDay(since), until: toDay(until), label: 'Last 28 days' }
    case 'last_90': since.setUTCDate(since.getUTCDate() - 89); return { since: toDay(since), until: toDay(until), label: 'Last 90 days' }
    case 'this_month': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      return { since: toDay(start), until: toDay(until), label: 'This month' }
    }
    case 'last_month': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
      return { since: toDay(start), until: toDay(end), label: 'Last month' }
    }
    default:
      since.setUTCDate(since.getUTCDate() - 29)
      return { since: toDay(since), until: toDay(until), label: 'Last 30 days' }
  }
}

/** The immediately preceding period of equal length, for like-for-like change. */
export function previousRange(range: DateRange): DateRange {
  const since = new Date(`${range.since}T00:00:00Z`)
  const until = new Date(`${range.until}T00:00:00Z`)
  const days = Math.round((until.getTime() - since.getTime()) / DAY) + 1
  const prevUntil = new Date(since.getTime() - DAY)
  const prevSince = new Date(prevUntil.getTime() - (days - 1) * DAY)
  return { since: toDay(prevSince), until: toDay(prevUntil), label: 'Previous period' }
}

export type MetricRow = {
  entity_id: string
  entity_type: string
  provider: string
  metric_date: string
  currency: string
  attribution_window: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  conversions: number
  revenue: number
  video_views: number
  video_3s_views: number
  engagements: number
  is_estimated: boolean
}

function toRaw(row: MetricRow): RawMetrics {
  return {
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    reach: Number(row.reach) || 0,
    clicks: Number(row.clicks) || 0,
    conversions: Number(row.conversions) || 0,
    revenue: Number(row.revenue) || 0,
    videoViews: Number(row.video_views) || 0,
    video3sViews: Number(row.video_3s_views) || 0,
    engagements: Number(row.engagements) || 0,
  }
}

/**
 * Loads daily metrics for one entity level across a date range.
 * Paged in blocks so a large account does not hit PostgREST's row ceiling.
 */
export async function loadMetrics(
  supabase: SupabaseClient,
  input: {
    workspaceId: string
    entityType: 'account' | 'campaign' | 'ad_set' | 'creative' | 'audience'
    range: DateRange
    entityIds?: string[]
    providers?: string[]
    accountIds?: string[]
    attributionWindow?: AttributionWindow
  },
): Promise<MetricRow[]> {
  const rows: MetricRow[] = []
  const pageSize = 1000

  for (let offset = 0; offset < pageSize * 50; offset += pageSize) {
    let query = supabase
      .from('ad_metrics_daily')
      .select('entity_id, entity_type, provider, metric_date, currency, attribution_window, spend, impressions, reach, clicks, conversions, revenue, video_views, video_3s_views, engagements, is_estimated')
      .eq('workspace_id', input.workspaceId)
      .eq('entity_type', input.entityType)
      .gte('metric_date', input.range.since)
      .lte('metric_date', input.range.until)
      .order('metric_date', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (input.attributionWindow) query = query.eq('attribution_window', input.attributionWindow)
    if (input.entityIds?.length) query = query.in('entity_id', input.entityIds)
    if (input.providers?.length) query = query.in('provider', input.providers)
    if (input.accountIds?.length) query = query.in('account_id', input.accountIds)

    const { data } = await query
    const batch = (data ?? []) as MetricRow[]
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

/** Totals across every supplied row. */
export function totals(rows: MetricRow[]): NormalisedMetrics {
  return normalise(rows.reduce<RawMetrics>((acc, row) => addRaw(acc, toRaw(row)), { ...EMPTY_RAW }))
}

/** Totals grouped by entity id. */
export function totalsByEntity(rows: MetricRow[]): Map<string, NormalisedMetrics> {
  const raw = new Map<string, RawMetrics>()
  for (const row of rows) {
    raw.set(row.entity_id, addRaw(raw.get(row.entity_id) ?? { ...EMPTY_RAW }, toRaw(row)))
  }
  return new Map([...raw].map(([id, value]) => [id, normalise(value)]))
}

/** Totals grouped by provider. */
export function totalsByProvider(rows: MetricRow[]): Map<string, NormalisedMetrics> {
  const raw = new Map<string, RawMetrics>()
  for (const row of rows) {
    raw.set(row.provider, addRaw(raw.get(row.provider) ?? { ...EMPTY_RAW }, toRaw(row)))
  }
  return new Map([...raw].map(([id, value]) => [id, normalise(value)]))
}

export type SeriesPoint = { date: string; value: number }

/** A dense daily series, so a chart shows real gaps as zero rather than skipping. */
export function series(rows: MetricRow[], range: DateRange, metric: keyof RawMetrics | 'roas' | 'ctr' | 'cpa'): SeriesPoint[] {
  const byDay = new Map<string, RawMetrics>()
  for (const row of rows) {
    byDay.set(row.metric_date, addRaw(byDay.get(row.metric_date) ?? { ...EMPTY_RAW }, toRaw(row)))
  }

  const points: SeriesPoint[] = []
  const cursor = new Date(`${range.since}T00:00:00Z`)
  const end = new Date(`${range.until}T00:00:00Z`)

  while (cursor.getTime() <= end.getTime()) {
    const day = toDay(cursor)
    const bucket = byDay.get(day)
    const normalised = bucket ? normalise(bucket) : null
    const value = !normalised ? 0
      : metric === 'roas' ? normalised.roas ?? 0
        : metric === 'ctr' ? normalised.ctr ?? 0
          : metric === 'cpa' ? normalised.cpa ?? 0
            : normalised[metric]
    points.push({ date: day, value })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return points
}

export type KpiValue = {
  id: string
  label: string
  /** Formatting is the component's job; this is the number. */
  value: number | null
  format: 'currency' | 'number' | 'percent' | 'roas' | 'integer'
  /** Change against the comparison period. */
  delta: number | null
  /** Whether delta is a percentage or an absolute point difference. */
  deltaUnit: 'pct' | 'pp' | 'abs'
  /** True when a rise is bad, e.g. CPA. */
  inverse?: boolean
  spark: SeriesPoint[]
  tooltip: string
}

/** Builds a KPI comparing two periods with the right change semantics. */
export function kpi(input: {
  id: string
  label: string
  format: KpiValue['format']
  current: number | null
  previous: number | null
  spark: SeriesPoint[]
  tooltip: string
  inverse?: boolean
}): KpiValue {
  // Ratio metrics (CTR, conversion rate) change in percentage points; totals
  // change in percent. Comparing a percentage in percent terms misleads.
  const isRatio = input.format === 'percent'
  const delta = isRatio
    ? changePoints(input.current, input.previous)
    : input.current !== null && input.previous !== null ? change(input.current, input.previous) : null

  return {
    id: input.id,
    label: input.label,
    value: input.current,
    format: input.format,
    delta,
    deltaUnit: isRatio ? 'pp' : 'pct',
    inverse: input.inverse,
    spark: input.spark,
    tooltip: input.tooltip,
  }
}

export type SourceIntegrity = ReturnType<typeof integrity> & {
  /** Providers whose rows contributed to this aggregate. */
  providers: string[]
}

export function sourceIntegrity(rows: MetricRow[]): SourceIntegrity {
  return {
    ...integrity(rows),
    providers: [...new Set(rows.map(row => row.provider))].sort(),
  }
}

/** Reads a single query-string value, tolerating arrays and empty strings. */
export function param(searchParams: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = searchParams[key]
  const first = Array.isArray(value) ? value[0] : value
  return first && first.length > 0 ? first : null
}

/** Reads a repeatable filter value, e.g. ?platform=meta&platform=google */
export function paramList(searchParams: Record<string, string | string[] | undefined>, key: string): string[] {
  const value = searchParams[key]
  if (!value) return []
  const list = Array.isArray(value) ? value : value.split(',')
  return list.map(entry => entry.trim()).filter(Boolean)
}

export function pageParam(searchParams: Record<string, string | string[] | undefined>, key = 'page'): number {
  const raw = Number(param(searchParams, key) ?? 1)
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
}

export function pageSizeParam(searchParams: Record<string, string | string[] | undefined>, fallback = 20): number {
  const raw = Number(param(searchParams, 'pageSize') ?? fallback)
  const allowed = [10, 20, 50, 100]
  return allowed.includes(raw) ? raw : fallback
}
