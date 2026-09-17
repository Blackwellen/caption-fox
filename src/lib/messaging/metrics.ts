// Pure metric helpers for the Messaging dashboards.
//
// Every rate on the eight Messaging pages uses the denominators defined here,
// so a figure means the same thing on every page:
//   delivery rate   = delivered / sent
//   open/read rate  = opened / delivered
//   click rate/CTR  = clicked / delivered
//   conversion rate = converted / delivered
//   opt-out rate    = opt-outs / sent
// Deltas compare the selected window with the window of equal length before it.

export interface MetricTotals {
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  opt_outs: number
}

export const EMPTY_TOTALS: MetricTotals = { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, opt_outs: 0 }

export interface PeriodWindow {
  from: string
  to: string
  prevFrom: string
  prevTo: string
  days: number
  /** e.g. "18 Jul – 16 Aug", the previous window, shown as "vs …". */
  prevLabel: string
  /** e.g. "17 Aug – 15 Sept 2026", the selected window. */
  label: string
}

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const isIsoDate = (value: string | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

function shortDate(value: string, withYear = false) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

/** Resolves the selected date window (default: the last 30 days ending today) and its previous window. */
export function resolvePeriod(from?: string, to?: string, today = new Date()): PeriodWindow {
  const todayIso = iso(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  let end = isIsoDate(to) ? to : todayIso
  let start = isIsoDate(from) ? from : iso(Date.parse(end) - 29 * DAY)
  if (Date.parse(start) > Date.parse(end)) [start, end] = [end, start]
  const days = Math.min(366, Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1)
  start = iso(Date.parse(end) - (days - 1) * DAY)
  const prevTo = iso(Date.parse(start) - DAY)
  const prevFrom = iso(Date.parse(prevTo) - (days - 1) * DAY)
  return {
    from: start, to: end, prevFrom, prevTo, days,
    prevLabel: `${shortDate(prevFrom)} – ${shortDate(prevTo)}`,
    label: `${shortDate(start)} – ${shortDate(end, true)}`,
  }
}

/** A percentage 0–100, or null when the denominator is empty (never a fake 0%). */
export function rate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null
  return (numerator / denominator) * 100
}

export interface ChannelRates {
  delivery: number | null
  open: number | null
  click: number | null
  conversion: number | null
  optOut: number | null
}

export function ratesOf(t: MetricTotals): ChannelRates {
  return {
    delivery: rate(t.delivered, t.sent),
    open: rate(t.opened, t.delivered),
    click: rate(t.clicked, t.delivered),
    conversion: rate(t.converted, t.delivered),
    optOut: rate(t.opt_outs, t.sent),
  }
}

/** Relative change in percent for counts (e.g. messages sent), null without a baseline. */
export function relativeChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

/** Percentage-point change for rates, null when either side is unknown. */
export function pointChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return current - previous
}

export function sumTotals(rows: Partial<MetricTotals>[]): MetricTotals {
  const out = { ...EMPTY_TOTALS }
  for (const row of rows) {
    out.sent += Number(row.sent ?? 0)
    out.delivered += Number(row.delivered ?? 0)
    out.opened += Number(row.opened ?? 0)
    out.clicked += Number(row.clicked ?? 0)
    out.converted += Number(row.converted ?? 0)
    out.opt_outs += Number(row.opt_outs ?? 0)
  }
  return out
}

// ── Formatting ────────────────────────────────────────────────────────────────

export const DASH = '—'

export function fmtCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: value >= 1_000_000 ? 2 : 1 }).format(value).replace(/(\.\d*?)0+([KMB])$/, '$1$2').replace(/\.([KMB])$/, '$1')
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH
  return new Intl.NumberFormat('en-GB').format(Math.round(value))
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return `${value.toFixed(digits)}%`
}

/** "1.9pp" / "18.6%" style delta magnitude (sign carried by the arrow). */
export function fmtDelta(value: number | null, unit: 'pp' | '%' | 'count', digits = 1): string {
  if (value === null || !Number.isFinite(value)) return DASH
  const magnitude = Math.abs(value)
  if (unit === 'count') return String(Math.round(magnitude))
  return `${magnitude.toFixed(unit === 'pp' && magnitude < 0.1 && magnitude > 0 ? 2 : digits)}${unit}`
}

/** "5m ago" / "2h ago" / "2d ago", then a date. */
export function fmtRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return DASH
  const diff = now - Date.parse(value)
  if (diff < 0) return fmtDay(value)
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return fmtDay(value)
}

export function fmtDay(value: string | null | undefined): string {
  if (!value) return DASH
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value)).toUpperCase()
}
