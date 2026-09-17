// Normalised social metric layer.
//
// Platforms define reach, impressions and engagement rate differently. Raw
// provider values stay in `post_analytics.raw_data` / `channel_analytics`;
// everything the UI shows goes through the helpers here so a number is never
// silently combined with an incompatible one, and a missing value is never
// quietly turned into a zero.

import type { MetricValue, SocialProvider, TimeseriesPoint } from '@/types/social'

/** Denominator used for engagement rate, per provider. Documented in the UI. */
export const ENGAGEMENT_RATE_BASIS: Record<SocialProvider, 'reach' | 'impressions' | 'followers'> = {
  instagram: 'reach',
  facebook: 'reach',
  tiktok: 'impressions',
  linkedin: 'impressions',
  youtube: 'impressions',
  x: 'impressions',
  pinterest: 'impressions',
  threads: 'impressions',
}

export const ENGAGEMENT_RATE_BASIS_LABEL: Record<'reach' | 'impressions' | 'followers', string> = {
  reach: 'engagements ÷ reach',
  impressions: 'engagements ÷ impressions',
  followers: 'engagements ÷ followers',
}

/**
 * Engagement rate as a fraction (0–1), or null when the denominator is missing
 * or zero. Never returns 0 for "we do not know".
 */
export function engagementRate(engagements: number, denominator: number | null | undefined): number | null {
  if (denominator === null || denominator === undefined || denominator <= 0) return null
  return engagements / denominator
}

