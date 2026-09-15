// Normalised advertising metrics: the single place derived paid-media numbers
// are calculated and formatted.
//
// Rules enforced here:
//   - zero denominators yield null, never Infinity or NaN, and never 0
//   - a null derived metric renders as an em dash, not as "0.00"
//   - mixing currencies or attribution windows is surfaced, not hidden
//   - ROAS uses attributed revenue only

export type AttributionWindow = '1d_click' | '7d_click' | '28d_click' | '7d_click_1d_view' | '28d_click_1d_view'

export const ATTRIBUTION_WINDOWS: { id: AttributionWindow; label: string }[] = [
  { id: '1d_click', label: '1-Day Click' },
  { id: '7d_click', label: '7-Day Click' },
  { id: '28d_click', label: '28-Day Click' },
  { id: '7d_click_1d_view', label: '7-Day Click, 1-Day View' },
  { id: '28d_click_1d_view', label: '28-Day Click, 1-Day View' },
]

/** Raw additive metrics, exactly as stored per day in ad_metrics_daily. */
export type RawMetrics = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  conversions: number
  revenue: number
  videoViews: number
  video3sViews: number
  engagements: number
}

/** Raw totals plus every derived ratio. Derived values may be null. */
export type NormalisedMetrics = RawMetrics & {
  ctr: number | null
  cpc: number | null
  cpm: number | null
  cpa: number | null
  roas: number | null
  conversionRate: number | null
  frequency: number | null
  hookRate: number | null
}

export const EMPTY_RAW: RawMetrics = {
  spend: 0, impressions: 0, reach: 0, clicks: 0,
  conversions: 0, revenue: 0, videoViews: 0, video3sViews: 0, engagements: 0,
}

export function addRaw(a: RawMetrics, b: Partial<RawMetrics>): RawMetrics {
  return {
    spend: a.spend + (b.spend ?? 0),
    impressions: a.impressions + (b.impressions ?? 0),
    reach: a.reach + (b.reach ?? 0),
    clicks: a.clicks + (b.clicks ?? 0),
    conversions: a.conversions + (b.conversions ?? 0),
    revenue: a.revenue + (b.revenue ?? 0),
    videoViews: a.videoViews + (b.videoViews ?? 0),
    video3sViews: a.video3sViews + (b.video3sViews ?? 0),
    engagements: a.engagements + (b.engagements ?? 0),
  }
}

export function sumRaw(rows: Partial<RawMetrics>[]): RawMetrics {
  return rows.reduce<RawMetrics>((acc, row) => addRaw(acc, row), { ...EMPTY_RAW })
}

/** Division that refuses to lie: a zero or missing denominator gives null. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator === 0) return null
  return numerator / denominator
}

export function normalise(raw: RawMetrics): NormalisedMetrics {
  const ctr = ratio(raw.clicks, raw.impressions)
  return {
    ...raw,
    ctr: ctr === null ? null : ctr * 100,
    cpc: ratio(raw.spend, raw.clicks),
    cpm: ratio(raw.spend, raw.impressions / 1000),
    cpa: ratio(raw.spend, raw.conversions),
    roas: ratio(raw.revenue, raw.spend),
    conversionRate: (() => { const r = ratio(raw.conversions, raw.clicks); return r === null ? null : r * 100 })(),
    frequency: ratio(raw.impressions, raw.reach),
    // Hook rate = 3-second video views over impressions. Null for non-video.
    hookRate: (() => { const r = ratio(raw.video3sViews, raw.impressions); return r === null ? null : r * 100 })(),
  }
}

/** Budget utilisation as a percentage; null when no budget is set. */
export function budgetUtilisation(spend: number, budget: number | null | undefined): number | null {
  if (budget == null || budget <= 0) return null
  return (spend / budget) * 100
}

/**
 * Expected spend at this point in a flighted campaign, and how far actual spend
 * deviates. Thresholds are documented rather than magic: a campaign is "over"
 * when it has spent more than 110% of its time-linear expectation, and "under"
 * below 90%. Callers render the band, this returns the numbers.
 */
export function pacing(input: {
  spend: number
  budget: number | null | undefined
  startsAt: string | Date | null | undefined
  endsAt: string | Date | null | undefined
  now?: Date
}): { elapsedPct: number; expectedSpend: number; deviationPct: number; band: 'under' | 'on_track' | 'over' } | null {
  const { spend, budget } = input
  if (budget == null || budget <= 0) return null
  const start = input.startsAt ? new Date(input.startsAt) : null
  const end = input.endsAt ? new Date(input.endsAt) : null
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const total = end.getTime() - start.getTime()
  if (total <= 0) return null
  const now = input.now ?? new Date()
  const elapsed = Math.min(Math.max(now.getTime() - start.getTime(), 0), total)
  const elapsedPct = (elapsed / total) * 100
  const expectedSpend = budget * (elapsed / total)
  const deviation = ratio(spend, expectedSpend)
  const deviationPct = deviation === null ? 0 : deviation * 100
  const band = deviationPct > 110 ? 'over' : deviationPct < 90 ? 'under' : 'on_track'
  return { elapsedPct, expectedSpend, deviationPct, band }
}

/** Percentage change between two periods. Null when the base period is zero. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Absolute change in percentage points, for metrics that are themselves a %. */
export function changePoints(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return current - previous
}

// ---------------------------------------------------------------- formatting

const NBSP = ' '
export const DASH = '—'

export function formatCurrency(value: number | null | undefined, currency = 'GBP', opts?: { compact?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return DASH
  if (opts?.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value)
  }
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function formatNumber(value: number | null | undefined, opts?: { compact?: boolean; decimals?: number }): string {
  if (value == null || !Number.isFinite(value)) return DASH
  if (opts?.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
  }
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: opts?.decimals ?? 0 }).format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return `${value.toFixed(decimals)}%`
}

export function formatRoas(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return `${value.toFixed(2)}x`
}

export function formatChange(value: number | null | undefined, unit: 'pct' | 'pp' | 'abs' = 'pct'): string {
  if (value == null || !Number.isFinite(value)) return DASH
  const sign = value > 0 ? '↑' : value < 0 ? '↓' : ''
  const magnitude = Math.abs(value)
  const suffix = unit === 'pp' ? 'pp' : unit === 'abs' ? '' : '%'
  return `${sign}${NBSP}${magnitude.toFixed(unit === 'abs' ? 0 : 1)}${suffix}`
}

/** UK-formatted date range label, e.g. "1 May – 31 May 2026". */
export function formatDateRange(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear()
  const start = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(from)
  const end = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(to)
  return `${start} – ${end}`
}

export function formatRelativeTime(value: string | Date | null | undefined, now = new Date()): string {
  if (!value) return DASH
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return DASH
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

/**
 * Data-integrity check for a set of rows about to be aggregated. Reports mixed
 * currencies or attribution windows so the UI can disclose them instead of
 * quietly summing incomparable numbers.
 */
export function integrity(rows: { currency: string; attribution_window: string; is_estimated?: boolean }[]): {
  currencies: string[]
  windows: string[]
  mixedCurrency: boolean
  mixedWindow: boolean
  hasEstimates: boolean
} {
  const currencies = [...new Set(rows.map(r => r.currency))].sort()
  const windows = [...new Set(rows.map(r => r.attribution_window))].sort()
  return {
    currencies, windows,
    mixedCurrency: currencies.length > 1,
    mixedWindow: windows.length > 1,
    hasEstimates: rows.some(r => r.is_estimated),
  }
}
