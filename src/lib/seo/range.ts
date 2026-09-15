// Date-range + comparison-period resolution shared by every SEO surface.
// Client-safe: no server-only imports, so the range picker can reuse it.

import type { SeoDateRange } from './types'
import { formatRangeLabel } from './format'

export const RANGE_PRESETS = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '28d', label: 'Last 28 days', days: 28 },
  { id: '3m', label: 'Last 3 months', days: 90 },
  { id: '6m', label: 'Last 6 months', days: 180 },
  { id: '12m', label: 'Last 12 months', days: 365 },
] as const

export type RangePresetId = typeof RANGE_PRESETS[number]['id']

export const GRANULARITIES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
] as const

export type Granularity = typeof GRANULARITIES[number]['id']

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isValidIso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

/**
 * Resolves the active window and its comparison period from URL state.
 * Invalid or hostile values fall back to the 3-month default rather than
 * throwing, so a shared link can never break the page.
 */
export function resolveDateRange(params?: Record<string, string | string[] | undefined>): SeoDateRange {
  const get = (key: string) => {
    const value = params?.[key]
    return Array.isArray(value) ? value[0] : value
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let to = today
  let from = addDays(today, -89)

  const preset = get('range')
  const customFrom = get('from')
  const customTo = get('to')

  if (isValidIso(customFrom) && isValidIso(customTo) && customFrom <= customTo) {
    from = new Date(`${customFrom}T00:00:00Z`)
    to = new Date(`${customTo}T00:00:00Z`)
  } else {
    const match = RANGE_PRESETS.find(p => p.id === preset) ?? RANGE_PRESETS[2]
    from = addDays(today, -(match.days - 1))
  }

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
  const compareTo = addDays(from, -1)
  const compareFrom = addDays(compareTo, -(days - 1))

  return {
    from: iso(from),
    to: iso(to),
    compareFrom: iso(compareFrom),
    compareTo: iso(compareTo),
    days,
    label: formatRangeLabel(iso(from), iso(to)),
    compareLabel: `vs ${formatRangeLabel(iso(compareFrom), iso(compareTo))}`,
  }
}

/** Preset that best matches a resolved range, for highlighting the picker. */
export function matchPreset(range: SeoDateRange): RangePresetId | 'custom' {
  const match = RANGE_PRESETS.find(p => p.days === range.days)
  return match?.id ?? 'custom'
}

export function resolveGranularity(
  params?: Record<string, string | string[] | undefined>,
  fallback: Granularity = 'daily',
): Granularity {
  const value = params?.granularity
  const raw = Array.isArray(value) ? value[0] : value
  return GRANULARITIES.some(g => g.id === raw) ? (raw as Granularity) : fallback
}

/** Buckets a daily series to the requested granularity. */
export function bucketSeries<T extends { date: string }>(rows: T[], granularity: Granularity): T[][] {
  if (granularity === 'daily') return rows.map(row => [row])
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const date = new Date(`${row.date}T00:00:00Z`)
    let key: string
    if (granularity === 'monthly') {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    } else {
      const day = date.getUTCDay()
      const monday = addDays(date, day === 0 ? -6 : 1 - day)
      key = iso(monday)
    }
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  return [...groups.values()]
}