/** Percentage change between two periods. Null when there is no baseline. */
export function changePct(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Percentage-point delta, for metrics that are already percentages. */
export function changePp(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return (current - previous) * 100
}

export function metric(current: number, previous: number | null): MetricValue {
  return { value: current, previous, changePct: changePct(current, previous), changePp: null }
}

export function rateMetric(current: number | null, previous: number | null): MetricValue {
  return {
    value: current ?? 0,
    previous,
    changePct: null,
    changePp: changePp(current, previous),
  }
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`
  if (abs >= 1_000) return `${trim(value / 1_000)}K`
  return new Intl.NumberFormat('en-GB').format(Math.round(value))
}

function trim(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return rounded.toFixed(Math.abs(rounded) >= 100 ? 0 : rounded % 1 === 0 ? 0 : 2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

export function percent(value: number | null, digits = 2): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function signedPct(value: number | null, digits = 1): string {
  if (value === null) return '—'
  return `${value >= 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(digits)}%`
}

export function signedPp(value: number | null, digits = 1): string {
  if (value === null) return '—'
  return `${value >= 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(digits)}pp`
}

/** Average response time, minutes → "1h 18m". */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '—'
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

// ── Date ranges ──────────────────────────────────────────────────────────────

export interface DateRange { from: Date; to: Date }

export function rangeFromDays(days: number, now = new Date()): DateRange {
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  const from = new Date(to)
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

/** The immediately preceding window of the same length, for comparisons. */
export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime()
  return {
    from: new Date(range.from.getTime() - span - 1),
    to: new Date(range.from.getTime() - 1),
  }
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function eachDay(range: DateRange): string[] {
  const days: string[] = []
  const cursor = new Date(range.from)
  cursor.setHours(12, 0, 0, 0)
  while (cursor <= range.to) {
    days.push(isoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function formatRangeLabel(range: DateRange): string {
  const fmt = (date: Date) => new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(date)
  const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric' }).format(range.to)
  return `${fmt(range.from)} – ${fmt(range.to)}, ${year}`
}

export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(new Date(`${iso}T12:00:00Z`))
}

// ── Aggregation ──────────────────────────────────────────────────────────────

export interface DailyRollupRow {
  date: string
  total_reach: number | null
  total_impressions: number | null
  total_engagement: number | null
}

/**
 * Builds a dense daily series across the range. Days with no synced rollup are
 * emitted with zeroed counters but a null engagement rate, so charts stay
 * continuous while rate lines correctly break where data is missing.
 */
export function buildSeries(range: DateRange, rows: DailyRollupRow[]): TimeseriesPoint[] {
  const byDate = new Map<string, DailyRollupRow[]>()
  for (const row of rows) {
    const list = byDate.get(row.date) ?? []
    list.push(row)
    byDate.set(row.date, list)
  }
  return eachDay(range).map(date => {
    const dayRows = byDate.get(date) ?? []
    const reach = sum(dayRows.map(r => r.total_reach ?? 0))
    const impressions = sum(dayRows.map(r => r.total_impressions ?? 0))
    const engagements = sum(dayRows.map(r => r.total_engagement ?? 0))
    return {
      date,
      reach,
      impressions,
      engagements,
      engagementRate: dayRows.length === 0 ? null : engagementRate(engagements, reach || impressions),
    }
  })
}

export function sum(values: (number | null | undefined)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}

// ── Listening calculations ───────────────────────────────────────────────────

export interface ShareOfVoiceInput {
  /** Mention counts keyed by brand / competitor label. */
  counts: Record<string, number>
}

/**
 * Share of voice = a brand's mentions ÷ all mentions in the same query set,
 * sources and window. Unattributed mentions are surfaced as "Others" rather
 * than being dropped, so the shares always total 100%.
 */
export function shareOfVoice({ counts }: ShareOfVoiceInput): { label: string; count: number; share: number }[] {
  const total = sum(Object.values(counts))
  if (total === 0) return []
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count, share: count / total }))
    .sort((a, b) => b.count - a.count)
}

export const TRENDING_TOPIC_RULES = {
  minMentions: 25,
  minGrowthPct: 15,
  windowDays: 7,
} as const

export function isTrendingTopic(mentionCount: number, growthPct: number | null): boolean {
  return mentionCount >= TRENDING_TOPIC_RULES.minMentions
    && growthPct !== null
    && growthPct >= TRENDING_TOPIC_RULES.minGrowthPct
}

/** Author audience size at or above which a mention counts as an influencer mention. */
export const INFLUENCER_FOLLOWER_THRESHOLD = 10_000

export function isInfluencerMention(followers: number | null, verified: boolean): boolean {
  return verified || (followers ?? 0) >= INFLUENCER_FOLLOWER_THRESHOLD
}

/**
 * Deterministic mention priority. Documented so a "High" badge can always be
 * explained: negative sentiment, large audience or strong engagement.
 */
export function mentionPriority(input: {
  sentiment: 'positive' | 'neutral' | 'negative'
  reach: number | null
  engagementCount: number | null
  isInfluencer: boolean
}): 'low' | 'medium' | 'high' {
  let score = 0
  if (input.sentiment === 'negative') score += 3
  if (input.sentiment === 'neutral') score += 1
  if (input.isInfluencer) score += 2
  if ((input.reach ?? 0) >= 50_000) score += 2
  else if ((input.reach ?? 0) >= 10_000) score += 1
  if ((input.engagementCount ?? 0) >= 500) score += 1
  if (score >= 5) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

// ── Content performance tiers ────────────────────────────────────────────────

export type PerformanceTier = 'top' | 'good' | 'average' | 'low'

export const PERFORMANCE_TIER_RULE =
  'Engagement rate against this workspace’s mean for the same period: 1.2× or more Top Performer, 0.5× or more Good, 0.25× or more Average, otherwise Low.'

/** Tier for one post's engagement rate relative to the period mean. Null when either is unknown. */
export function performanceTier(rate: number | null, meanRate: number | null): PerformanceTier | null {
  if (rate === null || meanRate === null || meanRate <= 0) return null
  const ratio = rate / meanRate
  if (ratio >= 1.2) return 'top'
  if (ratio >= 0.5) return 'good'
  if (ratio >= 0.25) return 'average'
  return 'low'
}

/** Rolls daily points up into weeks starting Monday, for the weekly granularity. */
export function toWeekly<T extends { date: string }>(points: T[], merge: (items: T[]) => Omit<T, 'date'>): T[] {
  const groups = new Map<string, T[]>()
  for (const point of points) {
    const day = new Date(`${point.date}T12:00:00Z`)
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
    const key = day.toISOString().slice(0, 10)
    groups.set(key, [...(groups.get(key) ?? []), point])
  }
  return [...groups.entries()].map(([date, items]) => ({ ...merge(items), date }) as T)
}

// ── SLA ──────────────────────────────────────────────────────────────────────

export function slaStateFor(input: {
  createdAt: string
  firstResponseAt: string | null
  targetMinutes: number
  now?: Date
}): 'on_track' | 'warning' | 'breached' | 'met' {
  const created = new Date(input.createdAt).getTime()
  if (input.firstResponseAt) {
    const responded = new Date(input.firstResponseAt).getTime()
    return (responded - created) / 60000 <= input.targetMinutes ? 'met' : 'breached'
  }
  const elapsed = ((input.now ?? new Date()).getTime() - created) / 60000
  if (elapsed > input.targetMinutes) return 'breached'
  if (elapsed > input.targetMinutes * 0.75) return 'warning'
  return 'on_track'
}
