// Pure formatting helpers for Strategy. UK locale throughout; money uses the
// workspace currency. Every helper tolerates null / NaN and returns an em dash
// rather than rendering "NaN" or "undefined".

const LOCALE = 'en-GB'

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value)
}

export function formatNumber(value: number | null | undefined): string {
  return finite(value) ? new Intl.NumberFormat(LOCALE).format(value) : '—'
}

export function formatCompact(value: number | null | undefined, digits = 1): string {
  if (!finite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: digits }).format(value)
}

export function formatMoney(value: number | null | undefined, currency = 'GBP', digits = 0): string {
  if (!finite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value)
}

/** £23.8M / -£0.6M / £1.2K — always one decimal for M and K so columns align. */
export function formatCompactMoney(value: number | null | undefined, currency = 'GBP', digits = 1): string {
  if (!finite(value)) return '—'
  const formatted = new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency, notation: 'compact',
    minimumFractionDigits: Math.abs(value) >= 1000 ? digits : 0, maximumFractionDigits: digits,
  }).format(value)
  // en-GB compact renders "£3m" / "£1.2k"; the designs use capital suffixes.
  return formatted.replace(/([0-9])(k|m|bn)$/, (_, digit: string, unit: string) => `${digit}${unit === 'bn' ? 'B' : unit.toUpperCase()}`)
}

/** Signed compact money: +£1.9M / -£4.8M / £0. */
export function formatSignedMoney(value: number | null | undefined, currency = 'GBP'): string {
  if (!finite(value)) return '—'
  if (value === 0) return formatCompactMoney(0, currency)
  return `${value > 0 ? '+' : '-'}${formatCompactMoney(Math.abs(value), currency)}`
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  return finite(value) ? `${value.toFixed(digits)}%` : '—'
}

/** +6.2% / -12.5% / 0.0% */
export function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (!finite(value)) return '—'
  const fixed = Math.abs(value).toFixed(digits)
  if (Number(fixed) === 0) return `${(0).toFixed(digits)}%`
  return `${value > 0 ? '+' : '-'}${fixed}%`
}

/** Percentage-point delta magnitude, e.g. "8pp". */
export function formatPp(value: number | null | undefined): string {
  return finite(value) ? `${Math.abs(Math.round(value))}pp` : '—'
}

function toDate(value: string | Date): Date {
  // Date-only strings are calendar dates, not instants: parse at local midnight
  // so "2026-09-30" never renders as 29 Sep west of UTC.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`)
  return new Date(value)
}

function valid(value: string | Date | null | undefined): value is string | Date {
  return value !== null && value !== undefined && value !== '' && !Number.isNaN(toDate(value).getTime())
}

/** 30 Sept 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!valid(value)) return '—'
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(value))
}

/** 30 Sept */
export function formatDayMonth(value: string | Date | null | undefined): string {
  if (!valid(value)) return '—'
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(toDate(value))
}

/** Sept */
export function formatMonth(value: string | Date | null | undefined): string {
  if (!valid(value)) return '—'
  return new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(toDate(value))
}

/** "2h ago" / "Yesterday" / "3d ago" relative to `now`. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!valid(value)) return '—'
  const minutes = Math.round((now.getTime() - toDate(value).getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) {
    const weeks = Math.round(days / 7)
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  }
  const months = Math.round(days / 30)
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`
}

/** "Updated 2 days ago" style wording used on research cards. */
export function formatAgoLong(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!valid(value)) return '—'
  const days = Math.floor((now.getTime() - toDate(value).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.round(days / 7)
  if (days < 30) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  const months = Math.round(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

/** Whole days from today (local) to a date. Negative = in the past. */
export function daysUntil(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!valid(value)) return null
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const target = toDate(value)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** "In 5 days" / "Today" / "3 days overdue" */
export function formatDueIn(value: string | null | undefined, now: Date = new Date()): string {
  const days = daysUntil(value, now)
  if (days === null) return '—'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 0) return `In ${days} days`
  return days === -1 ? '1 day overdue' : `${Math.abs(days)} days overdue`
}

/** "Emma Davis" → "Emma D." as used in dense feeds and tables. */
export function shortName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Unassigned'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

/** OBJ-07 */
export function objectiveRef(refNumber: number | null | undefined): string {
  return finite(refNumber) ? `OBJ-${String(refNumber).padStart(2, '0')}` : 'OBJ-—'
}

/** 12.4 MB */
export function formatBytes(bytes: number | null | undefined): string {
  if (!finite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}
