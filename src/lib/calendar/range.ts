// URL view-state parsing. Every value is validated and falls back safely, so a
// hand-edited or stale link can never throw or leak an unauthorised value.

import type { CalendarContext } from './entitlements'
import {
  addDays, endOfDayUtc, endOfMonthUtc, formatMonthTitle, formatRangeLabel,
  startOfDayUtc, startOfMonthUtc, startOfWeekUtc, zonedDateKey,
} from './dates'
import type { CalendarFilters } from './types'

export type SearchParamsInput = Record<string, string | string[] | undefined>

export function readParams(input: SearchParamsInput): CalendarFilters {
  const out: CalendarFilters = {}
  for (const [key, value] of Object.entries(input)) {
    const single = Array.isArray(value) ? value[0] : value
    if (typeof single === 'string' && single.length && single.length <= 200) {
      ;(out as Record<string, string>)[key] = single
    }
  }
  return out
}

export function pickView<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

function parseDateKey(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export interface ResolvedRange {
  startIso: string
  endIso: string
  anchorIso: string
  label: string
  /** yyyy-MM-dd of the focused day, when one is selected. */
  selectedDate: string | null
}

/**
 * Resolves the visible window from `view`, `offset`, `date`, `start` and `end`.
 * Only the visible window is ever fetched — never the whole workspace.
 */
export function resolveRange(
  ctx: CalendarContext,
  filters: CalendarFilters,
  view: 'month' | 'week' | 'day' | 'agenda' | 'range',
  opts?: { agendaDays?: number },
): ResolvedRange {
  const offset = clampOffset(filters as { offset?: string })
  const explicitDate = parseDateKey(filters.date)
  const now = explicitDate ?? new Date()

  // An explicit start/end pair always wins.
  const explicitStart = parseDateKey(filters.start)
  const explicitEnd = parseDateKey(filters.end)
  if (explicitStart && explicitEnd && explicitEnd >= explicitStart) {
    const startIso = startOfDayUtc(explicitStart, ctx.timezone).toISOString()
    const endIso = endOfDayUtc(explicitEnd, ctx.timezone).toISOString()
    return {
      startIso, endIso, anchorIso: startIso,
      label: formatRangeLabel(startIso, endIso, ctx.timezone, ctx.locale),
      selectedDate: explicitDate ? zonedDateKey(explicitDate, ctx.timezone) : null,
    }
  }

  if (view === 'month') {
    const anchor = shiftMonths(now, offset, ctx.timezone)
    const start = startOfMonthUtc(anchor, ctx.timezone)
    const end = endOfMonthUtc(anchor, ctx.timezone)
    // The month grid renders trailing days, so fetch the full 6-week grid.
    const gridStart = startOfWeekUtc(start, ctx.weekStartsOn, ctx.timezone)
    return {
      startIso: gridStart.toISOString(),
      endIso: addDays(gridStart, 42).toISOString(),
      anchorIso: start.toISOString(),
      label: formatRangeLabel(start.toISOString(), end.toISOString(), ctx.timezone, ctx.locale),
      selectedDate: explicitDate ? zonedDateKey(explicitDate, ctx.timezone) : null,
    }
  }

  if (view === 'week') {
    const base = addDays(now, offset * 7)
    const start = startOfWeekUtc(base, ctx.weekStartsOn, ctx.timezone)
    const end = new Date(addDays(start, 7).getTime() - 1)
    return {
      startIso: start.toISOString(), endIso: end.toISOString(), anchorIso: start.toISOString(),
      label: formatRangeLabel(start.toISOString(), end.toISOString(), ctx.timezone, ctx.locale),
      selectedDate: zonedDateKey(now, ctx.timezone),
    }
  }

  if (view === 'day') {
    const base = addDays(now, offset)
    const start = startOfDayUtc(base, ctx.timezone)
    const end = endOfDayUtc(base, ctx.timezone)
    return {
      startIso: start.toISOString(), endIso: end.toISOString(), anchorIso: start.toISOString(),
      label: formatRangeLabel(start.toISOString(), end.toISOString(), ctx.timezone, ctx.locale),
      selectedDate: zonedDateKey(base, ctx.timezone),
    }
  }

  // Agenda: a rolling window that starts on the selected day (today by default), as in the
  // reference ("May 20 – May 26" with the 20th as today). Generic ranges anchor on the week.
  const days = opts?.agendaDays ?? 7
  const base = addDays(now, offset * days)
  const start = view === 'agenda'
    ? startOfDayUtc(base, ctx.timezone)
    : startOfWeekUtc(base, ctx.weekStartsOn, ctx.timezone)
  const end = endOfDayUtc(addDays(start, days - 1), ctx.timezone)
  return {
    startIso: start.toISOString(), endIso: end.toISOString(), anchorIso: start.toISOString(),
    label: formatRangeLabel(start.toISOString(), end.toISOString(), ctx.timezone, ctx.locale),
    selectedDate: zonedDateKey(base, ctx.timezone),
  }
}

function clampOffset(filters: { offset?: string }): number {
  const raw = Number(filters.offset ?? '0')
  if (!Number.isFinite(raw)) return 0
  // Bounded so a crafted URL cannot request an enormous scan.
  return Math.max(-120, Math.min(120, Math.trunc(raw)))
}

function shiftMonths(date: Date, months: number, timeZone: string): Date {
  const start = startOfMonthUtc(date, timeZone)
  const d = new Date(start)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

export function monthTitle(ctx: CalendarContext, anchorIso: string) {
  return formatMonthTitle(anchorIso, ctx.timezone, ctx.locale)
}

export function parsePage(filters: CalendarFilters): { page: number; pageSize: number } {
  const page = Math.max(1, Math.min(1000, Number(filters.page ?? '1') || 1))
  const pageSize = [7, 10, 25, 50, 100].includes(Number(filters.pageSize)) ? Number(filters.pageSize) : 7
  return { page, pageSize }
}

/** Preserves the current query string when building a link. */
export function withParams(basePath: string, filters: CalendarFilters, patch: Record<string, string | null>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value) params.set(key, value)
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
